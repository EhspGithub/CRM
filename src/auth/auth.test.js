import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs from "sql.js";
import { createSqlJsDriver } from "../db/drivers/sqljs.js";
import { Store } from "../db/store.js";
import { Auth, FREE_ATTEMPTS, normalizeRecoveryCode, generateRecoveryCode, validateNewCredentials } from "./auth.js";

let SQL, store, clock;
const auth = () => new Auth(store, { now: () => clock, iterations: 1000 });

beforeEach(async () => {
  SQL = SQL || (await initSqlJs());
  store = new Store(createSqlJsDriver(SQL));
  await store.migrate();
  clock = 1_000_000;
});

describe("auth", () => {
  it("starts unconfigured, then setup stores only hashes", async () => {
    const a = auth();
    await a.load();
    expect(a.isConfigured()).toBe(false);
    const code = await a.setup("  Admin ", "secret123");
    expect(code).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    const raw = JSON.stringify(await store.getAuth());
    expect(raw).not.toContain("secret123");
    expect(raw).not.toContain(normalizeRecoveryCode(code));
    const b = auth();
    await b.load();
    expect(b.isConfigured()).toBe(true);
    expect(b.username).toBe("Admin");
  });

  it("logs in with the right credentials (username case/space/digit-insensitive)", async () => {
    const a = auth();
    await a.load();
    await a.setup("دکتر۱", "secret123");
    expect((await a.login("دکتر1 ", "secret123")).ok).toBe(true);
    expect((await a.login("دکتر1", "wrong")).ok).toBe(false);
    expect((await a.login("other", "secret123")).ok).toBe(false);
  });

  it("throttles repeated failures, persisted across restarts", async () => {
    const a = auth();
    await a.load();
    await a.setup("admin", "secret123");
    for (let i = 0; i < FREE_ATTEMPTS - 1; i++) expect((await a.login("admin", "x")).waitMs).toBe(0);
    const fifth = await a.login("admin", "x");
    expect(fifth.waitMs).toBe(30000);
    const b = auth(); // "restart"
    await b.load();
    const blocked = await b.login("admin", "secret123");
    expect(blocked).toMatchObject({ ok: false, reason: "locked" });
    clock += 30001;
    expect((await b.login("admin", "secret123")).ok).toBe(true);
    expect((await store.getAuth()).failedAttempts).toBe(0);
  });

  it("lock time grows with each further failure and is capped", async () => {
    const a = auth();
    await a.load();
    await a.setup("admin", "secret123");
    let last = 0;
    for (let i = 0; i < 20; i++) {
      clock += 16 * 60 * 1000;
      last = (await a.login("admin", "x")).waitMs;
    }
    expect(last).toBe(15 * 60 * 1000);
  });

  it("recovery code resets the credentials once and is replaced", async () => {
    const a = auth();
    await a.load();
    const code = await a.setup("admin", "secret123");
    expect((await a.resetWithRecovery("AAAA-AAAA-AAAA-AAAA", "admin", "newpass1")).ok).toBe(false);
    const res = await a.resetWithRecovery(code.toLowerCase().replace(/-/g, " "), "مدیر", "newpass1");
    expect(res.ok).toBe(true);
    expect(res.recoveryCode).not.toBe(code);
    expect((await a.login("مدیر", "newpass1")).ok).toBe(true);
    expect((await a.resetWithRecovery(code, "x1x", "another1")).ok).toBe(false); // old code no longer works
    expect((await a.resetWithRecovery(res.recoveryCode, "admin", "another1")).ok).toBe(true);
  });

  it("changing credentials and regenerating the code require the current password", async () => {
    const a = auth();
    await a.load();
    await a.setup("admin", "secret123");
    expect((await a.changeCredentials("wrong", "admin", "newpass1")).ok).toBe(false);
    expect((await a.changeCredentials("secret123", "boss", "newpass1")).ok).toBe(true);
    expect((await a.login("boss", "newpass1")).ok).toBe(true);
    expect((await a.regenerateRecoveryCode("secret123")).ok).toBe(false);
    const r = await a.regenerateRecoveryCode("newpass1");
    expect((await a.resetWithRecovery(r.recoveryCode, "boss", "third123")).ok).toBe(true);
  });

  it("auto-lock minutes default to 15 and are clamped", async () => {
    const a = auth();
    await a.load();
    await a.setup("admin", "secret123");
    expect(a.autoLockMinutes).toBe(15);
    expect(await a.setAutoLockMinutes(0)).toBe(0);
    expect(await a.setAutoLockMinutes(9999)).toBe(240);
  });

  it("credentials are not part of the data stores (backups/restores never touch them)", async () => {
    const a = auth();
    await a.load();
    await a.setup("admin", "secret123");
    await store.replaceAll({ patients: [], settings: [{ id: "main", data: {} }] });
    const b = auth();
    await b.load();
    expect(b.isConfigured()).toBe(true);
  });

  it("validation and code generation", () => {
    expect(validateNewCredentials("ab", "secret123")).toMatch(/۳/);
    expect(validateNewCredentials("admin", "123")).toMatch(/حداقل/);
    expect(validateNewCredentials("admin", "secret123", "secret124")).toMatch(/یکسان/);
    expect(validateNewCredentials("admin", "secret123", "secret123")).toBeNull();
    const codes = new Set(Array.from({ length: 200 }, generateRecoveryCode));
    expect(codes.size).toBe(200);
    for (const c of codes) expect(c).not.toMatch(/[01OIL]/);
  });
});
