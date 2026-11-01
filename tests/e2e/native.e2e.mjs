// End-to-end test of the INSTALLED-APP code paths (Tauri) in Chrome, without building the native app:
// `window.__TAURI_INTERNALS__.invoke` is replaced by a bridge to this Node process, which plays the Rust
// side — the same SQL on SQLite (sql.js, with the same transaction rules as src-tauri), the restore-point
// folder, and the native open/save dialogs (backed by an in-memory "disk").
// Checks: empty first run + welcome, data in SQLite, automatic restore points, native backup export,
// restore through the native open dialog, restore from a restore point, CSV export through "Save as".
//   CHROME_PATH=/usr/bin/google-chrome npm run test:native
import { spawn } from "node:child_process";
import fs from "node:fs";
import puppeteer from "puppeteer-core";
import initSqlJs from "sql.js";
import { createSqlJsDriver } from "../../src/db/drivers/sqljs.js";

const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const PORT = 4174;
const URL = `http://localhost:${PORT}/`;
let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "✔" : "✘"} ${msg}`);
  if (!ok) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));


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

// ---------- the fake "Rust side" ----------
const SQL = await initSqlJs();
const driver = createSqlJsDriver(SQL);
const snapshots = new Map(); // name -> content
const disk = new Map(); // path -> content (files the user saved / opens)
let nextOpenPath = null;
let lastSnapMs = 0;

async function handle(cmd, args, headers) {
  switch (cmd) {
    case "db_execute": return driver.execute(args.sql, args.params);
    case "db_select": return driver.select(args.sql, args.params);
    case "db_batch": return driver.batch(args.statements);
    case "db_recover": return false;
    case "db_info": return { path: "C:\\Users\\clinic\\AppData\\Roaming\\com.nasimrahayi.clinic\\nasim.db", sizeBytes: 123456, schemaVersion: 1, sqliteVersion: "3.x (test)" };
    case "backup_snapshot": {
      lastSnapMs = Math.max(Date.now(), lastSnapMs + 1);
      const name = `nasim-auto-${String(lastSnapMs).padStart(13, "0")}.json`;
      snapshots.set(name, args.content);
      return { name, folder: "backups" };
    }
    case "backup_list":
      return [...snapshots.entries()].map(([name, c]) => ({ name, sizeBytes: c.length, takenAtMs: Number(name.match(/\d+/)[0]) })).sort((a, b) => b.takenAtMs - a.takenAtMs);
    case "backup_read": return snapshots.get(args.name);
    case "plugin:dialog|save": return "C:\\Users\\clinic\\Desktop\\" + (args.options.defaultPath || "file.txt");
    case "plugin:dialog|open": return nextOpenPath;
    case "plugin:fs|write_text_file": disk.set(decodeURIComponent(headers.path), args); return null;
    case "plugin:fs|read_text_file": return [...Buffer.from(disk.get(args.path) || "", "utf8")];
    default: throw new Error("unexpected command " + cmd);
  }
}

fs.mkdirSync("e2e-shots", { recursive: true });
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(URL)).ok) break; } catch {}
    await sleep(500);
  }
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/favicon/.test(m.text()) && errors.push(m.text()));
  await page.exposeFunction("__nodeInvoke", async (cmd, args, headers) => {
    try { return { ok: await handle(cmd, args, headers) }; } catch (e) { return { err: String(e.message || e) }; }
  });
  await page.evaluateOnNewDocument(() => {
    window.__TAURI_INTERNALS__ = {
      async invoke(cmd, args, options) {
        // plugin-fs sends file content as raw bytes
        const payload = args instanceof Uint8Array ? new TextDecoder().decode(args) : args;
        const res = await window.__nodeInvoke(cmd, payload, options && options.headers);
        if (res.err) throw new Error(res.err);
        return res.ok;
      },
      transformCallback: () => 0,
    };
  });
  await page.setViewport({ width: 1366, height: 860 });
  const boot = async () => {
    await page.goto(URL, { waitUntil: "networkidle0" });
    await passGate(page);
    await page.waitForFunction(() => !document.getElementById("nr-splash") && window.patients, { timeout: 30000 });
    await sleep(300);
  };

  // ---------- first run ----------
  await boot();
  const first = await page.evaluate(() => ({
    native: window.NR_NATIVE,
    patients: window.patients.length,
    welcome: !document.getElementById("custom-alert-modal").classList.contains("hidden") && document.getElementById("custom-alert-title").textContent,
    folderBtn: !!document.getElementById("btn-change-backup-folder"),
    status: document.getElementById("sidebar-backup-status").textContent,
  }));
  check(first.native, "runs in native mode");
  check(first.patients === 0, "installed app starts with an empty database (no demo patients)");
  check(/خوش آمدید/.test(first.welcome || ""), "first run shows the migration guide");
  check(!first.folderBtn, "browser-only backup-folder button is removed");
  check(/دیتابیس/.test(first.status), `sidebar shows database status (${first.status})`);
  await page.evaluate(() => closeCustomAlert());

  // ---------- restore an old-version backup through the native open dialog ----------
  const backup = await (async () => {
    const pts = Array.from({ length: 30 }, (_, i) => ({ id: `B-${i}`, code: 1000 + i, fullName: `مراجع ${i}`, nationalId: "", phone: "0912000000" + (i % 10), status: "فعال", attendance: "منظم", initialDrug: "اپیوم", initialDosage: 10, currentDrug: "اپیوم", currentDosage: 10, medHistory: [], insurance: "دارد", substance: "تریاک", admissionDate: "1403/01/01", age: 40, gender: "مرد" }));
    return { patients: pts, visits: [], contactLogs: [], insuranceHistory: [], auditLogs: [], backupHistory: [], patientReviews: [], settings: { clinicName: "نسیم رهایی", displayTitle: "سامانه نسیم رهایی" }, staff: { doctors: ["دکتر حسن‌پور"], psychologists: ["خانم ابراهیمی"] } };
  })();
  disk.set("C:\\backup\\nasim_rahayi_backup_old.json", JSON.stringify(backup));
  nextOpenPath = "C:\\backup\\nasim_rahayi_backup_old.json";
  await page.evaluate(() => switchTab("settings"));
  await page.evaluate(() => switchSettingsSubTab("data"));
  await page.click("#import-json-file-settings"); // native open dialog instead of the browser file picker
  await page.waitForFunction(() => !document.getElementById("merge-mode-modal").classList.contains("hidden"), { timeout: 5000 });
  check(true, "file input opens the native dialog and feeds the restore flow");
  await page.evaluate(() => confirmFullRestore());
  await page.waitForFunction(() => !document.getElementById("custom-confirm-modal").classList.contains("hidden"));
  await page.evaluate(() => closeCustomConfirm(true));
  await sleep(1200);
  const rows = (await driver.select("SELECT COUNT(*) AS n FROM patients"))[0].n;
  check(rows === 30, `restored backup is written to the SQLite database (${rows} rows)`);
  check(snapshots.size >= 1, "a restore point was taken before the restore replaced data");

  // ---------- a change creates an automatic restore point ----------
  const before = snapshots.size;
  await page.evaluate(() => inlineUpdateAttendance("B-3", "نامنظم"));
  await sleep(5000);
  check(snapshots.size === before + 1, "automatic restore point written a few seconds after a change");
  const latest = JSON.parse([...snapshots.values()].pop());
  check(latest.patients.find((p) => p.id === "B-3").attendance === "نامنظم", "restore point contains the latest data");
  const data = await driver.select("SELECT json_extract(data, '$.attendance') AS a FROM patients WHERE id = 'B-3'");
  check(data[0].a === "نامنظم", "the change itself is stored in SQLite immediately");

  // ---------- manual backup export goes through the native Save dialog ----------
  await page.evaluate(() => exportDatabase());
  await sleep(800);
  const saved = [...disk.keys()].find((k) => /nasim_rahayi_backup_\d+_\d+\.json$/.test(k));
  check(!!saved && JSON.parse(disk.get(saved)).patients.length === 30, "manual backup is saved as a complete JSON file via the native dialog");

  // ---------- Excel (CSV) export: <a download> becomes a native Save ----------
  await page.evaluate(() => { openExcelExportModal(); generateExcelExport(); });
  await sleep(800);
  const csv = [...disk.keys()].find((k) => k.endsWith(".csv"));
  check(!!csv && disk.get(csv).includes("مراجع 3"), "CSV export is saved through the native dialog");

  // ---------- database card + restore from a restore point ----------
  await page.evaluate(() => { switchTab("settings"); switchSettingsSubTab("data"); });
  await sleep(600);
  const card = await page.evaluate(() => document.getElementById("native-storage-card").textContent);
  check(/نقاط بازگشت خودکار/.test(card) && /nasim\.db/.test(card), "settings show the database file and restore points");
  await page.screenshot({ path: "e2e-shots/native-settings-data.png" }).catch(() => {});
  await page.evaluate(() => deletePatientRecord("B-0"));
  await page.evaluate(() => closeCustomConfirm(true));
  await sleep(300);
  const newest = [...snapshots.keys()].sort().pop(); // taken before the delete, so it still has B-0
  await page.evaluate((n) => nrRestoreSnapshot(n), newest);
  await page.waitForFunction(() => !document.getElementById("merge-mode-modal").classList.contains("hidden"), { timeout: 5000 });
  await page.evaluate(() => startSmartMerge());
  await sleep(1500);
  const back = (await driver.select("SELECT COUNT(*) AS n FROM patients WHERE id = 'B-0'"))[0].n;
  check(back === 1, "a deleted patient is brought back by merging a restore point");

  // ---------- reload keeps everything ----------
  await boot();
  check(await page.evaluate(() => window.patients.length === 30 && !window.__nrFirstRun), "after restarting, the data is loaded from SQLite (no welcome, no demo data)");

  check(errors.length === 0, `no JavaScript errors${errors.length ? ": " + errors.join(" | ") : ""}`);
  await browser.close();
} catch (err) {
  console.error(err);
  failures++;
} finally {
  server.kill();
}
console.log(failures ? `\n${failures} check(s) failed` : "\nall native-mode checks passed");
process.exit(failures ? 1 : 0);
