//! 桌面壳：只负责原生能力（窗口、文件、存储、剪贴板）。
//!
//! 编解码在前端通过 WASM 完成，保证与 Web 版结果一致；
//! 原生菜单由前端根据命令注册表生成（见 `src/platform/tauri.ts`）。

use std::path::Path;

use serde::Serialize;
use tauri::{DragDropEvent, Emitter, WindowEvent};

/// 与 Web 端一致的拖入文件大小上限：单条报文远小于此，更大的多半是拖错了文件。
const MAX_DROP_BYTES: u64 = 1024 * 1024;

#[derive(Clone, Serialize)]
struct DroppedFile {
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    bytes: Option<Vec<u8>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

/// 读取用户拖入的文件。只读这一次拖放给出的路径，前端因此不需要任何文件系统读权限。
fn read_dropped(path: &Path) -> DroppedFile {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.display().to_string());
    let result = std::fs::metadata(path).and_then(|meta| {
        if !meta.is_file() {
            return Err(std::io::Error::other("不是文件"));
        }
        if meta.len() > MAX_DROP_BYTES {
            return Err(std::io::Error::other("超过 1 MB，不像是单条报文"));
        }
        std::fs::read(path)
    });
    match result {
        Ok(bytes) => DroppedFile {
            name,
            bytes: Some(bytes),
            error: None,
        },
        Err(e) => DroppedFile {
            error: Some(format!("无法打开 {name}：{e}")),
            name,
            bytes: None,
        },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .on_window_event(|window, event| {
            if let WindowEvent::DragDrop(DragDropEvent::Drop { paths, .. }) = event {
                if let Some(path) = paths.first() {
                    let _ = window.emit("file-dropped", read_dropped(path));
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("启动 8583 ⇄ JSON 失败");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_small_files_and_rejects_large_or_missing_ones() {
        let dir = std::env::temp_dir().join(format!("iso8583-drop-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();

        let small = dir.join("msg.hex");
        std::fs::write(&small, b"0200").unwrap();
        let ok = read_dropped(&small);
        assert_eq!(
            (ok.name.as_str(), ok.bytes.as_deref()),
            ("msg.hex", Some(&b"0200"[..]))
        );

        let large = dir.join("big.bin");
        std::fs::write(&large, vec![0u8; MAX_DROP_BYTES as usize + 1]).unwrap();
        assert!(read_dropped(&large).error.unwrap().contains("超过 1 MB"));

        assert!(read_dropped(&dir.join("missing.bin")).error.is_some());
        assert!(read_dropped(&dir).error.unwrap().contains("不是文件"));
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
