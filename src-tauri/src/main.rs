// Windows wrapper: shows dist/index.html (built from src/) (the whole clinic app) in a WebView2 window.
// Data lives in the WebView's IndexedDB under %LOCALAPPDATA%\com.nasimrahayi.clinic.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Nasim Rahayi");
}
