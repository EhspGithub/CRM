//! Automatic JSON backup snapshots kept next to the database (app data folder / `backups`).
//!
//! The UI writes a full JSON export after changes; only the newest `keep` files are retained.
//! File names are generated here (never taken from the UI) and validated on read, so the UI cannot
//! reach files outside the snapshot folder.

use serde::Serialize;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const PREFIX: &str = "nasim-auto-";
const SUFFIX: &str = ".json";

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotInfo {
    pub name: String,
    pub size_bytes: u64,
    /// Unix time in milliseconds when the snapshot was taken (parsed from the file name).
    pub taken_at_ms: u64,
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// `nasim-auto-<13 digit ms>.json` -> ms. Anything else is not one of our snapshots.
fn parse_name(name: &str) -> Option<u64> {
    let digits = name.strip_prefix(PREFIX)?.strip_suffix(SUFFIX)?;
    if digits.is_empty() || digits.len() > 20 || !digits.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    digits.parse().ok()
}

/// Writes a snapshot atomically (temp file + rename) and prunes old ones. Returns the new file's path.
pub fn write_snapshot(dir: &Path, content: &str, keep: usize) -> io::Result<PathBuf> {
    fs::create_dir_all(dir)?;
    // always newer than every existing snapshot: two writes within one millisecond (or a clock that
    // stepped backwards) must neither overwrite each other nor sort as "older" and get pruned at once
    let latest = list_snapshots(dir)?.first().map(|s| s.taken_at_ms + 1).unwrap_or(0);
    let ms = now_ms().max(latest);
    let path = dir.join(format!("{PREFIX}{ms:013}{SUFFIX}"));
    let tmp = dir.join(format!(".{PREFIX}{ms:013}.tmp"));
    fs::write(&tmp, content.as_bytes())?;
    fs::rename(&tmp, &path)?;
    prune(dir, keep)?;
    Ok(path)
}

/// Newest first.
pub fn list_snapshots(dir: &Path) -> io::Result<Vec<SnapshotInfo>> {
    let mut out = Vec::new();
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(out),
        Err(e) => return Err(e),
    };
    for entry in entries {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if let Some(taken_at_ms) = parse_name(&name) {
            let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
            out.push(SnapshotInfo { name, size_bytes, taken_at_ms });
        }
    }
    out.sort_by_key(|s| std::cmp::Reverse(s.taken_at_ms));
    Ok(out)
}

pub fn read_snapshot(dir: &Path, name: &str) -> io::Result<String> {
    if parse_name(name).is_none() || name.contains(['/', '\\']) {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "invalid snapshot name"));
    }
    fs::read_to_string(dir.join(name))
}

fn prune(dir: &Path, keep: usize) -> io::Result<()> {
    for old in list_snapshots(dir)?.into_iter().skip(keep) {
        fs::remove_file(dir.join(old.name))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_lists_newest_first_and_prunes() {
        let d = tempfile::tempdir().unwrap();
        for i in 0..5 {
            write_snapshot(d.path(), &format!("{{\"n\":{i}}}"), 3).unwrap();
        }
        let list = list_snapshots(d.path()).unwrap();
        assert_eq!(list.len(), 3);
        assert!(list[0].taken_at_ms > list[2].taken_at_ms);
        assert_eq!(read_snapshot(d.path(), &list[0].name).unwrap(), "{\"n\":4}");
        // no temp files left behind
        assert_eq!(fs::read_dir(d.path()).unwrap().count(), 3);
    }

    #[test]
    fn rejects_names_outside_the_snapshot_pattern() {
        let d = tempfile::tempdir().unwrap();
        fs::write(d.path().join("secret.txt"), "x").unwrap();
        for bad in ["secret.txt", "../secret.txt", "nasim-auto-../x.json", "nasim-auto-.json", "nasim-auto-12a.json"] {
            assert!(read_snapshot(d.path(), bad).is_err(), "{bad} should be rejected");
        }
        // foreign files are ignored by listing and never pruned
        write_snapshot(d.path(), "{}", 1).unwrap();
        write_snapshot(d.path(), "{}", 1).unwrap();
        assert_eq!(list_snapshots(d.path()).unwrap().len(), 1);
        assert!(d.path().join("secret.txt").exists());
    }

    #[test]
    fn missing_folder_lists_empty() {
        let d = tempfile::tempdir().unwrap();
        assert!(list_snapshots(&d.path().join("nope")).unwrap().is_empty());
    }
}
