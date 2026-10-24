//! 桌面壳：只负责原生能力（窗口、文件、存储、剪贴板）。
//!
//! 编解码在前端通过 WASM 完成，保证与 Web 版结果一致；
//! 原生菜单由前端根据命令注册表生成（见 `src/platform/tauri.ts`）。

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .run(tauri::generate_context!())
        .expect("启动 8583 ⇄ JSON 失败");
}
