//! 报文规范模型。规范以 JSON 导入导出，字段名用 camelCase，供前端直接使用。

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Spec {
    /// 规范文件格式版本，从 1 开始；不兼容变更时递增。
    pub schema: u32,
    pub name: String,
    pub frame: FrameSpec,
    /// 第 2–128 域的定义，键为域号。
    pub fields: BTreeMap<u8, FieldSpec>,
}

/// 数据域之前的报文结构：长度头、TPDU、报文头、MTI、位图。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct FrameSpec {
    pub length_header: LengthHeader,
    /// TPDU 字节数，0 表示没有 TPDU。
    pub tpdu_len: u8,
    pub header: HeaderSpec,
    pub mti_encoding: NumEncoding,
    pub bitmap_encoding: BitmapEncoding,
    /// 变长域长度前缀的编码。
    pub len_prefix_encoding: NumEncoding,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum LengthHeader {
    None,
    /// 2 字节二进制，大端序。
    Binary2,
    /// 4 位 ASCII 十进制数字。
    Ascii4,
}

/// 报文头：按 BCD 展开成数字后，依次切分成若干子段。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct HeaderSpec {
    /// 报文头字节数，0 表示没有报文头。
    pub len: u8,
    pub parts: Vec<SubField>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum NumEncoding {
    Bcd,
    Ascii,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum BitmapEncoding {
    /// 8 或 16 字节二进制。
    Binary,
    /// 16 或 32 个 ASCII 十六进制字符。
    AsciiHex,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct FieldSpec {
    pub name: String,
    pub kind: FieldKind,
    /// 最大长度：b 型定长按 bit 计，b 型变长按字节计，其余按位数或字符数计。
    pub max_len: u16,
    pub len_type: LenType,
    /// 不填时按类型取默认补位规则（见 [`Pad::default_for`]）。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub pad: Option<Pad>,
    /// 子域结构，例如 55 域的 TLV、60 域的定长子域。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub sub: Option<SubSpec>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum FieldKind {
    /// 数字，BCD 压缩。
    N,
    /// 磁道数据，BCD 压缩，分隔符 `=` 编码为半字节 `D`。
    Z,
    /// 字母和数字，ASCII。
    An,
    /// 字母、数字和特殊字符，ASCII。
    Ans,
    /// 二进制。
    B,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum LenType {
    Fixed,
    /// 长度前缀 2 位数字（BCD 时 1 字节）。
    LlVar,
    /// 长度前缀 3 位数字（BCD 时 2 字节）。
    LllVar,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum Pad {
    LeftZero,
    RightZero,
    RightF,
    RightSpace,
}

impl Pad {
    /// 银联 POS 的惯例：定长数字左补 0，变长数字奇数位右补 0，定长字符右补空格。
    pub fn default_for(kind: FieldKind, len_type: LenType) -> Option<Pad> {
        match (kind, len_type) {
            (FieldKind::N | FieldKind::Z, LenType::Fixed) => Some(Pad::LeftZero),
            (FieldKind::N | FieldKind::Z, _) => Some(Pad::RightZero),
            (FieldKind::An | FieldKind::Ans, LenType::Fixed) => Some(Pad::RightSpace),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "camelCase")]
#[ts(export)]
pub enum SubSpec {
    /// BER-TLV，例如 55 域 IC 卡数据。
    Tlv,
    /// 按位数依次切分，例如 60 域的交易类型码、批次号、网管码。
    Positional { parts: Vec<SubField> },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SubField {
    pub name: String,
    /// 位数（数字）或字符数。
    pub len: u16,
}
