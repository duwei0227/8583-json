//! 单个数据域的编解码：长度前缀、按类型编码、补位。

use crate::decode::Cursor;
use crate::encoding::{
    decode_number, effective_pad, encode_number, number_width, pack_bcd, prefix_digits, unpack_bcd,
};
use crate::spec::{FieldKind, FieldSpec, LenType, NumEncoding, Pad};
use crate::{hex, Error, Result};

pub(crate) struct FieldValue {
    pub len_prefix: Vec<u8>,
    pub raw: Vec<u8>,
    pub value: String,
}

pub(crate) fn decode(
    cur: &mut Cursor<'_>,
    id: u8,
    f: &FieldSpec,
    prefix_enc: NumEncoding,
) -> Result<FieldValue> {
    let start = cur.pos();
    let err = |reason: String| Error::FieldAt {
        id,
        offset: start,
        reason,
    };

    let digits = prefix_digits(f.len_type);
    let (len_prefix, len) = if digits == 0 {
        (Vec::new(), f.max_len as usize)
    } else {
        let raw = cur.take(number_width(digits, prefix_enc), || {
            format!("第 {id} 域长度前缀")
        })?;
        let len = decode_number(raw, prefix_enc)
            .ok_or_else(|| err(format!("长度前缀 {} 不是数字", hex::encode(raw))))?;
        if len > f.max_len as usize {
            return Err(err(format!("长度 {len} 超过最大值 {}", f.max_len)));
        }
        (raw.to_vec(), len)
    };

    let nbytes = match f.kind {
        FieldKind::N | FieldKind::Z => len.div_ceil(2),
        FieldKind::An | FieldKind::Ans => len,
        FieldKind::B if f.len_type == LenType::Fixed => {
            if len % 8 != 0 {
                return Err(err(format!("b 型定长 {len} bit 不是 8 的倍数")));
            }
            len / 8
        }
        FieldKind::B => len,
    };
    let raw = cur.take(nbytes, || format!("第 {id} 域"))?.to_vec();

    let value = match f.kind {
        FieldKind::N | FieldKind::Z => {
            let all = unpack_bcd(&raw);
            // 奇数位时多出一个补位半字节：左补位取后 len 位，右补位取前 len 位
            let v = match effective_pad(f.kind, f.len_type, f.pad) {
                Some(Pad::LeftZero) => &all[all.len() - len..],
                _ => &all[..len],
            };
            let valid = v
                .bytes()
                .all(|c| c.is_ascii_digit() || (f.kind == FieldKind::Z && c == b'D'));
            if !valid {
                return Err(err(format!("BCD 数据「{v}」含非数字半字节")));
            }
            if f.kind == FieldKind::Z {
                v.replace('D', "=")
            } else {
                v.to_string()
            }
        }
        // 按 Latin-1 逐字节转字符，保证任意字节都能往返
        FieldKind::An | FieldKind::Ans => raw.iter().map(|&b| b as char).collect(),
        FieldKind::B => hex::encode(&raw),
    };

    Ok(FieldValue {
        len_prefix,
        raw,
        value,
    })
}

pub(crate) fn encode(
    id: u8,
    f: &FieldSpec,
    prefix_enc: NumEncoding,
    value: &str,
) -> Result<Vec<u8>> {
    let err = |reason: String| Error::Field { id, reason };
    let max = f.max_len as usize;
    let fixed = f.len_type == LenType::Fixed;
    let pad = effective_pad(f.kind, f.len_type, f.pad);

    let (len, data) = match f.kind {
        FieldKind::N | FieldKind::Z => {
            let mut v = value.to_ascii_uppercase();
            if f.kind == FieldKind::Z {
                v = v.replace('=', "D");
            }
            let valid = v
                .bytes()
                .all(|c| c.is_ascii_digit() || (f.kind == FieldKind::Z && c == b'D'));
            if !valid {
                return Err(err(match f.kind {
                    FieldKind::N => format!("「{value}」应为数字"),
                    _ => format!("「{value}」只能包含数字和 ="),
                }));
            }
            if v.len() > max {
                return Err(err(format!("长度 {} 超过最大值 {max}", v.len())));
            }
            if fixed {
                v = pad_digits(v, max, pad);
            }
            let len = v.len();
            if len % 2 == 1 {
                v = pad_digits(v, len + 1, pad);
            }
            (len, pack_bcd(&v))
        }
        FieldKind::An | FieldKind::Ans => {
            if !value.bytes().all(|c| (0x20..=0x7E).contains(&c)) {
                return Err(err(format!("「{value}」只能包含可打印 ASCII 字符")));
            }
            if value.len() > max {
                return Err(err(format!("长度 {} 超过最大值 {max}", value.len())));
            }
            let mut v = value.to_string();
            if fixed {
                v = format!("{v:<max$}");
            }
            (v.len(), v.into_bytes())
        }
        FieldKind::B => {
            let bytes = if value.trim().is_empty() {
                Vec::new()
            } else {
                hex::parse(value).map_err(|_| err(format!("「{value}」不是合法的十六进制")))?
            };
            if fixed {
                let need = max / 8;
                if bytes.len() != need {
                    return Err(err(format!(
                        "必须是 {need} 字节，实际 {} 字节",
                        bytes.len()
                    )));
                }
            } else if bytes.len() > max {
                return Err(err(format!("长度 {} 字节超过最大值 {max}", bytes.len())));
            }
            (bytes.len(), bytes)
        }
    };

    let digits = prefix_digits(f.len_type);
    let mut out = Vec::with_capacity(data.len() + 2);
    if digits > 0 {
        if len >= 10usize.pow(digits) {
            return Err(err(format!("长度 {len} 超出 {digits} 位长度前缀的上限")));
        }
        out.extend(encode_number(len, digits, prefix_enc));
    }
    out.extend(data);
    Ok(out)
}

/// 数字补位到 `width` 位：左补 0，或右补 0 / F。
fn pad_digits(v: String, width: usize, pad: Option<Pad>) -> String {
    match pad {
        Some(Pad::RightZero) | Some(Pad::RightSpace) => format!("{v:0<width$}"),
        Some(Pad::RightF) => format!("{v:F<width$}"),
        Some(Pad::LeftZero) | None => format!("{v:0>width$}"),
    }
}
