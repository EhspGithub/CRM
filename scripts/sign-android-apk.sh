#!/usr/bin/env bash
# Signs the release APK produced by `tauri android build --apk` and copies it to dist-android/.
#
# With the repository secrets ANDROID_KEYSTORE_BASE64 / ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_ALIAS
# the APK is signed with your permanent key, so new versions install as updates and keep the app's data.
# Without them it is signed with a throw-away key: installable for testing, but it can NOT update an
# install signed with another key (Android would require uninstalling, which deletes the app's data).
#
# Requires: ANDROID_HOME (build-tools 35.0.0), keytool (JDK), node.
set -euo pipefail

BUILD_TOOLS="${ANDROID_HOME:?ANDROID_HOME not set}/build-tools/35.0.0"
OUT_DIR="dist-android"
VERSION="$(node -p "require('./package.json').version")"

work="$(mktemp -d)"
cleanup() { rm -rf -- "$work"; }
trap cleanup EXIT

apk_dir="src-tauri/gen/android/app/build/outputs/apk"
mapfile -t apks < <(find "$apk_dir" -type f -name '*release*.apk' | sort)
if [[ ${#apks[@]} -ne 1 ]]; then
  echo "::error::expected exactly one release APK under $apk_dir, found ${#apks[@]}: ${apks[*]:-none}" >&2
  exit 1
fi
unsigned="${apks[0]}"
echo "Unsigned APK: $unsigned"

keystore="$work/release.jks"
if [[ -n "${ANDROID_KEYSTORE_BASE64:-}" && -n "${ANDROID_KEYSTORE_PASSWORD:-}" && -n "${ANDROID_KEY_ALIAS:-}" ]]; then
  printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 --decode > "$keystore"
  alias_name="$ANDROID_KEY_ALIAS"
  export KS_PASS="$ANDROID_KEYSTORE_PASSWORD"
  out_name="NasimRahayi-${VERSION}.apk"
elif [[ "${GITHUB_REF:-}" == refs/tags/* ]]; then
  # A release must never ship with a throw-away key: users could not update it without losing data.
  echo "::error title=Missing signing secrets::Release builds require ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD and ANDROID_KEY_ALIAS." >&2
  exit 1
else
  echo "::warning title=APK signed with a temporary key::Add the ANDROID_KEYSTORE_* repository secrets (see README) so new versions can update an existing install without losing data."
  {
    echo "### ⚠️ Android APK signed with a temporary key"
    echo "This build is fine for testing, but it cannot update an installation signed with a different key."
    echo "Add the \`ANDROID_KEYSTORE_*\` secrets described in the README."
  } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  alias_name="temp"
  KS_PASS="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"
  export KS_PASS
  keytool -genkeypair -keystore "$keystore" -storepass "$KS_PASS" -keypass "$KS_PASS" -alias "$alias_name" \
    -keyalg RSA -keysize 4096 -validity 365 -dname "CN=Nasim Rahayi test build" -noprompt >/dev/null
  out_name="NasimRahayi-${VERSION}-test-signed.apk"
fi

aligned="$work/aligned.apk"
"$BUILD_TOOLS/zipalign" -p -f 4 "$unsigned" "$aligned"

mkdir -p "$OUT_DIR"
"$BUILD_TOOLS/apksigner" sign \
  --ks "$keystore" --ks-pass env:KS_PASS --key-pass env:KS_PASS --ks-key-alias "$alias_name" \
  --out "$OUT_DIR/$out_name" "$aligned"
certs="$("$BUILD_TOOLS/apksigner" verify --print-certs "$OUT_DIR/$out_name")"
sha256="$(printf '%s\n' "$certs" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p')"
if [[ -z "$sha256" ]]; then
  echo "::error::could not read the APK signing certificate" >&2
  exit 1
fi
# Shown as a run annotation so the signing key can be checked without downloading the APK.
echo "::notice title=APK signing certificate SHA-256::$sha256 ($out_name)"
echo "Signed APK: $OUT_DIR/$out_name"
