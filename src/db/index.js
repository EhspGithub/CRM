// Opens the database: the native SQLite file inside the app (Windows / Android), or SQLite compiled to
// WebAssembly when the UI runs in a normal browser (`npm run dev`, automated tests).
import { Store } from "./store.js";

export const isTauri = () => typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

async function createDriver() {
  if (isTauri()) {
    const { createTauriDriver } = await import("./drivers/tauri.js");
    return createTauriDriver();
  }
  const [{ default: initSqlJs }, { default: wasmUrl }, { createSqlJsDriver }] = await Promise.all([
    import("sql.js"),
    import("sql.js/dist/sql-wasm.wasm?url"),
    import("./drivers/sqljs.js"),
  ]);
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  // browser mode only: keep the database image across page reloads (one blob in IndexedDB)
  const data = await devStore.load().catch(() => null);
  return createSqlJsDriver(SQL, { data, onWrite: (bytes) => devStore.save(bytes).catch(() => {}) });
}

const devStore = {
  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("nasim-rahayi-dev-sqlite", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("db");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async load() {
    const idb = await this.open();
    return new Promise((resolve, reject) => {
      const r = idb.transaction("db").objectStore("db").get("image");
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  },
  async save(bytes) {
    const idb = await this.open();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction("db", "readwrite");
      tx.objectStore("db").put(bytes, "image");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

export async function openStore() {
  const driver = await createDriver();
  if (driver.recover) await driver.recover();
  const store = new Store(driver);
  await store.migrate();
  return store;
}
