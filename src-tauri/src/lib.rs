//! Tauri entry point: opens the SQLite database in the app's data folder and exposes it to the UI
//! through a small set of commands. All SQL is built by the UI's data layer with bound parameters.

use nasim_db::snapshots::{self, SnapshotInfo};
use nasim_db::{Db, DbInfo, ExecResult, Statement};
use serde::Serialize;
use serde_json::{Map, Value};
use std::path::PathBuf;
use tauri::Manager;

/// How many automatic JSON snapshots are kept in `<app data>/backups`.
const SNAPSHOTS_TO_KEEP: usize = 40;

struct AppDb(Db);
struct BackupDir(PathBuf);

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[tauri::command]
async fn db_execute(state: tauri::State<'_, AppDb>, sql: String, params: Vec<Value>) -> CmdResult<ExecResult> {
    state.0.execute(&sql, &params).map_err(err)
}

#[tauri::command]
async fn db_select(state: tauri::State<'_, AppDb>, sql: String, params: Vec<Value>) -> CmdResult<Vec<Map<String, Value>>> {
    state.0.select(&sql, &params).map_err(err)
}

#[tauri::command]
async fn db_batch(state: tauri::State<'_, AppDb>, statements: Vec<Statement>) -> CmdResult<Vec<ExecResult>> {
    state.0.batch(&statements).map_err(err)
}

/// Called once when the UI starts: undoes a transaction a previous (reloaded/crashed) UI left open.
#[tauri::command]
async fn db_recover(state: tauri::State<'_, AppDb>) -> CmdResult<bool> {
    state.0.recover().map_err(err)
}

#[tauri::command]
async fn db_info(state: tauri::State<'_, AppDb>) -> CmdResult<DbInfo> {
    state.0.info().map_err(err)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SnapshotWritten {
    name: String,
    folder: String,
}

#[tauri::command]
async fn backup_snapshot(dir: tauri::State<'_, BackupDir>, content: String) -> CmdResult<SnapshotWritten> {
    let path = snapshots::write_snapshot(&dir.0, &content, SNAPSHOTS_TO_KEEP).map_err(err)?;
    Ok(SnapshotWritten {
        name: path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
        folder: dir.0.display().to_string(),
    })
}

#[tauri::command]
async fn backup_list(dir: tauri::State<'_, BackupDir>) -> CmdResult<Vec<SnapshotInfo>> {
    snapshots::list_snapshots(&dir.0).map_err(err)
}

#[tauri::command]
async fn backup_read(dir: tauri::State<'_, BackupDir>, name: String) -> CmdResult<String> {
    snapshots::read_snapshot(&dir.0, &name).map_err(err)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Windows: %APPDATA%\com.nasimrahayi.clinic ; Android: the app's private data directory
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let db = Db::open(dir.join("nasim.db"))?;
            app.manage(AppDb(db));
            app.manage(BackupDir(dir.join("backups")));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db_execute,
            db_select,
            db_batch,
            db_recover,
            db_info,
            backup_snapshot,
            backup_list,
            backup_read
        ])
        .run(tauri::generate_context!())
        .expect("error while running Nasim Rahayi");
}
