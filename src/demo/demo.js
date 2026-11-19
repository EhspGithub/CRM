// Online demo build only (`npm run build:demo`). Imported dynamically from main.js when
// import.meta.env.MODE === "demo", so none of this ships in the installed app.
//
// What the demo changes:
//   • no login screen; sample clinic data on first open (kept in this browser, resettable)
//   • a fixed bar with the purchase contact
//   • at most DEMO_MAX_NEW_PATIENTS new admissions
//   • backup / restore / Excel import-export / folder sync are locked; prints carry a watermark
import "./demo.css";
import { resetBrowserStore } from "../db/index.js";

export const DEMO_MAX_NEW_PATIENTS = 15;
export const CONTACT_PHONE = "09143728291";
const CONTACT_FA = "۰۹۱۴ ۳۷۲ ۸۲۹۱";
const TELEGRAM_URL = "https://t.me/dr_ehassanpour";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// new admissions get crypto.randomUUID() ids; the sample records use "OMID-…" / "P-…"
export const isUserAdded = (p) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(p && p.id));
export const countUserAdded = (patients) => (patients || []).filter(isUserAdded).length;

// ---------------------------------------------------------------- modal
function closeModal() {
  document.getElementById("nr-demo-modal")?.remove();
}

export function showDemoModal({ icon = "fa-lock", title, body, actions = [] }) {
  closeModal();
  const wrap = document.createElement("div");
  wrap.id = "nr-demo-modal";
  wrap.className = "nr-demo-modal";
  wrap.innerHTML = `
    <div class="nr-demo-card" role="dialog" aria-modal="true" aria-labelledby="nr-demo-title">
      <div class="nr-demo-icon"><i class="fa-solid ${icon}"></i></div>
      <h3 id="nr-demo-title">${esc(title)}</h3>
      <p>${body}</p>
      <a class="nr-demo-tg" href="${TELEGRAM_URL}" target="_blank" rel="noopener">
        <i class="fa-brands fa-telegram"></i><span>خرید نسخه کامل در تلگرام</span><b dir="ltr">${CONTACT_FA}</b>
      </a>
      <div class="nr-demo-actions"></div>
    </div>`;
  const row = wrap.querySelector(".nr-demo-actions");
  for (const a of [...actions, { label: "متوجه شدم", primary: !actions.length }]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = a.primary ? "nr-demo-btn primary" : "nr-demo-btn";
    b.textContent = a.label;
    b.onclick = () => { closeModal(); a.run && a.run(); };
    row.appendChild(b);
  }
  wrap.addEventListener("click", (e) => { if (e.target === wrap) closeModal(); });
  document.body.appendChild(wrap);
  wrap.querySelector(".nr-demo-btn.primary, .nr-demo-btn")?.focus();
}

export function demoLocked(feature) {
  showDemoModal({
    title: "در نسخه نمایشی فعال نیست",
    body: `«${esc(feature)}» فقط در نسخه کامل (نصبی ویندوز و اندروید) در دسترس است. در نسخه کامل، اطلاعات روی دیتابیس امن همان دستگاه ذخیره می‌شود و پشتیبان‌گیری خودکار دارد.`,
  });
}

async function resetDemo() {
  await resetBrowserStore();
  location.reload();
}

function confirmReset() {
  showDemoModal({
    icon: "fa-rotate-left",
    title: "بازگشت به حالت اول",
    body: "همه تغییراتی که در این دمو داده‌اید پاک می‌شود و اطلاعات نمونه دوباره بارگذاری می‌شود.",
    actions: [{ label: "بله، بازگردانی شود", primary: true, run: resetDemo }],
  });
}

