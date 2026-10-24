//! 解析结果与 JSON 报文模型。

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// JSON 报文：复制、保存、导入时的公共契约，变更必须向后兼容。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct MessageJson {
    pub mti: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub tpdu: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub header: Option<String>,
    /// 键为域号，值为去补位后的字符串；b 型为大写十六进制。
    pub fields: BTreeMap<u8, String>,
}

/// 一条报文的解析结果。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Decoded {
    /// 报文总字节数。
    pub total: usize,
    /// 按报文顺序排列的所有段，界面的结构色块、逐段解析表、位图联动都基于它。
    pub segments: Vec<Segment>,
    pub mti: String,
    /// 位图中置位的域号（含第 1 位）。
    pub bits: Vec<u8>,
    /// 不中断解析的问题，例如长度头声明值与实际不符。
    pub warnings: Vec<Warning>,
}

impl Decoded {
    /// 转成 JSON 报文：TPDU、报文头取原始十六进制，数据域取解析值。
    pub fn to_message(&self) -> MessageJson {
        let mut message = MessageJson {
            mti: self.mti.clone(),
            tpdu: None,
            header: None,
            fields: BTreeMap::new(),
        };
        for s in &self.segments {
            match s.id.as_str() {
                "tpdu" => message.tpdu = Some(s.raw.clone()),
                "header" => message.header = Some(s.raw.clone()),
                id => {
                    if let Ok(n) = id.parse::<u8>() {
                        message.fields.insert(n, s.value.clone());
                    }
                }
            }
        }
        message
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Segment {
    /// `len` | `tpdu` | `header` | `mti` | `bitmap` | 数据域号（"2".."128"）。
    pub id: String,
    pub offset: usize,
    /// 含长度前缀在内的总字节数。
    pub len: usize,
    /// 长度前缀原始字节（十六进制），定长域为空。
    pub len_prefix: String,
    /// 数据部分原始字节（十六进制）。
    pub raw: String,
    /// 去补位后的值。
    pub value: String,
    /// 子段拆解：报文头子段、MTI 四位、TLV、60 域子域等。
    pub parts: Vec<Part>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Part {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Warning {
    pub offset: usize,
    pub message: String,
}
