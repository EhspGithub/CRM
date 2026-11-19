// SQLite compiled to WASM (sql.js). Used by unit tests (in-memory) and by `npm run dev` in a normal
// browser, so the full UI can be developed and tested without the native app. For dev, an optional
// `onWrite(bytes)` callback receives the database image after writes so it can be kept across reloads.

function isTxControl(sql) {
  const s = sql.trim().toUpperCase();
  if (s.startsWith("BEGIN")) return "begin";
  if (s.startsWith("COMMIT") || s.startsWith("END")) return "end";
  if (s.startsWith("ROLLBACK")) return "end";
  return null;
}

export function createSqlJsDriver(SQL, { data, onWrite } = {}) {
  const db = new SQL.Database(data || undefined);
  let saveTimer = null;
  const scheduleSave = () => {
    if (!onWrite || inTx) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => onWrite(db.export()), 250);
  };
  db.run("PRAGMA foreign_keys = ON");
  let inTx = false;

  const run = (sql, params = []) => {
    const ctl = isTxControl(sql);
    db.run(sql, params);
    if (ctl === "begin") inTx = true;
    if (ctl === "end") inTx = false;
    const rowsAffected = db.getRowsModified();
    const lastInsertId = Number(db.exec("SELECT last_insert_rowid() AS id")[0].values[0][0]);
    scheduleSave();
    return { rowsAffected, lastInsertId };
  };

  const select = (sql, params = []) => {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  };

  return {
    kind: "sqljs",
    async execute(sql, params) {
      return run(sql, params);
    },
    async select(sql, params) {
      return select(sql, params);
    },
    async batch(statements) {
      const own = !inTx;
      if (own) run("BEGIN IMMEDIATE");
      try {
        const results = statements.map((s) => run(s.sql, s.params || []));
        if (own) run("COMMIT");
        return results;
      } catch (err) {
        if (own) run("ROLLBACK");
        throw err;
      }
    },
    close() {
      db.close();
    },
  };
}
