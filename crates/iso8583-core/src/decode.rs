//! 报文解析：长度头 → TPDU → 报文头 → MTI → 位图 → 各数据域，每段记录偏移。

use crate::encoding::unpack_bcd;
use crate::spec::{BitmapEncoding, LengthHeader, NumEncoding, SubField, SubSpec};
use crate::{field, hex, tlv, Decoded, Error, Part, Result, Segment, Spec, Warning};

/// 带越界检查的读取游标。
pub(crate) struct Cursor<'a> {
    bytes: &'a [u8],
    pos: usize,
}

impl<'a> Cursor<'a> {
    pub(crate) fn new(bytes: &'a [u8]) -> Self {
        Cursor { bytes, pos: 0 }
    }

    pub(crate) fn pos(&self) -> usize {
        self.pos
    }

    pub(crate) fn remaining(&self) -> usize {
        self.bytes.len() - self.pos
    }

    pub(crate) fn take(&mut self, n: usize, what: impl FnOnce() -> String) -> Result<&'a [u8]> {
        if n > self.remaining() {
            return Err(Error::OutOfBounds {
                what: what(),
                offset: self.pos,
                need: n,
                left: self.remaining(),
            });
        }
        let out = &self.bytes[self.pos..self.pos + n];
        self.pos += n;
        Ok(out)
    }
}

pub fn decode(bytes: &[u8], spec: &Spec) -> Result<Decoded> {
    let frame = &spec.frame;
    let total = bytes.len();
    let mut cur = Cursor::new(bytes);
    let mut segments = Vec::new();
    let mut warnings = Vec::new();

    // 长度头
    if frame.length_header != LengthHeader::None {
        let start = cur.pos();
        let width = match frame.length_header {
            LengthHeader::Ascii4 => 4,
            _ => 2,
        };
        let raw = cur.take(width, || "长度头".into())?;
        let declared = match frame.length_header {
            LengthHeader::Ascii4 => crate::encoding::decode_number(raw, NumEncoding::Ascii)
                .ok_or_else(|| Error::Decode {
                    offset: start,
                    reason: "长度头不是 4 位数字".into(),
                })?,
            _ => u16::from_be_bytes([raw[0], raw[1]]) as usize,
        };
        if declared != total - width {
            warnings.push(Warning {
                offset: start,
                message: format!("长度头声明 {declared} 字节，实际 {} 字节", total - width),
            });
        }
        segments.push(segment("len", start, raw, declared.to_string(), Vec::new()));
    }

    // TPDU
    if frame.tpdu_len > 0 {
        let start = cur.pos();
        let raw = cur.take(frame.tpdu_len as usize, || "TPDU".into())?;
        segments.push(segment("tpdu", start, raw, hex::encode(raw), Vec::new()));
    }

    // 报文头：按 BCD 展开后按子段切分
    if frame.header.len > 0 {
        let start = cur.pos();
        let raw = cur.take(frame.header.len as usize, || "报文头".into())?;
        let parts = split(&unpack_bcd(raw), &frame.header.parts);
        segments.push(segment("header", start, raw, hex::encode(raw), parts));
    }

    // MTI
    let start = cur.pos();
    let width = match frame.mti_encoding {
        NumEncoding::Bcd => 2,
        NumEncoding::Ascii => 4,
    };
    let raw = cur.take(width, || "MTI".into())?;
    let mti = match frame.mti_encoding {
        NumEncoding::Bcd => unpack_bcd(raw),
        NumEncoding::Ascii => raw.iter().map(|&b| b as char).collect(),
    };
    if mti.len() != 4 || !mti.bytes().all(|c| c.is_ascii_digit()) {
        return Err(Error::Decode {
            offset: start,
            reason: format!("MTI「{mti}」不是 4 位数字，请检查长度头、TPDU、报文头设置"),
        });
    }
    let mti_parts = ["版本", "类别", "功能", "来源"]
        .iter()
        .zip(mti.chars())
        .map(|(name, c)| Part {
            name: name.to_string(),
            value: c.to_string(),
        })
        .collect();
    segments.push(segment("mti", start, raw, mti.clone(), mti_parts));

    // 位图：第 1 位为 1 时后面紧跟扩展位图
    let start = cur.pos();
    let (raw, bitmap) = read_bitmap(&mut cur, frame.bitmap_encoding)?;
    let bits: Vec<u8> = bitmap
        .iter()
        .enumerate()
        .flat_map(|(i, &byte)| {
            (0..8)
                .filter(move |j| byte & (0x80 >> j) != 0)
                .map(move |j| (i * 8 + j + 1) as u8)
        })
        .collect();
    segments.push(segment(
        "bitmap",
        start,
        &raw,
        hex::encode(&bitmap),
        Vec::new(),
    ));

    // 数据域
    for &id in bits.iter().filter(|&&b| b > 1) {
        let start = cur.pos();
        let f = spec.fields.get(&id).ok_or_else(|| Error::FieldAt {
            id,
            offset: start,
            reason: "当前规范未定义该域".into(),
        })?;
        let v = field::decode(&mut cur, id, f, frame.len_prefix_encoding)?;
        let parts = match &f.sub {
            Some(SubSpec::Tlv) => match tlv::parse(&v.raw) {
                Some(items) => items
                    .into_iter()
                    .map(|(tag, value)| Part {
                        name: hex::encode(&tag),
                        value: hex::encode(&value),
                    })
                    .collect(),
                None => {
                    warnings.push(Warning {
                        offset: start,
                        message: format!("第 {id} 域不是完整的 TLV 结构"),
                    });
                    Vec::new()
                }
            },
            Some(SubSpec::Positional { parts }) => split(&v.value, parts),
            None => Vec::new(),
        };
        segments.push(Segment {
            id: id.to_string(),
            offset: start,
            len: cur.pos() - start,
            len_prefix: hex::encode(&v.len_prefix),
            raw: hex::encode(&v.raw),
            value: v.value,
            parts,
        });
    }

    if cur.remaining() > 0 {
        warnings.push(Warning {
            offset: cur.pos(),
            message: format!("报文末尾有 {} 字节未解析", cur.remaining()),
        });
    }

    Ok(Decoded {
        total,
        segments,
        mti,
        bits,
        warnings,
    })
}

