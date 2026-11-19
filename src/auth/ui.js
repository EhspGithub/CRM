// Login / first-run setup / recovery / lock screens, auto-lock, and the «امنیت و ورود» settings page.
import { validateNewCredentials, MIN_PASSWORD_LENGTH } from "./auth.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);
const fa = (n) => Number(n).toLocaleString("fa-IR");
const coarsePointer = () => window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
const toast = (msg, type) => typeof window.showToast === "function" && window.showToast(msg, type);

const BREEZE = `
<svg class="auth-breeze" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
  <defs><linearGradient id="authBreezeGrad" x1="0" x2="1">
    <stop offset="0" stop-color="#5eead4" stop-opacity="0"/><stop offset=".5" stop-color="#5eead4" stop-opacity=".9"/><stop offset="1" stop-color="#7dd3fc" stop-opacity="0"/>
  </linearGradient></defs>
  <path d="M-120 210 C 180 150, 420 300, 720 225 S 1250 160, 1560 235"/>
  <path d="M-120 330 C 220 280, 460 400, 760 330 S 1260 280, 1560 350"/>
  <path d="M-120 610 C 160 560, 470 690, 760 615 S 1230 560, 1560 640"/>
  <path d="M-120 720 C 260 680, 520 790, 820 720 S 1280 670, 1560 735"/>
  <path d="M-120 470 C 200 430, 500 530, 780 470 S 1240 420, 1560 485"/>
</svg>`;

function field({ id, label, type = "text", icon, value = "", placeholder = "", ltr = false, autocomplete = "off", eye = false }) {
  return `
    <div class="auth-field">
      <label for="${id}">${label}</label>
      <input id="${id}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="${autocomplete}"
             autocapitalize="off" spellcheck="false" ${ltr ? 'class="ltr" dir="ltr"' : ""}>
      <i class="fa-solid ${icon} auth-ico"></i>
      ${eye ? `<button type="button" class="auth-eye" data-eye="${id}" aria-label="نمایش رمز"><i class="fa-regular fa-eye"></i></button>` : ""}
    </div>`;
}

class Gate {
  constructor(auth, { clinicName, version, mode }) {
    this.auth = auth;
    this.mode = mode; // "start" | "unlock"
    this.root = document.createElement("div");
    this.root.id = "nr-auth";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.innerHTML = `
      <div class="auth-glow g1"></div><div class="auth-glow g2"></div><div class="auth-glow g3"></div>
      ${BREEZE}
      <div class="auth-wrap">
        <div class="auth-brand">
          <div class="auth-logo"><i class="fa-solid fa-hands-holding-child"></i></div>
          <div class="auth-title">${esc(clinicName || "نسیم رهایی")}</div>
          <div class="auth-sub">سامانه مدیریت کلینیک ترک اعتیاد</div>
        </div>
        <form class="auth-card" novalidate></form>
        <div class="auth-foot"><i class="fa-solid fa-lock ml-1"></i> اطلاعات فقط روی همین دستگاه ذخیره می‌شود${version ? ` · نسخه ${esc(String(version).replace(/\d/g, (d) => fa(d)))}` : ""}</div>
      </div>`;
    this.card = this.root.querySelector(".auth-card");
    this.countdown = null;
  }

  open() {
    document.body.appendChild(this.root);
    // everything behind the lock screen is unreachable for mouse, keyboard and screen readers
    this.inerted = [...document.body.children].filter((el) => el !== this.root && !el.inert && el.tagName !== "SCRIPT");
    this.inerted.forEach((el) => (el.inert = true));
    return new Promise((resolve) => {
      this.done = resolve;
      if (!this.auth.isConfigured()) this.showSetup();
      else this.showLogin();
    });
  }

  /** Fades the screen out and gives the app back. */
  reveal() {
    clearInterval(this.countdown);
    (this.inerted || []).forEach((el) => (el.inert = false));
    this.root.classList.add("is-leaving");
    return new Promise((r) => setTimeout(() => { this.root.remove(); r(); }, 520));
  }