// ---------------------------------------------------------------- bar
function installBar() {
  const bar = document.createElement("div");
  bar.id = "nr-demo-bar";
  bar.className = "nr-demo-bar no-print";
  bar.innerHTML = `
    <span class="nr-demo-tag"><i class="fa-solid fa-flask"></i>نسخه نمایشی</span>
    <span class="nr-demo-msg">برای خرید نسخه کامل</span>
    <a href="${TELEGRAM_URL}" target="_blank" rel="noopener" class="nr-demo-link"><i class="fa-brands fa-telegram"></i><b dir="ltr">${CONTACT_FA}</b></a>
    <button type="button" class="nr-demo-reset" title="بازگشت اطلاعات نمونه به حالت اول"><i class="fa-solid fa-rotate-left"></i><span>حالت اول</span></button>`;
  bar.querySelector(".nr-demo-reset").onclick = confirmReset;
  const header = document.querySelector("header.app-header");
  header ? header.before(bar) : document.body.prepend(bar);

  const foot = document.createElement("div");
  foot.className = "nr-demo-printmark";
  foot.innerHTML = `<span>نسخه نمایشی</span>`;
  document.body.appendChild(foot);
  const line = document.createElement("div");
  line.className = "nr-demo-printline";
  line.textContent = `چاپ از نسخه نمایشی — برای تهیه نسخه کامل در تلگرام پیام دهید: ${CONTACT_FA}`;
  document.body.appendChild(line);
}

// ---------------------------------------------------------------- sample data
// called on the very first open, after the base sample patients were written by initIndexedDB
async function seedOpium() {
  const w = window;
  if (!w.patients || !w.patients.length || (w.opiumMembers && w.opiumMembers.length)) return;
  const today = w.opToday();
  const active = w.patients.filter((p) => p.status === "فعال");
  const picks = [...active.filter((p) => p.currentDrug === "اپیوم"), ...active.filter((p) => p.currentDrug !== "اپیوم")].slice(0, 9);
  const prios = ["A1", "A2", "B1", "B2", "B3", "A1", "B1", "A2", "B2"];
  const doses = [10, 15, 8, 20, 12, 6, 25, 10, 14];
  const ago = [1, 2, 3, 5, 6, 8, 9, 12, 4];
  const days = [7, 7, 10, 7, 14, 7, 10, 7, 7];
  const members = [], deliveries = [];
  picks.forEach((p, i) => {
    const addedAt = w.opNormDate(w.addDaysToJalali(today, -40));
    members.push({
      id: "opm_" + p.id, patientId: p.id, active: true, priority: prios[i],
      addedAt, removedAt: "", createdAt: Date.now(), log: [{ action: "add", date: addedAt, ts: Date.now() }],
    });
    p.currentPriority = prios[i];
    // one earlier delivery that ran out, then the current one
    for (const back of [ago[i] + days[i], ago[i]]) {
      const date = w.opNormDate(w.addDaysToJalali(today, -back));
      const c = w.opComputeDelivery(doses[i], date, days[i]);
      const d = {
        id: crypto.randomUUID(), patientId: p.id, date, dailyDose: doses[i], days: days[i], volume: c.volume,
        nextVisitDate: c.next, nextVisitWeekday: c.weekday, status: "ثبت‌شده", recordedBy: w.opWho(), createdAt: Date.now(),
      };
      deliveries.push(d);
      w.opMirrorDelivery(p, d);
    }
    w.opSyncLastDispense(p, "");
  });
  w.opiumMembers = members;
  w.opiumDeliveries = deliveries;
  await w.dbPutAll("opiumMembers", members);
  await w.dbPutAll("opiumDeliveries", deliveries);
  await w.dbPutAll("patients", picks);
}

