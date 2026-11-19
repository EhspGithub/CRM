import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs from "sql.js";
import { createSqlJsDriver } from "./drivers/sqljs.js";
import { Store } from "./store.js";
import { STORES, SCHEMA_VERSION } from "./schema.js";

let SQL;
async function fresh() {
  SQL = SQL || (await initSqlJs());
  const driver = createSqlJsDriver(SQL);
  const store = new Store(driver);
  await store.migrate();
  return { store, driver };
}

describe("schema", () => {
  it("creates one table per store and records the schema version", async () => {
    const { driver } = await fresh();
    const tables = (await driver.select("SELECT name FROM sqlite_master WHERE type = 'table'")).map((r) => r.name);
    for (const { table } of Object.values(STORES)) expect(tables).toContain(table);
    expect((await driver.select("PRAGMA user_version"))[0].user_version).toBe(SCHEMA_VERSION);
  });

  it("migrating twice is harmless", async () => {
    const { store } = await fresh();
    await store.migrate();
  });

  it("refuses a database made by a newer app version", async () => {
    const { store, driver } = await fresh();
    await driver.execute(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
    await expect(store.migrate()).rejects.toThrow(/نسخه جدیدتری/);
  });
});

describe("store", () => {
  let store, driver;
  beforeEach(async () => ({ store, driver } = await fresh()));

  const patient = (over = {}) => ({
    id: "P-1", code: 1004, fullName: "علیرضا کریمی", nationalId: "0018475293", status: "فعال", currentDrug: "ش متادون",
    medHistory: ["دیابت"], dispenseHistory: [{ id: "d1", quantity: 40 }], _updatedAt: 1, ...over,
  });

  it("round-trips a full record unchanged (nested arrays, Persian text)", async () => {
    await store.put("patients", patient());
    expect(await store.getAll("patients")).toEqual([patient()]);
  });

  it("keeps searchable columns in sync with the record", async () => {
    await store.put("patients", patient());
    await store.put("patients", patient({ code: "1010", status: "غیرفعال" }));
    const [row] = await driver.select("SELECT code, national_id, full_name, status FROM patients");
    expect(row).toEqual({ code: 1010, national_id: "0018475293", full_name: "علیرضا کریمی", status: "غیرفعال" });
  });

  it("returns records ordered by id, like IndexedDB getAll()", async () => {
    for (const id of ["c", "a", "b"]) await store.put("visits", { id, patientId: "P-1", date: "1405/01/01" });
    expect((await store.getAll("visits")).map((v) => v.id)).toEqual(["a", "b", "c"]);
  });

  it("applies un-awaited writes in the order they were issued", async () => {
    // the UI fires writes without awaiting them; a later putAll must not be overtaken by an earlier put
    store.put("patients", patient({ id: "old" }));
    store.putAll("patients", [patient({ id: "x" })]);
    store.put("patients", patient({ id: "y" }));
    store.delete("patients", "x");
    expect((await store.getAll("patients")).map((p) => p.id)).toEqual(["y"]);
  });

  it("putAll is atomic: a bad record leaves the previous data intact", async () => {
    await store.putAll("visits", [{ id: "v1", patientId: "P", date: "x" }]);
    await expect(store.putAll("visits", [{ id: "v2" }, { notAnId: true }])).rejects.toThrow();
    expect((await store.getAll("visits")).map((v) => v.id)).toEqual(["v1"]);
  });

  it("a failed operation does not block later ones", async () => {
    await expect(store.put("patients", {})).rejects.toThrow();
    await store.put("patients", patient());
    expect(await store.getAll("patients")).toHaveLength(1);
  });

  it("stores settings and staff as single 'main' records", async () => {
    await store.put("settings", { id: "main", data: { clinicName: "نسیم رهایی" } });
    await store.put("settings", { id: "main", data: { clinicName: "تغییر" } });
    expect(await store.getAll("settings")).toEqual([{ id: "main", data: { clinicName: "تغییر" } }]);
  });

  it("keeps browser-only folder handles in memory, never in SQL", async () => {
    const handle = { name: "folder", kind: "directory" };
    await store.put("appHandles", { id: "backupFolder", handle });
    expect((await store.getAll("appHandles"))[0].handle).toBe(handle);
    await store.delete("appHandles", "backupFolder");
    expect(await store.getAll("appHandles")).toEqual([]);
  });

  it("restoring a large backup is fast and complete", async () => {
    const many = Array.from({ length: 5000 }, (_, i) => ({ id: `V-${String(i).padStart(5, "0")}`, patientId: `P-${i % 300}`, date: "1405/02/10", notes: "یادداشت" }));
    const t = Date.now();
    await store.putAll("visits", many);
    expect(await store.getAll("visits")).toHaveLength(5000);
    expect(Date.now() - t).toBeLessThan(5000);
    const counts = await store.counts();
    expect(counts.visits).toBe(5000);
    expect(counts.patients).toBe(0);
  });

  it("replaceAll rewrites several stores in one transaction, or none of them", async () => {
    await store.put("patients", patient());
    await store.put("visits", { id: "v1", patientId: "P-1", date: "d" });
    await expect(
      store.replaceAll({ patients: [patient({ id: "P-2" })], visits: [{ id: "v2" }, { broken: true }] }),
    ).rejects.toThrow();
    expect((await store.getAll("patients")).map((p) => p.id)).toEqual(["P-1"]);
    expect((await store.getAll("visits")).map((v) => v.id)).toEqual(["v1"]);
    await store.replaceAll({ patients: [patient({ id: "P-2" })], visits: [], settings: [{ id: "main", data: {} }] });
    expect((await store.getAll("patients")).map((p) => p.id)).toEqual(["P-2"]);
    expect(await store.getAll("visits")).toEqual([]);
  });

  it("rejects unknown stores", async () => {
    expect(() => store.getAll("nope")).toThrow(/Unknown store/);
  });
});
