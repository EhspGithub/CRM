//! SQLite access layer for Nasim Rahayi.
//!
//! The app's data layer (TypeScript/JS, `src/db/`) builds parameterised SQL; this crate executes it on a
//! single connection guarded by a mutex. Parameters and result rows travel as JSON values. It has no
//! Tauri dependency so it can be unit-tested on any host (`cargo test -p nasim-db`).

pub mod snapshots;

use rusqlite::types::{Value as SqlValue, ValueRef};
use rusqlite::{params_from_iter, Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Number, Value as JsonValue};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("{0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("database lock poisoned by an earlier panic")]
    Poisoned,
    #[error("unsupported parameter: {0}")]
    BadParam(String),
}

pub type DbResult<T> = Result<T, DbError>;

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExecResult {
    pub rows_affected: usize,
    pub last_insert_id: i64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Statement {
    pub sql: String,
    #[serde(default)]
    pub params: Vec<JsonValue>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbInfo {
    pub path: String,
    pub size_bytes: u64,
    pub schema_version: i64,
    pub sqlite_version: String,
}

pub struct Db {
    conn: Mutex<Connection>,
    path: Option<PathBuf>,
}

/// JSON -> SQLite. Booleans become 0/1; arrays/objects are stored as JSON text.
fn to_sql(v: &JsonValue) -> DbResult<SqlValue> {
    Ok(match v {
        JsonValue::Null => SqlValue::Null,
        JsonValue::Bool(b) => SqlValue::Integer(i64::from(*b)),
        JsonValue::Number(n) => {
            if let Some(i) = n.as_i64() {
                SqlValue::Integer(i)
            } else if n.is_f64() {
                SqlValue::Real(n.as_f64().unwrap_or(f64::NAN))
            } else {
                // an integer beyond i64 would silently lose precision as a float: refuse it
                return Err(DbError::BadParam(n.to_string()));
            }
        }
        JsonValue::String(s) => SqlValue::Text(s.clone()),
        other => SqlValue::Text(other.to_string()),
    })
}

/// SQLite -> JSON.
fn to_json(v: ValueRef<'_>) -> JsonValue {
    match v {
        ValueRef::Null => JsonValue::Null,
        ValueRef::Integer(i) => JsonValue::Number(i.into()),
        ValueRef::Real(f) => Number::from_f64(f).map(JsonValue::Number).unwrap_or(JsonValue::Null),
        ValueRef::Text(t) => JsonValue::String(String::from_utf8_lossy(t).into_owned()),
        ValueRef::Blob(b) => JsonValue::Array(b.iter().map(|x| JsonValue::Number((*x).into())).collect()),
    }
}

fn configure(conn: &Connection) -> DbResult<()> {
    conn.busy_timeout(Duration::from_secs(5))?;
    // WAL: crash-safe and lets reads proceed during writes; NORMAL sync is durable across app crashes.
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    Ok(())
}

impl Db {
    /// Opens (creating if needed) the database file.
    pub fn open(path: impl AsRef<Path>) -> DbResult<Self> {
        let path = path.as_ref().to_path_buf();
        let conn = Connection::open_with_flags(
            &path,
            OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )?;
        configure(&conn)?;
        Ok(Self { conn: Mutex::new(conn), path: Some(path) })
    }

    pub fn open_in_memory() -> DbResult<Self> {
        let conn = Connection::open_in_memory()?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        Ok(Self { conn: Mutex::new(conn), path: None })
    }

    fn lock(&self) -> DbResult<std::sync::MutexGuard<'_, Connection>> {
        self.conn.lock().map_err(|_| DbError::Poisoned)
    }

    fn exec_on(conn: &Connection, sql: &str, params: &[JsonValue]) -> DbResult<ExecResult> {
        let values = params.iter().map(to_sql).collect::<DbResult<Vec<_>>>()?;
        let mut stmt = conn.prepare_cached(sql)?;
        let rows_affected = stmt.execute(params_from_iter(values.iter()))?;
        Ok(ExecResult { rows_affected, last_insert_id: conn.last_insert_rowid() })
    }

    /// Runs a statement that returns no rows (INSERT/UPDATE/DELETE/DDL/BEGIN/COMMIT/PRAGMA x = y).
    pub fn execute(&self, sql: &str, params: &[JsonValue]) -> DbResult<ExecResult> {
        let conn = self.lock()?;
        Self::exec_on(&conn, sql, params)
    }

    /// Runs a query and returns rows as JSON objects keyed by column name.
    pub fn select(&self, sql: &str, params: &[JsonValue]) -> DbResult<Vec<Map<String, JsonValue>>> {
        let conn = self.lock()?;
        let values = params.iter().map(to_sql).collect::<DbResult<Vec<_>>>()?;
        let mut stmt = conn.prepare_cached(sql)?;
        let names: Vec<String> = stmt.column_names().map(|s| s.to_string()).collect();
        let mut rows = stmt.query(params_from_iter(values.iter()))?;
        let mut out = Vec::new();
        while let Some(row) = rows.next()? {
            let mut obj = Map::with_capacity(names.len());
            for (i, name) in names.iter().enumerate() {
                obj.insert(name.clone(), to_json(row.get_ref(i)?));
            }
            out.push(obj);
        }
        Ok(out)
    }

    /// Runs statements atomically. If the caller already opened a transaction (BEGIN via execute),
    /// the statements join it; otherwise they get their own and roll back together on any error.
    pub fn batch(&self, statements: &[Statement]) -> DbResult<Vec<ExecResult>> {
        let mut conn = self.lock()?;
        if !conn.is_autocommit() {
            return statements.iter().map(|s| Self::exec_on(&conn, &s.sql, &s.params)).collect();
        }
        let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        let results = statements.iter().map(|s| Self::exec_on(&tx, &s.sql, &s.params)).collect::<DbResult<Vec<_>>>()?;
        tx.commit()?;
        Ok(results)
    }

    /// Rolls back a transaction left open by a previous UI session (e.g. the window reloaded mid-transaction).
    /// Returns true if one was rolled back. Called once when the UI starts.
    pub fn recover(&self) -> DbResult<bool> {
        let conn = self.lock()?;
        if conn.is_autocommit() {
            return Ok(false);
        }
        conn.execute_batch("ROLLBACK")?;
        Ok(true)
    }

    pub fn info(&self) -> DbResult<DbInfo> {
        let conn = self.lock()?;
        let schema_version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
        let sqlite_version: String = conn.query_row("SELECT sqlite_version()", [], |r| r.get(0))?;
        let (path, size_bytes) = match &self.path {
            Some(p) => (p.display().to_string(), std::fs::metadata(p).map(|m| m.len()).unwrap_or(0)),
            None => (":memory:".to_string(), 0),
        };
        Ok(DbInfo { path, size_bytes, schema_version, sqlite_version })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn db() -> Db {
        let d = Db::open_in_memory().unwrap();
        d.batch(&[
            Statement { sql: "CREATE TABLE p (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)".into(), params: vec![] },
            Statement { sql: "CREATE TABLE c (id INTEGER PRIMARY KEY AUTOINCREMENT, p_id INTEGER NOT NULL REFERENCES p(id) ON DELETE CASCADE, score REAL, flag INTEGER, data TEXT)".into(), params: vec![] },
        ])
        .unwrap();
        d
    }

    #[test]
    fn insert_returns_last_id_and_rows_round_trip_as_json() {
        let d = db();
        let r = d.execute("INSERT INTO p (name) VALUES (?)", &[json!("قلب")]).unwrap();
        assert_eq!(r, ExecResult { rows_affected: 1, last_insert_id: 1 });
        d.execute("INSERT INTO c (p_id, score, flag, data) VALUES (?, ?, ?, ?)", &[json!(1), json!(2.5), json!(true), json!([1, 2])]).unwrap();
        let rows = d.select("SELECT p.name, c.score, c.flag, c.data, NULL AS missing FROM c JOIN p ON p.id = c.p_id", &[]).unwrap();
        assert_eq!(JsonValue::Object(rows[0].clone()), json!({"name": "قلب", "score": 2.5, "flag": 1, "data": "[1,2]", "missing": null}));
    }

    #[test]
    fn foreign_keys_are_enforced_and_cascade() {
        let d = db();
        assert!(d.execute("INSERT INTO c (p_id) VALUES (?)", &[json!(99)]).is_err());
        d.execute("INSERT INTO p (name) VALUES ('x')", &[]).unwrap();
        d.execute("INSERT INTO c (p_id) VALUES (1)", &[]).unwrap();
        d.execute("DELETE FROM p WHERE id = 1", &[]).unwrap();
        assert_eq!(d.select("SELECT COUNT(*) AS n FROM c", &[]).unwrap()[0]["n"], json!(0));
    }

    #[test]
    fn batch_is_atomic() {
        let d = db();
        let bad = [
            Statement { sql: "INSERT INTO p (name) VALUES (?)".into(), params: vec![json!("a")] },
            Statement { sql: "INSERT INTO p (name) VALUES (?)".into(), params: vec![JsonValue::Null] }, // NOT NULL violation
        ];
        assert!(d.batch(&bad).is_err());
        assert_eq!(d.select("SELECT COUNT(*) AS n FROM p", &[]).unwrap()[0]["n"], json!(0));
    }

    #[test]
    fn batch_joins_an_open_transaction_and_rollback_undoes_both() {
        let d = db();
        d.execute("BEGIN IMMEDIATE", &[]).unwrap();
        d.execute("INSERT INTO p (name) VALUES ('outside batch')", &[]).unwrap();
        d.batch(&[Statement { sql: "INSERT INTO p (name) VALUES ('in batch')".into(), params: vec![] }]).unwrap();
        d.execute("ROLLBACK", &[]).unwrap();
        assert_eq!(d.select("SELECT COUNT(*) AS n FROM p", &[]).unwrap()[0]["n"], json!(0));
    }

    #[test]
    fn recover_rolls_back_a_dangling_transaction() {
        let d = db();
        d.execute("BEGIN IMMEDIATE", &[]).unwrap();
        d.execute("INSERT INTO p (name) VALUES ('half-done')", &[]).unwrap();
        assert!(d.recover().unwrap());
        assert!(!d.recover().unwrap());
        assert_eq!(d.select("SELECT COUNT(*) AS n FROM p", &[]).unwrap()[0]["n"], json!(0));
        d.execute("BEGIN IMMEDIATE", &[]).unwrap(); // a new transaction can start again
        d.execute("COMMIT", &[]).unwrap();
    }

    #[test]
    fn file_database_persists_and_reports_info() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nasim.db");
        {
            let d = Db::open(&path).unwrap();
            d.batch(&[
                Statement { sql: "CREATE TABLE t (v TEXT)".into(), params: vec![] },
                Statement { sql: "INSERT INTO t VALUES (?)".into(), params: vec![json!("ماندگار")] },
                Statement { sql: "PRAGMA user_version = 1".into(), params: vec![] },
            ])
            .unwrap();
        }
        let d = Db::open(&path).unwrap();
        assert_eq!(d.select("SELECT v FROM t", &[]).unwrap()[0]["v"], json!("ماندگار"));
        let info = d.info().unwrap();
        assert_eq!(info.schema_version, 1);
        assert!(info.size_bytes > 0);
        let mode = d.select("PRAGMA journal_mode", &[]).unwrap();
        assert_eq!(mode[0]["journal_mode"], json!("wal"));
    }

    #[test]
    fn rejects_out_of_range_numbers_instead_of_corrupting() {
        let d = db();
        let huge: JsonValue = serde_json::from_str("18446744073709551615").unwrap(); // u64::MAX, not i64
        let err = d.execute("INSERT INTO p (name) VALUES (?)", &[huge]).unwrap_err();
        assert!(matches!(err, DbError::BadParam(_)));
    }
}
