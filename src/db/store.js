// Record store on top of SQLite. It offers the same four operations the original IndexedDB version of the
// app used (getAll / put / putAll / delete per store), so the clinic UI's business logic is unchanged while
// every record now lives in a real database file.
//
// All operations go through one queue: writes are applied strictly in the order the UI issued them (the UI
// often fires a write without awaiting it and immediately issues the next one), and every read sees all
// writes issued before it.
import { STORES, MIGRATIONS, SCHEMA_VERSION } from "./schema.js";

export class StoreError extends Error {}

export class Store {
  constructor(driver) {
    this.driver = driver;
    this.queue = Promise.resolve();
    // FileSystemDirectoryHandle objects (browser-only "backup folder" feature) can't be serialised into SQL
    this.memoryStores = { appHandles: new Map() };
  }

  /** Runs `fn` after everything queued before it; a failure does not block later operations. */
  enqueue(fn) {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {});
    return run;
  }

  async migrate() {
    const [{ user_version: current }] = await this.driver.select("PRAGMA user_version");
    if (current > SCHEMA_VERSION) {
      throw new StoreError(`این دیتابیس با نسخه جدیدتری از برنامه ساخته شده (نسخه ساختار ${current}). لطفاً برنامه را به‌روز کنید.`);
    }
    for (let v = current; v < SCHEMA_VERSION; v++) {
      const statements = MIGRATIONS[v].map((sql) => ({ sql, params: [] }));
      statements.push({ sql: `PRAGMA user_version = ${v + 1}`, params: [] });
      await this.driver.batch(statements);
    }
  }

  def(storeName) {
    const def = STORES[storeName];
    if (!def) throw new StoreError(`Unknown store: ${storeName}`);
    return def;
  }

  upsert(storeName, record) {
    const { table, columns } = this.def(storeName);
    if (!record || typeof record !== "object" || record.id === undefined || record.id === null || record.id === "") {
      throw new StoreError(`Record without id cannot be saved to ${storeName}`);
    }
    const cols = Object.keys(columns);
    const names = ["id", ...cols, "data", "updated_at"];
    const params = [String(record.id), ...cols.map((c) => columns[c](record)), JSON.stringify(record), Date.now()];
    return {
      sql: `INSERT INTO ${table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})
            ON CONFLICT(id) DO UPDATE SET ${names.slice(1).map((n) => `${n} = excluded.${n}`).join(", ")}`,
      params,
    };
  }

  getAll(storeName) {
    if (this.memoryStores[storeName]) return Promise.resolve([...this.memoryStores[storeName].values()]);
    const { table } = this.def(storeName);
    return this.enqueue(async () => {
      const rows = await this.driver.select(`SELECT data FROM ${table} ORDER BY id`);
      return rows.map((r) => JSON.parse(r.data));
    });
  }

  put(storeName, record) {
    if (this.memoryStores[storeName]) {
      this.memoryStores[storeName].set(record.id, record);
      return Promise.resolve();
    }
    return this.enqueue(async () => {
      const { sql, params } = this.upsert(storeName, record);
      await this.driver.execute(sql, params);
    });
  }

  /** Replaces the whole store atomically: either all records are saved, or nothing changes. */
  putAll(storeName, records) {
    if (this.memoryStores[storeName]) {
      const m = this.memoryStores[storeName];
      m.clear();
      records.forEach((r) => m.set(r.id, r));
      return Promise.resolve();
    }
    return this.enqueue(async () => {
      const { table } = this.def(storeName);
      // duplicate ids (possible in hand-edited backups) keep the last one, like IndexedDB put() did
      const statements = [{ sql: `DELETE FROM ${table}`, params: [] }, ...records.map((r) => this.upsert(storeName, r))];
      await this.driver.batch(statements);
    });
  }

  /**
   * Replaces several stores in ONE transaction (full restore / smart merge): all tables are rewritten, or —
   * if anything fails — none of them is touched.
   */
  replaceAll(storesToRecords) {
    return this.enqueue(async () => {
      const statements = [];
      for (const [storeName, records] of Object.entries(storesToRecords)) {
        if (this.memoryStores[storeName]) continue;
        const { table } = this.def(storeName);
        statements.push({ sql: `DELETE FROM ${table}`, params: [] });
        for (const r of records || []) statements.push(this.upsert(storeName, r));
      }
      await this.driver.batch(statements);
    });
  }

  delete(storeName, id) {
    if (this.memoryStores[storeName]) {
      this.memoryStores[storeName].delete(id);
      return Promise.resolve();
    }
    const { table } = this.def(storeName);
    return this.enqueue(() => this.driver.execute(`DELETE FROM ${table} WHERE id = ?`, [String(id)]));
  }

  clear(storeName) {
    return this.putAll(storeName, []);
  }

  /** Row counts per table — shown in Settings so the user can see what is in the database. */
  counts() {
    return this.enqueue(async () => {
      const out = {};
      for (const [name, { table }] of Object.entries(STORES)) {
        const [{ n }] = await this.driver.select(`SELECT COUNT(*) AS n FROM ${table}`);
        out[name] = n;
      }
      return out;
    });
  }
}