  render(html, onSubmit) {
    clearInterval(this.countdown);
    this.card.innerHTML = html;
    this.card.onsubmit = (e) => { e.preventDefault(); onSubmit(); };
    this.card.querySelectorAll("[data-eye]").forEach((b) => {
      b.onclick = () => {
        const inp = this.card.querySelector("#" + b.dataset.eye);
        const show = inp.type === "password";
        inp.type = show ? "text" : "password";
        b.innerHTML = `<i class="fa-regular ${show ? "fa-eye-slash" : "fa-eye"}"></i>`;
      };
    });
    // re-trigger the entrance animation of the card content
    this.card.style.animation = "none"; void this.card.offsetWidth; this.card.style.animation = "";
    const first = this.card.querySelector("input:not([type=checkbox])");
    if (first && !coarsePointer()) setTimeout(() => first.focus(), 350);
  }

  val(id) { const el = this.card.querySelector("#" + id); return el ? el.value : ""; }

  error(msg) {
    const box = this.card.querySelector(".auth-error");
    box.innerHTML = `<i class="fa-solid fa-circle-exclamation mt-1"></i><span>${esc(msg)}</span>`;
    box.classList.add("show");
    this.card.classList.remove("shake"); void this.card.offsetWidth; this.card.classList.add("shake");
  }

  busy(on, text) {
    const btn = this.card.querySelector("#auth-submit");
    if (!btn) return;
    btn.disabled = on;
    if (on) { btn.dataset.label = btn.innerHTML; btn.innerHTML = `<span class="auth-spin"></span>${text || "لطفاً صبر کنید..."}`; }
    else if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
  }

