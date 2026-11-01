// Login for the app: one username/password, a recovery code for a forgotten password, brute-force throttling
// and the auto-lock setting. Everything lives in the `auth` table of the local SQLite database.
//
// Passwords and the recovery code are never stored: only PBKDF2-SHA-256 hashes with a random salt.
// Note: this is an access lock for the app on this device; the database file itself is not encrypted.

export const PBKDF2_ITERATIONS = 310000;
export const FREE_ATTEMPTS = 5;
const BASE_LOCK_MS = 30 * 1000;
const MAX_LOCK_MS = 15 * 60 * 1000;
export const DEFAULT_AUTO_LOCK_MINUTES = 15;
export const MIN_PASSWORD_LENGTH = 6;
// no 0/O, 1/I/L — easy to read back from paper
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const cryptoApi = () => globalThis.crypto;

const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const DIGITS = { "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9", "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
const englishDigits = (s) => String(s ?? "").replace(/[۰-۹٠-٩]/g, (d) => DIGITS[d]);

/** usernames compare case-insensitively, with Arabic/Persian letter and digit variants unified */
export function normalizeUsername(u) {
  return englishDigits(u).normalize("NFC").trim().replace(/\s+/g, " ").replace(/ي/g, "ی").replace(/ك/g, "ک").toLowerCase();
}

export function normalizeRecoveryCode(c) {
  return englishDigits(c).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatRecoveryCode(c) {
  return normalizeRecoveryCode(c).match(/.{1,4}/g).join("-");
}

export function generateRecoveryCode() {
  const out = [];
  const limit = 256 - (256 % CODE_ALPHABET.length); // reject biased bytes
  while (out.length < 16) {
    const buf = cryptoApi().getRandomValues(new Uint8Array(32));
    for (const b of buf) if (b < limit && out.length < 16) out.push(CODE_ALPHABET[b % CODE_ALPHABET.length]);
  }
  return formatRecoveryCode(out.join(""));
}

async function pbkdf2(secret, saltB64, iterations) {
  const subtle = cryptoApi().subtle;
  const key = await subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromB64(saltB64), iterations }, key, 256);
  return toB64(bits);
}

async function makeHash(secret, iterations) {
  const salt = toB64(cryptoApi().getRandomValues(new Uint8Array(16)));
  return { salt, hash: await pbkdf2(secret, salt, iterations), iterations };
}

