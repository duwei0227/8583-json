//! `iso8583-core` 的 WASM 封装，Web 端和桌面端的前端共用。
//!
//! 规范和 JSON 报文以字符串传入，解析结果以 JS 对象返回（结构见 `src/codec/types`）。

use iso8583_core::{hex, presets, MessageJson, Spec};
use wasm_bindgen::prelude::*;

fn js_err(e: impl std::fmt::Display) -> JsError {
    JsError::new(&e.to_string())
}

/// 编解码核心的版本号。
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// 内置规范标识列表，第一个为默认规范。
#[wasm_bindgen(js_name = presetNames)]
pub fn preset_names() -> Vec<String> {
    presets::NAMES.iter().map(|s| s.to_string()).collect()
}

/// 内置规范的 JSON 文本。
#[wasm_bindgen]
pub fn preset(name: &str) -> Result<String, JsError> {
    presets::json(name).map(str::to_string).map_err(js_err)
}

/// 解析十六进制报文，返回 `Decoded`。
#[wasm_bindgen]
pub fn decode(hex_text: &str, spec_json: &str) -> Result<JsValue, JsError> {
    let spec: Spec = serde_json::from_str(spec_json).map_err(js_err)?;
    let bytes = hex::parse(hex_text).map_err(js_err)?;
    let decoded = iso8583_core::decode(&bytes, &spec).map_err(js_err)?;
    serde_wasm_bindgen::to_value(&decoded).map_err(js_err)
}

/// 把 JSON 报文组包，返回大写十六进制文本。
#[wasm_bindgen]
pub fn encode(message_json: &str, spec_json: &str) -> Result<String, JsError> {
    let spec: Spec = serde_json::from_str(spec_json).map_err(js_err)?;
    let message: MessageJson = serde_json::from_str(message_json).map_err(js_err)?;
    let bytes = iso8583_core::encode(&message, &spec).map_err(js_err)?;
    Ok(hex::encode(&bytes))
}
