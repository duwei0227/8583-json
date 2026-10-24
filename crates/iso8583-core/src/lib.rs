//! ISO 8583 报文编解码核心。
//!
//! 约束：纯函数、不做任何 IO、不 panic。同一份代码既编译成 WASM 供前端使用，
//! 也可以被桌面端（Tauri）或命令行工具直接依赖。

mod decode;
mod encode;
mod encoding;
pub mod error;
mod field;
pub mod hex;
pub mod message;
pub mod presets;
pub mod spec;
mod tlv;

pub use decode::decode;
pub use encode::encode;
pub use error::{Error, Result};
pub use message::{Decoded, MessageJson, Part, Segment, Warning};
pub use spec::Spec;
