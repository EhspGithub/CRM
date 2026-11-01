// End-to-end test of the production build in Chrome (browser mode = the same UI on SQLite/WASM).
// Covers start-up, every page at desktop and phone width, data surviving a reload (SQLite), full restore
// of a JSON backup from the old single-file version, and the main clinical flows.
//   CHROME_PATH=/usr/bin/google-chrome npm run test:e2e  [-- <screenshot dir>]
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const SHOTS = process.argv[2] || "e2e-shots";
const PORT = 4173;
const URL = `http://localhost:${PORT}/`;
const TABS = ["dashboard", "add-patient", "patients-list", "follow-ups", "dispense", "opium", "reports-analytics", "settings"];

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "✔" : "✘"} ${msg}`);
  if (!ok) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(SHOTS, { recursive: true });
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore", shell: process.platform === "win32" });
const stop = () => server.kill();

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error("preview server did not start");
}


// ---------- login screen ----------
const CREDS = { user: "admin", pass: "secret123" };
let recoveryCode = null;
const getRecoveryCode = () => recoveryCode;

async function passGate(page) {
  await page.waitForSelector("#nr-auth [data-screen]", { timeout: 30000 });
  const screen = await page.$eval("#nr-auth [data-screen]", (e) => e.dataset.screen);
  if (screen === "setup") {
    await page.type("#auth-username", CREDS.user);
    await page.type("#auth-password", CREDS.pass);
    await page.type("#auth-confirm", CREDS.pass);
    await page.click("#auth-submit");
    await page.waitForSelector('#nr-auth [data-screen="recovery"]', { timeout: 30000 });
    recoveryCode = await page.$eval("#auth-code-value", (e) => e.textContent.trim());
    await page.click("#auth-ack");
    await page.click("#auth-submit");
  } else {
    await page.type("#auth-username", CREDS.user);
    await page.type("#auth-password", CREDS.pass);
    await page.click("#auth-submit");
  }
  await page.waitForFunction(() => !document.getElementById("nr-auth"), { timeout: 30000 });
  return screen;
}

async function boot(page) {
  await page.goto(URL, { waitUntil: "networkidle0" });
  const screen = await passGate(page);
  await page.waitForFunction(() => !document.getElementById("nr-splash") && window.patients, { timeout: 30000 });
  await sleep(300);
  return screen;
}

try {
  await waitForServer();
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/favicon/.test(m.text()) && errors.push(m.text()));
  page.on("dialog", (d) => d.accept());

  // ---------- start-up: first run asks to create the login ----------
  await page.setViewport({ width: 1366, height: 860 });
  const firstScreen = await boot(page);
  check(firstScreen === "setup" && /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/.test(recoveryCode || ""), `first run shows account setup and a recovery code (${recoveryCode})`);
  const start = await page.evaluate(() => ({
    patients: window.patients.length,
    store: !!window.NRStore,
    title: document.getElementById("header-title").textContent,
    version: document.getElementById("header-version").textContent,
  }));
  check(start.store && start.patients > 0, `app starts on SQLite with demo data (${start.patients} patients)`);
  check(/نسخه/.test(start.version), `version label shown (${start.version})`);

  // ---------- every page, desktop + phone ----------
  for (const [w, h, label] of [[1366, 860, "desktop"], [390, 844, "phone"]]) {
    // changing isMobile makes Chrome reload the page, so start fresh after each viewport switch
    await page.setViewport({ width: w, height: h, isMobile: w < 800, hasTouch: w < 800 });
    await boot(page);
    for (const t of TABS) {
      await page.evaluate((t) => switchTab(t), t);
      await sleep(250);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(ov <= 1, `${label}: «${t}» renders without horizontal overflow (${ov}px)`);
      await page.screenshot({ path: path.join(SHOTS, `${label}-${t}.png`) });
    }
  }
  const navVisible = await page.evaluate(() => getComputedStyle(document.getElementById("mobile-bottom-nav")).display !== "none");
  check(navVisible, "phone: bottom navigation is visible");
  await page.evaluate(() => openMobileMenu());
  await sleep(200);
  await page.screenshot({ path: path.join(SHOTS, "phone-menu.png") });
  await page.click('#mobile-nav-sheet [data-msheet="opium"]');
  await sleep(250);
  check(await page.evaluate(() => !document.getElementById("tab-opium").classList.contains("hidden")), "phone: «more» sheet navigates to opium management");
  await page.setViewport({ width: 1366, height: 860 });
  await boot(page);

  // ---------- admit a patient through the real form, then reload: it must come back from SQLite ----------
  await page.evaluate(() => switchTab("add-patient"));
  await page.type("#p-code", "7777");
  await page.type("#p-fullName", "بیمار آزمایشی پایدار");
  await page.evaluate(() => {
    document.getElementById("p-birthdate").value = "1370/01/01";
    document.getElementById("p-age").value = "35";
    document.getElementById("p-phone").value = "09121234567";
    document.getElementById("p-counselor").selectedIndex = 1;
    document.getElementById("p-drug").value = "ش متادون";
    handleDrugDosageUnits("p-drug", "p-dosage-container", "p-dosage-unit");
    document.getElementById("p-dosage").value = "45";
  });
  await page.click("#btn-submit-form");
  await sleep(400);
  check(await page.evaluate(() => window.patients.some((p) => p.code === 7777)), "admission form saves a new patient");

  // ---------- record a visit through the visit form ----------
  await page.evaluate(() => openVisitModal(window.patients.find((p) => p.code === 7777).id));
  await page.type("#visit-notes", "ویزیت آزمایشی");
  await page.evaluate(() => {
    document.getElementById("visit-dosage").value = "40";
    document.getElementById("visit-status").value = "کاهش دوز";
  });
  await page.click('#visit-modal button[type="submit"]');
  await sleep(400);
  check(await page.evaluate(() => window.patients.find((p) => p.code === 7777).currentDosage === 40), "visit form updates the current dose");

  await boot(page);
  const persisted = await page.evaluate(() => {
    const p = window.patients.find((x) => x.code === 7777);
    return { p: !!p, dose: p && p.currentDosage, visits: p ? window.visits.filter((v) => v.patientId === p.id).length : 0 };
  });
  check(persisted.p && persisted.dose === 40 && persisted.visits === 1, "patient and visit survive a reload (stored in SQLite)");

  // ---------- opium: add to list + record a delivery ----------
  const opium = await page.evaluate(async () => {
    switchTab("opium");
    const p = window.patients.find((x) => x.code === 7777);
    openOpiumAddModal();
    opiumUI.addSelected = new Set([p.id]);
    confirmOpiumAdd();
    openOpiumDeliveryModal(p.id);
    document.getElementById("op-d-dose").value = "10";
    document.getElementById("op-d-date").value = getShamsiToday();
    document.getElementById("op-d-days").value = "7";
    opDelRecalc();
    submitOpiumDelivery();
    closeOpiumDeliveryModal();
    await new Promise((r) => setTimeout(r, 300));
    const rows = await window.NRStore.getAll("opiumDeliveries");
    return rows.filter((d) => d.patientId === p.id).map((d) => d.volume);
  });
  check(opium.length === 1 && opium[0] === 70, `opium delivery is calculated and stored (${opium})`);

  // ---------- restore a JSON backup made by the old single-file version ----------
  const legacyBackup = {
    patients: [{ id: "L-1", code: 501, fullName: "مراجع نسخه قدیمی", nationalId: "۰۰۱۸۴۷۵۲۹۳", phone: "0912 000 0000", birthdate: "1360/01/01", age: 45, gender: "مرد", status: "فعال", attendance: "منظم", initialDrug: "شربت متادون", initialDosage: 30, currentDrug: "شربت متادون", currentDosage: 30, medHistory: [], insurance: "دارد", substance: "تریاک", admissionDate: "1402/01/01" }],
    visits: [{ id: "LV-1", patientId: "L-1", date: "1402/02/01", notes: "قدیمی", prevDrug: "شربت متادون", newDrug: "شربت متادون", prevDosage: 30, newDosage: 30, status: "ادامه درمان" }],
    contactLogs: [], insuranceHistory: [], auditLogs: [], backupHistory: [], patientReviews: [],
    settings: { clinicName: "کلینیک بکاپ", displayTitle: "عنوان بازیابی‌شده" },
    staff: { doctors: ["دکتر الف"], psychologists: ["مشاور ب"] },
    exportedAt: "1404/01/01",
  };
  await page.evaluate((data) => performFullRestore(data, "old-version.json"), legacyBackup);
  await sleep(800);
  await boot(page);
  const restored = await page.evaluate(() => ({
    n: window.patients.length,
    p: window.patients[0] && { drug: window.patients[0].currentDrug, nid: window.patients[0].nationalId, phone: window.patients[0].phone },
    visits: window.visits.length,
    title: document.getElementById("header-title").textContent,
    opium: window.opiumDeliveries.length,
  }));
  check(restored.n === 1 && restored.visits === 1, "full restore replaces the data with the backup's records");
  check(restored.p && restored.p.drug === "ش متادون" && restored.p.nid === "0018475293" && restored.p.phone === "09120000000", "legacy records are normalised on load (drug names, digits)");
  check(restored.title === "عنوان بازیابی‌شده", "restored settings are applied");
  check(restored.opium === 0, "stores missing from an old backup are emptied, not left stale");

  // ---------- reports + printing preview render ----------
  await page.evaluate(() => { switchTab("reports-analytics"); buildCustomReport(); openPrintPreview(); });
  await sleep(300);
  check(await page.evaluate(() => document.querySelector("#print-preview-content table") !== null), "report builder + print preview render");
  await page.evaluate(() => closePrintPreview());

  // ---------- login, lock, wrong password, forgotten password ----------
  check((await boot(page)) === "login", "later starts ask for username and password");
  const lockNow = () => page.evaluate(() => { NRAuth.lock(); return true; });
  await lockNow();
  await page.waitForSelector('#nr-auth [data-screen="login"]');
  check(await page.evaluate(() => document.querySelector("header").inert === true), "lock screen makes the app behind it unreachable");
  await page.type("#auth-username", CREDS.user);
  await page.type("#auth-password", "wrong-pass");
  await page.click("#auth-submit");
  await page.waitForSelector("#nr-auth .auth-error.show");
  check(true, "wrong password shows an error and stays locked");
  await page.click("#auth-forgot");
  await page.waitForSelector('#nr-auth [data-screen="forgot"]');
  await page.type("#auth-code", recoveryCode.toLowerCase());
  await page.$eval("#auth-username", (e) => (e.value = ""));
  await page.type("#auth-username", "مدیر");
  await page.type("#auth-password", "newpass99");
  await page.type("#auth-confirm", "newpass99");
  await page.click("#auth-submit");
  await page.waitForSelector('#nr-auth [data-screen="recovery"]', { timeout: 30000 });
  const newCode = await page.$eval("#auth-code-value", (e) => e.textContent.trim());
  check(newCode !== recoveryCode, "recovery code resets the password and issues a new code");
  await page.click("#auth-ack");
  await page.click("#auth-submit");
  await page.waitForFunction(() => !document.getElementById("nr-auth"), { timeout: 30000 });
  check(await page.evaluate(() => document.querySelector("header").inert === false), "unlocking gives the app back");
  CREDS.user = "مدیر";
  CREDS.pass = "newpass99";
  await page.evaluate(() => { switchTab("settings"); switchSettingsSubTab("security"); });
  await sleep(300);
  check(await page.evaluate(() => !!document.querySelector("#settings-sub-tab-security #sec-autolock")), "settings show the security page");
  await page.screenshot({ path: path.join(SHOTS, "desktop-settings-security.png") });
  check((await boot(page)) === "login", "new credentials work after a restart");

  check(errors.length === 0, `no JavaScript errors${errors.length ? ": " + errors.join(" | ") : ""}`);
  await browser.close();
} catch (err) {
  console.error(err);
  failures++;
} finally {
  stop();
}
console.log(failures ? `\n${failures} check(s) failed` : "\nall end-to-end checks passed");
process.exit(failures ? 1 : 0);
