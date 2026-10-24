use thiserror::Error;

pub type Result<T> = std::result::Result<T, Error>;

/// 所有错误都尽量带上字节偏移和域号，方便界面精确提示。
#[derive(Debug, Error)]
pub enum Error {
    #[error("{what} 越界：偏移 {offset}，需要 {need} 字节，剩余 {left} 字节")]
    OutOfBounds {
        what: String,
        offset: usize,
        need: usize,
        left: usize,
    },

    #[error("十六进制输入无效：{0}")]
    InvalidHex(String),

    #[error("规范 JSON 无效：{0}")]
    InvalidSpec(#[from] serde_json::Error),

    #[error("未知的内置规范：{0}")]
    UnknownPreset(String),

    #[error("尚未实现：{0}")]
    NotImplemented(&'static str),
}