function sameString(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verify(secret, h) {
  return !!h && sameString(await pbkdf2(secret, h.salt, h.iterations), h.hash);
}

/** Persian error message, or null if the new credentials are acceptable. */
export function validateNewCredentials(username, password, confirm) {
  if (!normalizeUsername(username)) return "نام کاربری را وارد کنید.";
  if (normalizeUsername(username).length < 3) return "نام کاربری باید حداقل ۳ حرف باشد.";
  if (!password || password.length < MIN_PASSWORD_LENGTH) return `رمز عبور باید حداقل ${MIN_PASSWORD_LENGTH.toLocaleString("fa-IR")} کاراکتر باشد.`;
  if (confirm !== undefined && password !== confirm) return "تکرار رمز عبور با خود رمز یکسان نیست.";
  return null;
}

export class Auth {
  constructor(store, { now = () => Date.now(), iterations = PBKDF2_ITERATIONS } = {}) {
    this.store = store;
    this.now = now;
    this.iterations = iterations;
    this.record = null;
  }

  async load() {
    this.record = await this.store.getAuth();
    return this.record;
  }

  isConfigured() {
    return !!(this.record && this.record.password);
  }

  get username() {
    return this.record ? this.record.username : "";
  }

  get autoLockMinutes() {
    const m = this.record && this.record.autoLockMinutes;
    return Number.isFinite(m) ? m : DEFAULT_AUTO_LOCK_MINUTES;
  }

  async save() {
    await this.store.saveAuth(this.record);
  }

  /** ms the user still has to wait before trying again (0 = may try now) */
  waitMs() {
    const until = (this.record && this.record.lockedUntil) || 0;
    return Math.max(0, until - this.now());
  }

  async registerFailure() {
    const r = this.record;
    r.failedAttempts = (r.failedAttempts || 0) + 1;
    const over = r.failedAttempts - FREE_ATTEMPTS;
    if (over >= 0) r.lockedUntil = this.now() + Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 2 ** over);
    await this.save();
    return { ok: false, reason: "bad", attemptsLeft: Math.max(0, FREE_ATTEMPTS - r.failedAttempts), waitMs: this.waitMs() };
  }

  async registerSuccess() {
    this.record.failedAttempts = 0;
    this.record.lockedUntil = 0;
    this.record.lastLoginAt = this.now();
    await this.save();
  }

  /** First run: creates the account and returns the recovery code to show the user once. */
  async setup(username, password) {
    if (this.isConfigured()) throw new Error("account already exists");
    const err = validateNewCredentials(username, password);
    if (err) throw new Error(err);
    const code = generateRecoveryCode();
    this.record = {
      id: "main",
      username: username.trim(),
      password: await makeHash(password, this.iterations),
      recovery: await makeHash(normalizeRecoveryCode(code), this.iterations),
      autoLockMinutes: DEFAULT_AUTO_LOCK_MINUTES,
      failedAttempts: 0,
      lockedUntil: 0,
      createdAt: this.now(),
    };
    await this.save();
    return code;
  }

  async login(username, password) {
    const wait = this.waitMs();
    if (wait > 0) return { ok: false, reason: "locked", waitMs: wait };
    const userOk = normalizeUsername(username) === normalizeUsername(this.record.username);
    const passOk = await verify(password, this.record.password); // always hashed: no timing hint about the username
    if (userOk && passOk) {
      await this.registerSuccess();
      return { ok: true };
    }
    return this.registerFailure();
  }

  /** Forgotten password: the recovery code sets new credentials and is itself replaced (single use). */
  async resetWithRecovery(code, newUsername, newPassword) {
    const wait = this.waitMs();
    if (wait > 0) return { ok: false, reason: "locked", waitMs: wait };
    const err = validateNewCredentials(newUsername, newPassword);
    if (err) return { ok: false, reason: "invalid", message: err };
    if (!(await verify(normalizeRecoveryCode(code), this.record.recovery))) return this.registerFailure();
    const nextCode = generateRecoveryCode();
    this.record.username = newUsername.trim();
    this.record.password = await makeHash(newPassword, this.iterations);
    this.record.recovery = await makeHash(normalizeRecoveryCode(nextCode), this.iterations);
    await this.registerSuccess();
    return { ok: true, recoveryCode: nextCode };
  }

  async checkPassword(password) {
    return verify(password, this.record.password);
  }

  async changeCredentials(currentPassword, newUsername, newPassword) {
    if (!(await this.checkPassword(currentPassword))) return { ok: false, message: "رمز فعلی درست نیست." };
    const err = validateNewCredentials(newUsername, newPassword);
    if (err) return { ok: false, message: err };
    this.record.username = newUsername.trim();
    this.record.password = await makeHash(newPassword, this.iterations);
    await this.save();
    return { ok: true };
  }

  async regenerateRecoveryCode(currentPassword) {
    if (!(await this.checkPassword(currentPassword))) return { ok: false, message: "رمز فعلی درست نیست." };
    const code = generateRecoveryCode();
    this.record.recovery = await makeHash(normalizeRecoveryCode(code), this.iterations);
    await this.save();
    return { ok: true, recoveryCode: code };
  }

  async setAutoLockMinutes(minutes) {
    const m = Math.max(0, Math.min(240, Math.round(Number(minutes) || 0)));
    this.record.autoLockMinutes = m;
    await this.save();
    return m;
  }
}
