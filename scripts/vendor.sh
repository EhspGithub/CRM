#!/usr/bin/env bash
# Downloads the libraries index.html uses into src/vendor/ so the Windows and Android apps work offline.
# Run once after changing a library version, then commit src/vendor/.
set -euo pipefail
cd "$(dirname "$0")/../src"
JSD=https://cdn.jsdelivr.net/npm
get() { mkdir -p "$(dirname "$2")"; curl -fsSL --retry 3 "$1" -o "$2"; echo "  $2"; }

rm -rf vendor
get https://cdn.tailwindcss.com/3.4.17                                       vendor/tailwindcss/tailwindcss.js
get $JSD/chart.js@4.4.1/dist/chart.umd.js                                     vendor/chartjs/chart.umd.js
get $JSD/@majidh1/jalalidatepicker@1.0.0/dist/jalalidatepicker.min.js         vendor/jalalidatepicker/jalalidatepicker.min.js
get $JSD/@majidh1/jalalidatepicker@1.0.0/dist/jalalidatepicker.min.css        vendor/jalalidatepicker/jalalidatepicker.min.css
get $JSD/vazirmatn@33.0.3/Vazirmatn-font-face.css                             vendor/vazirmatn/Vazirmatn-font-face.css
for w in Thin ExtraLight Light Regular Medium SemiBold Bold ExtraBold Black; do
  get $JSD/vazirmatn@33.0.3/fonts/webfonts/Vazirmatn-$w.woff2                 vendor/vazirmatn/fonts/webfonts/Vazirmatn-$w.woff2
done
get $JSD/@fortawesome/fontawesome-free@6.5.2/css/all.min.css                  vendor/fontawesome/css/all.min.css
for w in fa-brands-400 fa-regular-400 fa-solid-900 fa-v4compatibility; do
  get $JSD/@fortawesome/fontawesome-free@6.5.2/webfonts/$w.woff2              vendor/fontawesome/webfonts/$w.woff2
  get $JSD/@fortawesome/fontawesome-free@6.5.2/webfonts/$w.ttf                vendor/fontawesome/webfonts/$w.ttf
done
