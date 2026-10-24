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

    /// 解析报文头部（长度头、MTI、位图等）时出错。
    #[error("偏移 {offset}：{reason}")]
    Decode { offset: usize, reason: String },

    /// 解析某个数据域时出错。
    #[error("第 {id} 域（偏移 {offset}）：{reason}")]
    FieldAt {
        id: u8,
        offset: usize,
        reason: String,
    },

    /// 组包时某个数据域的值不符合规范。
    #[error("第 {id} 域：{reason}")]
    Field { id: u8, reason: String },

    /// 组包时报文整体不符合规范（MTI、TPDU、报文头等）。
    #[error("{0}")]
    Encode(String),
}
