// Platform abstraction: one API for the installed app (Windows/Android via Tauri) and a plain browser.
// Inside native webviews, <a download>, <input type=file> and window.print() behave differently (or not at
// all on Android), so files go through the native open/save dialogs here.
import { isTauri } from "../db/index.js";

export { isTauri };
export const isAndroid = () => /Android/i.test(navigator.userAgent);

async function nativeInvoke(cmd, args) {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke(cmd, args);
}

const extOf = (name) => (String(name).split(".").pop() || "").toLowerCase();
const FILTER_NAMES = { json: "فایل پشتیبان (JSON)", csv: "فایل اکسل (CSV)", html: "صفحه HTML" };

/**
 * Lets the user pick where to save a text file, then writes it.
 * @returns {Promise<boolean>} true if saved, false if the user cancelled.
 */
export async function saveTextFile({ defaultName, content, filters, mime = "text/plain" }) {
  if (isTauri()) {
    const [{ save }, { writeTextFile }] = await Promise.all([import("@tauri-apps/plugin-dialog"), import("@tauri-apps/plugin-fs")]);
    const ext = extOf(defaultName);
    const path = await save({ defaultPath: defaultName, filters: filters || (ext ? [{ name: FILTER_NAMES[ext] || ext, extensions: [ext] }] : undefined) });
    if (!path) return false;
    // On Android `path` is a content:// URI from the system file picker; plugin-fs writes it via ContentResolver.
    await writeTextFile(path, content);
    return true;
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** Lets the user pick a text file; returns { name, content } or null if cancelled. */
export async function openTextFile({ extensions = ["json"] } = {}) {
  if (isTauri()) {
    const [{ open }, { readTextFile }] = await Promise.all([import("@tauri-apps/plugin-dialog"), import("@tauri-apps/plugin-fs")]);
    const path = await open({ multiple: false, directory: false, filters: [{ name: FILTER_NAMES[extensions[0]] || extensions.join(", "), extensions }] });
    if (!path) return null;
    const content = await readTextFile(path);
    const name = decodeURIComponent(String(path).split(/[\\/]/).pop() || `file.${extensions[0]}`);
    return { name: /\.[a-z0-9]+$/i.test(name) ? name : `${name}.${extensions[0]}`, content };
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = extensions.map((e) => `.${e}`).join(",");
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      file.text().then((content) => resolve({ name: file.name, content }), reject);
    };
    input.click();
  });
}

// ---- native-only services (Rust commands in src-tauri/src/lib.rs) ----
export const dbInfo = () => nativeInvoke("db_info");
export const backupSnapshot = (content) => nativeInvoke("backup_snapshot", { content });
export const backupList = () => nativeInvoke("backup_list");
export const backupRead = (name) => nativeInvoke("backup_read", { name });
