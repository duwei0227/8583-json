//! ISO 8583 报文编解码核心。
//!
//! 约束：纯函数、不做任何 IO、不 panic。同一份代码既编译成 WASM 供前端使用，
//! 也可以被桌面端（Tauri）或命令行工具直接依赖。

pub mod error;
pub mod hex;
pub mod message;
pub mod presets;
pub mod spec;

pub use error::{Error, Result};
pub use message::{Decoded, MessageJson, Part, Segment, Warning};
pub use spec::Spec;

/// 按规范解析一条报文。
///
/// M1 实现：长度头 → TPDU → 报文头 → MTI → 位图 → 各数据域，每段记录偏移。
pub fn decode(_bytes: &[u8], _spec: &Spec) -> Result<Decoded> {
    Err(Error::NotImplemented("decode"))
}

/// 按规范把 JSON 报文组包成字节。
///
/// M1 实现：按域号排序编码各域、生成位图、拼接报文头部和长度头。
pub fn encode(_message: &MessageJson, _spec: &Spec) -> Result<Vec<u8>> {
    Err(Error::NotImplemented("encode"))
}
