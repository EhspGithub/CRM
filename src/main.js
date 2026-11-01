// Entry point of the app. Order matters:
//   1. styles, fonts and libraries (all bundled — the app works with no internet connection)
//   2. native shims (installed app only)
//   3. open + migrate the SQLite database
//   4. load the clinic UI scripts (public/app/*.js, in order) and start it
import "vazirmatn/Vazirmatn-font-face.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "@majidh1/jalalidatepicker/dist/jalalidatepicker.min.css";
import "./styles/app.css";
import Chart from "chart.js/auto";
import "@majidh1/jalalidatepicker/dist/jalalidatepicker.min.js";
import { openStore } from "./db/index.js";
import * as platform from "./platform/index.js";
import { installNativeShims } from "./platform/shims.js";

window.Chart = Chart;

export const APP_SCRIPTS = [
  "00-seed-data",
  "01-utils",
  "02-database",
  "03-backup-status-audit",
  "04-core-navigation",
  "05-dashboard",
  "06-patients",
  "07-dispense-patient-file",
  "08-calls-visits",
  "09-reports",
  "10-settings",
  "11-print",
  "12-backup-import-export",
  "13-backup-merge",
  "14-opium",
  "15-mobile",
  "16-native-app",
];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = false;
    el.onload = resolve;
    el.onerror = () => reject(new Error(`بارگذاری ${src} ناموفق بود`));
    document.body.appendChild(el);
  });
}

function showFatal(err) {
  console.error(err);
  const msg = document.getElementById("nr-splash-msg");
  if (!msg) return;
  msg.innerHTML = "";
  const title = document.createElement("p");
  title.className = "text-rose-300 font-bold mb-2";
  title.textContent = "باز کردن دیتابیس ناموفق بود. داده‌های شما دست‌نخورده باقی مانده‌اند؛ برنامه را ببندید و دوباره باز کنید.";
  const pre = document.createElement("pre");
  pre.dir = "ltr";
  pre.className = "text-[10px] text-rose-200 bg-black/30 rounded-lg p-3 max-w-md whitespace-pre-wrap";
  pre.textContent = String(err && err.message ? err.message : err);
  msg.append(title, pre);
}

async function boot() {
  window.NR_NATIVE = platform.isTauri();
  window.NR_ANDROID = window.NR_NATIVE && platform.isAndroid();
  window.NR_APP_VERSION = __APP_VERSION__;
  window.NRPlatform = platform;
  document.documentElement.classList.toggle("nr-native", window.NR_NATIVE);
  if (window.NR_NATIVE) installNativeShims();

  try {
    window.NRStore = await openStore();
    const base = import.meta.env.BASE_URL || "/";
    for (const name of APP_SCRIPTS) await loadScript(`${base}app/${name}.js`);
    await window.__nrBoot();
  } catch (err) {
    showFatal(err);
    return;
  }
  document.getElementById("nr-splash")?.remove();
}

boot();