  startCountdown(waitMs) {
    const btn = this.card.querySelector("#auth-submit");
    const end = Date.now() + waitMs;
    const tick = () => {
      const left = Math.ceil((end - Date.now()) / 1000);
      if (left <= 0) { clearInterval(this.countdown); btn.disabled = false; btn.innerHTML = btn.dataset.label; return; }
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> تلاش دوباره تا ${fa(left)} ثانیه`;
    };
    btn.dataset.label = btn.dataset.label || btn.innerHTML;
    clearInterval(this.countdown);
    tick();
    this.countdown = setInterval(tick, 500);
  }

  failure(res) {
    if (res.reason === "locked" || res.waitMs > 0) {
      const sec = Math.ceil(res.waitMs / 1000);
      this.error(`به دلیل چند تلاش ناموفق، ورود موقتاً قفل شد. لطفاً ${fa(sec)} ثانیه صبر کنید.`);
      this.startCountdown(res.waitMs);
    } else {
      this.error(res.attemptsLeft > 0 && res.attemptsLeft <= 2
        ? `اطلاعات وارد شده درست نیست. ${fa(res.attemptsLeft)} تلاش دیگر تا قفل موقت باقی است.`
        : "نام کاربری یا رمز عبور درست نیست.");
    }
  }

  // ---------- screens ----------
  showSetup() {
    this.render(`
      <div class="auth-heading" data-screen="setup">ساخت حساب ورود</div>
      <p class="auth-hint">اولین بار است برنامه را باز می‌کنید. یک نام کاربری و رمز عبور برای ورود به برنامه انتخاب کنید.</p>
      <div class="auth-error"></div>
      ${field({ id: "auth-username", label: "نام کاربری", icon: "fa-user", placeholder: "مثلاً: admin", autocomplete: "username" })}
      ${field({ id: "auth-password", label: `رمز عبور (حداقل ${fa(MIN_PASSWORD_LENGTH)} کاراکتر)`, type: "password", icon: "fa-key", autocomplete: "new-password", eye: true })}
      ${field({ id: "auth-confirm", label: "تکرار رمز عبور", type: "password", icon: "fa-key", autocomplete: "new-password" })}
      <button id="auth-submit" type="submit" class="auth-btn"><i class="fa-solid fa-user-shield"></i> ساخت حساب و ادامه</button>`,
      async () => {
        const u = this.val("auth-username"), p = this.val("auth-password"), c = this.val("auth-confirm");
        const err = validateNewCredentials(u, p, c);
        if (err) return this.error(err);
        this.busy(true, "در حال ساخت حساب...");
        try {
          const code = await this.auth.setup(u, p);
          this.showRecoveryCode(code, "حساب ساخته شد. کد بازیابی رمز شما:");
        } catch (e) {
          this.busy(false);
          this.error(String(e.message || e));
        }
      });
  }

  showRecoveryCode(code, intro) {
    this.render(`
      <div class="auth-heading" data-screen="recovery">کد بازیابی رمز</div>
      <p class="auth-hint">${esc(intro)} اگر رمز عبور را فراموش کنید، <b class="text-white">فقط با این کد</b> می‌توانید دوباره وارد شوید. آن را روی کاغذ بنویسید یا جای امنی نگه دارید؛ این کد دیگر نمایش داده نمی‌شود.</p>
      <div class="auth-code" id="auth-code-value">${esc(code)}</div>
      <div class="flex justify-center mt-3"><button type="button" id="auth-copy" class="auth-chip"><i class="fa-regular fa-copy"></i> کپی کد</button></div>
      <label class="auth-check"><input type="checkbox" id="auth-ack"> کد بازیابی را یادداشت کردم.</label>
      <button id="auth-submit" type="submit" class="auth-btn" disabled><i class="fa-solid fa-arrow-left"></i> ورود به برنامه</button>`,
      () => {
        if (!this.card.querySelector("#auth-ack").checked) return;
        this.busy(true, "در حال باز کردن برنامه...");
        this.done();
      });
    const btn = this.card.querySelector("#auth-submit");
    this.card.querySelector("#auth-ack").onchange = (e) => { btn.disabled = !e.target.checked; };
    this.card.querySelector("#auth-copy").onclick = async () => {
      try { await navigator.clipboard.writeText(code); toast("کد بازیابی کپی شد."); this.card.querySelector("#auth-copy").innerHTML = '<i class="fa-solid fa-check"></i> کپی شد'; }
      catch { this.card.querySelector("#auth-copy").innerHTML = "کد را دستی یادداشت کنید"; }
    };
  }

  showLogin() {
    const unlock = this.mode === "unlock";
    this.render(`
      <div class="auth-heading" data-screen="login">${unlock ? '<i class="fa-solid fa-lock text-teal-300 ml-1"></i> برنامه قفل شد' : "ورود به سامانه"}</div>
      <p class="auth-hint">${unlock ? "برای ادامه کار، دوباره نام کاربری و رمز عبور را وارد کنید." : "برای ادامه، نام کاربری و رمز عبور خود را وارد کنید."}</p>
      <div class="auth-error"></div>
      ${field({ id: "auth-username", label: "نام کاربری", icon: "fa-user", autocomplete: "username" })}
      ${field({ id: "auth-password", label: "رمز عبور", type: "password", icon: "fa-key", autocomplete: "current-password", eye: true })}
      <button id="auth-submit" type="submit" class="auth-btn"><i class="fa-solid fa-right-to-bracket"></i> ورود</button>
      <button type="button" id="auth-forgot" class="auth-link">رمز عبور را فراموش کرده‌ام</button>`,
      async () => {
        const u = this.val("auth-username"), p = this.val("auth-password");
        if (!u.trim() || !p) return this.error("نام کاربری و رمز عبور را وارد کنید.");
        this.busy(true, "در حال بررسی...");
        const res = await this.auth.login(u, p);
        if (res.ok) {
          this.busy(true, unlock ? "در حال باز کردن قفل..." : "در حال باز کردن برنامه...");
          return this.done();
        }
        this.busy(false);
        this.card.querySelector("#auth-password").value = "";
        this.failure(res);
      });
    this.card.querySelector("#auth-forgot").onclick = () => this.showForgot();
    const wait = this.auth.waitMs();
    if (wait > 0) this.failure({ reason: "locked", waitMs: wait });
  }

  showForgot() {
    this.render(`
      <div class="auth-heading" data-screen="forgot">بازیابی رمز عبور</div>
      <p class="auth-hint">کد بازیابی ۱۶ حرفی را که هنگام ساخت حساب یادداشت کردید وارد کنید و نام کاربری و رمز جدید را انتخاب کنید.</p>
      <div class="auth-error"></div>
      ${field({ id: "auth-code", label: "کد بازیابی", icon: "fa-shield-halved", placeholder: "XXXX-XXXX-XXXX-XXXX", ltr: true })}
      ${field({ id: "auth-username", label: "نام کاربری جدید", icon: "fa-user", value: this.auth.username, autocomplete: "username" })}
      ${field({ id: "auth-password", label: `رمز عبور جدید (حداقل ${fa(MIN_PASSWORD_LENGTH)} کاراکتر)`, type: "password", icon: "fa-key", autocomplete: "new-password", eye: true })}
      ${field({ id: "auth-confirm", label: "تکرار رمز جدید", type: "password", icon: "fa-key", autocomplete: "new-password" })}
      <button id="auth-submit" type="submit" class="auth-btn"><i class="fa-solid fa-unlock-keyhole"></i> تغییر رمز و ورود</button>
      <button type="button" id="auth-back" class="auth-link">بازگشت به صفحه ورود</button>`,
      async () => {
        const code = this.val("auth-code"), u = this.val("auth-username"), p = this.val("auth-password"), c = this.val("auth-confirm");
        if (!code.trim()) return this.error("کد بازیابی را وارد کنید.");
        const err = validateNewCredentials(u, p, c);
        if (err) return this.error(err);
        this.busy(true, "در حال بررسی کد...");
        const res = await this.auth.resetWithRecovery(code, u, p);
        if (res.ok) return this.showRecoveryCode(res.recoveryCode, "رمز عبور تغییر کرد. کد بازیابی قبلی دیگر کار نمی‌کند؛ کد جدید شما:");
        this.busy(false);
        if (res.reason === "invalid") return this.error(res.message);
        if (res.waitMs > 0) return this.failure(res);
        this.error(res.attemptsLeft > 0 && res.attemptsLeft <= 2
          ? `کد بازیابی درست نیست. ${fa(res.attemptsLeft)} تلاش دیگر تا قفل موقت باقی است.`
          : "کد بازیابی درست نیست.");
      });
    this.card.querySelector("#auth-back").onclick = () => this.showLogin();
  }
}

/**
 * Start-up gate. Resolves once the user is authenticated; the screen stays up (showing a spinner) until
 * `reveal()` is called, so the app can load behind it.
 */
export async function runGate(auth, opts) {
  const gate = new Gate(auth, { ...opts, mode: "start" });
  await gate.open();
  return { reveal: () => gate.reveal() };
}

let locked = false;

export async function lockApp(auth, opts) {
  if (locked || !auth.isConfigured()) return;
  locked = true;
  // close any open popup sheet so it doesn't reappear half-filled behind the lock
  document.getElementById("mobile-nav-sheet")?.classList.add("hidden");
  const gate = new Gate(auth, { ...opts, mode: "unlock" });
  await gate.open();
  await gate.reveal();
  locked = false;
}

/** Locks after N minutes without touch/mouse/keyboard (0 = never), also while the app was in the background. */
export function installAutoLock(auth, lock) {
  let last = Date.now();
  const bump = () => { last = Date.now(); };
  for (const ev of ["pointerdown", "keydown", "wheel", "touchstart"]) document.addEventListener(ev, bump, { capture: true, passive: true });
  const check = () => {
    const m = auth.autoLockMinutes;
    if (m > 0 && !locked && Date.now() - last > m * 60000) lock().then(bump);
  };
  setInterval(check, 15000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
}

// ---------- Settings → «امنیت و ورود» ----------
const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-teal-brand/30 bg-white";
const labelCls = "block text-xs font-semibold text-slate-600 mb-1.5";

export function renderSecuritySettings(container, auth, lock) {
  const opts = [0, 5, 10, 15, 30, 60, 120].map((m) => `<option value="${m}" ${auth.autoLockMinutes === m ? "selected" : ""}>${m ? `بعد از ${fa(m)} دقیقه بی‌کاری` : "خاموش (قفل نشود)"}</option>`).join("");
  container.innerHTML = `
    <div class="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
      <div>
        <h3 class="text-base font-extrabold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-user-shield text-teal-brand"></i> امنیت و ورود</h3>
        <p class="text-xs text-slate-400 mt-1">برنامه با نام کاربری و رمز عبور باز می‌شود. رمز به‌صورت رمزنگاری‌شده (hash) در دیتابیس همین دستگاه نگه داشته می‌شود و در فایل‌های پشتیبان نیست.</p>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <form id="sec-cred-form" class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
          <p class="text-xs font-black text-slate-700"><i class="fa-solid fa-key text-teal-brand ml-1"></i> تغییر نام کاربری و رمز</p>
          <div><label class="${labelCls}">رمز فعلی <span class="text-red-500">*</span></label><input type="password" id="sec-current" class="${inputCls}" autocomplete="current-password"></div>
          <div><label class="${labelCls}">نام کاربری</label><input type="text" id="sec-username" class="${inputCls}" value="${esc(auth.username)}" autocomplete="username"></div>
          <div><label class="${labelCls}">رمز جدید (حداقل ${fa(MIN_PASSWORD_LENGTH)} کاراکتر)</label><input type="password" id="sec-new" class="${inputCls}" autocomplete="new-password"></div>
          <div><label class="${labelCls}">تکرار رمز جدید</label><input type="password" id="sec-confirm" class="${inputCls}" autocomplete="new-password"></div>
          <button type="submit" class="w-full px-4 py-2 bg-teal-brand hover-bg-teal text-white text-xs font-bold rounded-xl shadow transition">ذخیره تغییرات</button>
        </form>
        <form id="sec-code-form" class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
          <p class="text-xs font-black text-slate-700"><i class="fa-solid fa-shield-halved text-amber-500 ml-1"></i> کد بازیابی رمز</p>
          <p class="text-[11px] text-slate-500 leading-relaxed">اگر کد بازیابی را گم کرده‌اید یا فکر می‌کنید کسی آن را دیده، یک کد جدید بسازید. کد قبلی بلافاصله باطل می‌شود.</p>
          <div><label class="${labelCls}">رمز فعلی <span class="text-red-500">*</span></label><input type="password" id="sec-code-pass" class="${inputCls}" autocomplete="current-password"></div>
          <button type="submit" class="w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow transition">ساخت کد بازیابی جدید</button>
          <div id="sec-code-out" class="hidden"></div>
        </form>
        <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
          <p class="text-xs font-black text-slate-700"><i class="fa-solid fa-lock text-indigo-500 ml-1"></i> قفل خودکار</p>
          <p class="text-[11px] text-slate-500 leading-relaxed">اگر برنامه مدتی استفاده نشود (یا روی گوشی در پس‌زمینه بماند)، خودکار قفل می‌شود و برای ادامه باید دوباره رمز وارد شود.</p>
          <select id="sec-autolock" class="${inputCls}">${opts}</select>
          <button type="button" id="sec-lock-now" class="w-full px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow transition"><i class="fa-solid fa-lock ml-1"></i> قفل کردن برنامه همین الان</button>
        </div>
      </div>
    </div>`;

  const $ = (id) => container.querySelector("#" + id);
  $("sec-cred-form").onsubmit = async (e) => {
    e.preventDefault();
    const cur = $("sec-current").value, u = $("sec-username").value, p = $("sec-new").value, c = $("sec-confirm").value;
    if (!cur) return toast("رمز فعلی را وارد کنید.", "error");
    if (!p) return toast("رمز جدید را وارد کنید (برای تغییر فقط نام کاربری، رمز فعلی را دوباره بنویسید).", "error");
    const err = validateNewCredentials(u, p, c);
    if (err) return toast(err, "error");
    const res = await auth.changeCredentials(cur, u, p);
    if (!res.ok) return toast(res.message, "error");
    ["sec-current", "sec-new", "sec-confirm"].forEach((id) => ($(id).value = ""));
    toast("نام کاربری و رمز عبور تغییر کرد.");
  };
  $("sec-code-form").onsubmit = async (e) => {
    e.preventDefault();
    const res = await auth.regenerateRecoveryCode($("sec-code-pass").value);
    if (!res.ok) return toast(res.message, "error");
    $("sec-code-pass").value = "";
    const out = $("sec-code-out");
    out.className = "p-3 rounded-xl bg-amber-50 border border-amber-200 text-center space-y-1";
    out.innerHTML = `<p class="text-[11px] font-bold text-amber-800">کد جدید (فقط همین یک بار نمایش داده می‌شود):</p>
      <p dir="ltr" class="font-mono font-black text-base tracking-widest text-slate-800 select-all">${esc(res.recoveryCode)}</p>`;
    toast("کد بازیابی جدید ساخته شد؛ آن را یادداشت کنید.");
  };
  $("sec-autolock").onchange = async (e) => {
    const m = await auth.setAutoLockMinutes(e.target.value);
    toast(m ? `قفل خودکار بعد از ${fa(m)} دقیقه بی‌کاری فعال شد.` : "قفل خودکار خاموش شد.");
  };
  $("sec-lock-now").onclick = () => lock();
}