// ---------------------------------------------------------------- locks
function lockFunctions() {
  const w = window;
  const lock = (name, feature) => { w[name] = () => demoLocked(feature); };
  lock("exportDatabase", "دریافت فایل پشتیبان");
  lock("handleBackupFileSelected", "بازیابی از فایل پشتیبان");
  lock("importDatabase", "بازیابی از فایل پشتیبان");
  lock("startSmartMerge", "ادغام فایل پشتیبان");
  lock("openExcelExportModal", "خروجی اکسل");
  lock("generateExcelExport", "خروجی اکسل");
  lock("opiumExportReportCSV", "خروجی اکسل گزارش اپیوم");
  lock("importCSV", "ورود اطلاعات از اکسل");
  lock("changeBackupFolder", "انتخاب پوشه پشتیبان");
  w.toggleAutoSync = (el) => { if (el) el.checked = false; demoLocked("پشتیبان‌گیری خودکار در پوشه"); };
  w.initAutoSyncOnStartup = () => {};
  w.performAutoSync = async () => {};
  w.clearAllData = confirmReset;

  // no backup nagging: nothing here can be backed up anyway
  const origReminder = w.triggerBackupReminder;
  w.triggerBackupReminder = () => {
    try { origReminder && origReminder(); } catch { /* ignore */ }
    try { needsBackup = false; } catch { /* ignore */ }
    try { w.setSidebarBackupStatus && w.setSidebarBackupStatus(false); w.stopBackupStatusBlink && w.stopBackupStatusBlink(); } catch { /* ignore */ }
  };

  // admissions cap
  const origSubmit = w.handleFormSubmit;
  w.handleFormSubmit = function (event) {
    const isEdit = document.getElementById("form-edit-id")?.value;
    if (!isEdit && countUserAdded(w.patients) >= DEMO_MAX_NEW_PATIENTS) {
      event && event.preventDefault();
      showDemoModal({
        icon: "fa-user-plus",
        title: "سقف پذیرش نسخه نمایشی",
        body: `در نسخه نمایشی می‌توانید تا ${DEMO_MAX_NEW_PATIENTS.toLocaleString("fa-IR")} مراجع جدید ثبت کنید. نسخه کامل محدودیتی در تعداد مراجعین ندارد.`,
        actions: [{ label: "بازگشت به حالت اول", run: confirmReset }],
      });
      return;
    }
    return origSubmit.apply(this, arguments);
  };

  // any file picker (restore, CSV import…) — stop it before the browser dialog opens
  document.addEventListener("click", (e) => {
    const input = e.target && e.target.closest && e.target.closest('input[type="file"]');
    if (!input) return;
    e.preventDefault();
    e.stopPropagation();
    demoLocked(input.accept && input.accept.includes("csv") ? "ورود اطلاعات از اکسل" : "بازیابی از فایل پشتیبان");
  }, true);

  // anything else that tries to download a file
  const origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute("download")) { demoLocked("دریافت فایل"); return; }
    return origClick.call(this);
  };
}

function lockLogin() {
  window.NRAuth = {
    lock: () => showDemoModal({
      icon: "fa-user-lock",
      title: "قفل برنامه",
      body: "در نسخه کامل، برنامه با نام کاربری و رمز عبور باز می‌شود و پس از چند دقیقه بی‌استفاده ماندن خودکار قفل می‌شود. کد بازیابی هم برای فراموشی رمز دارد.",
    }),
    renderSettings: (el) => {
      if (!el) return;
      el.innerHTML = `<div class="nr-demo-settings"><i class="fa-solid fa-shield-halved"></i>
        <div><b>ورود با رمز و قفل خودکار</b><p>در نسخه نمایشی صفحه ورود غیرفعال است. در نسخه کامل: نام کاربری و رمز عبور، کد بازیابی، و قفل خودکار پس از مدت دلخواه.</p></div></div>`;
    },
    username: "demo",
  };
}

// ---------------------------------------------------------------- entry points
// before the UI boots: neutral clinic identity, function overrides
export function beforeBoot() {
  window.NR_DEMO = true;
  try {
    // classic-script globals (00-seed-data.js); mutate, they are consts
    Object.assign(defaultSettings, {
      clinicName: "کلینیک نمونه",
      displayTitle: "سامانه مدیریت کلینیک ترک اعتیاد",
      chiefDoctorName: "پزشک مسئول",
      city: "شهر شما",
      address: "نشانی کلینیک",
      phone: "",
      mobile: "",
    });
  } catch { /* ignore */ }
  lockLogin();
  lockFunctions();
  // sample opium list right after the base sample data, before the first render
  const origInit = window.initIndexedDB;
  window.initIndexedDB = async function () {
    await origInit.apply(this, arguments);
    if (window.__nrFirstRun) await seedOpium();
  };
}

export async function afterBoot() {
  installBar();
  try { needsBackup = false; } catch { /* ignore */ }
  try { window.setSidebarBackupStatus && window.setSidebarBackupStatus(false); } catch { /* ignore */ }
}