/// 返回（原始字节，位图字节）；ASCII HEX 编码时两者不同。
fn read_bitmap(cur: &mut Cursor<'_>, enc: BitmapEncoding) -> Result<(Vec<u8>, Vec<u8>)> {
    let mut raw = Vec::new();
    let mut bitmap = Vec::new();
    for (i, what) in ["位图", "扩展位图"].into_iter().enumerate() {
        if i == 1 && bitmap[0] & 0x80 == 0 {
            break;
        }
        let start = cur.pos();
        match enc {
            BitmapEncoding::Binary => {
                let chunk = cur.take(8, || what.into())?;
                raw.extend_from_slice(chunk);
                bitmap.extend_from_slice(chunk);
            }
            BitmapEncoding::AsciiHex => {
                let chunk = cur.take(16, || what.into())?;
                let text: String = chunk.iter().map(|&b| b as char).collect();
                let parsed = hex::parse(&text).map_err(|_| Error::Decode {
                    offset: start,
                    reason: format!("{what}「{text}」不是十六进制字符"),
                })?;
                raw.extend_from_slice(chunk);
                bitmap.extend(parsed);
            }
        }
    }
    Ok((raw, bitmap))
}

/// 按子段长度依次切分；值不够长时最后一段取剩余部分，之后的子段省略。
fn split(value: &str, parts: &[SubField]) -> Vec<Part> {
    let chars: Vec<char> = value.chars().collect();
    let mut pos = 0;
    let mut out = Vec::new();
    for p in parts {
        if pos >= chars.len() {
            break;
        }
        let end = (pos + p.len as usize).min(chars.len());
        out.push(Part {
            name: p.name.clone(),
            value: chars[pos..end].iter().collect(),
        });
        pos = end;
    }
    out
}

fn segment(id: &str, offset: usize, raw: &[u8], value: String, parts: Vec<Part>) -> Segment {
    Segment {
        id: id.to_string(),
        offset,
        len: raw.len(),
        len_prefix: String::new(),
        raw: hex::encode(raw),
        value,
        parts,
    }
}
