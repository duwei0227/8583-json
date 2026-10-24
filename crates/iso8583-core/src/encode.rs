//! 组包：按域号顺序编码各域、生成位图，再拼接报文头部和长度头。

use crate::encoding::pack_bcd;
use crate::spec::{BitmapEncoding, LengthHeader, NumEncoding};
use crate::{field, hex, Error, MessageJson, Result, Spec};

pub fn encode(message: &MessageJson, spec: &Spec) -> Result<Vec<u8>> {
    let frame = &spec.frame;
    let mti = &message.mti;
    if mti.len() != 4 || !mti.bytes().all(|c| c.is_ascii_digit()) {
        return Err(Error::Encode(format!("mti「{mti}」必须是 4 位数字")));
    }
    if message.fields.is_empty() {
        return Err(Error::Encode("fields 中至少需要一个数据域".into()));
    }
    if let Some(&id) = message.fields.keys().find(|&&id| !(2..=128).contains(&id)) {
        let reason = if id == 1 {
            "第 1 位是扩展位图标志，由组包自动生成，不能在 fields 里赋值"
        } else {
            "域号必须在 2–128 之间"
        };
        return Err(Error::Field {
            id,
            reason: reason.into(),
        });
    }

    let extended = message.fields.keys().any(|&id| id > 64);
    let mut bitmap = vec![0u8; if extended { 16 } else { 8 }];
    if extended {
        bitmap[0] |= 0x80;
    }
    let mut body = Vec::new();
    // BTreeMap 已按域号升序排列，正是报文中的顺序
    for (&id, value) in &message.fields {
        let f = spec.fields.get(&id).ok_or_else(|| Error::Field {
            id,
            reason: "当前规范未定义该域".into(),
        })?;
        let bit = (id - 1) as usize;
        bitmap[bit / 8] |= 0x80 >> (bit % 8);
        body.extend(field::encode(id, f, frame.len_prefix_encoding, value)?);
    }

    let mut out = Vec::new();
    if frame.tpdu_len > 0 {
        out.extend(fixed_hex(message.tpdu.as_deref(), frame.tpdu_len, "tpdu")?);
    }
    if frame.header.len > 0 {
        out.extend(fixed_hex(
            message.header.as_deref(),
            frame.header.len,
            "header",
        )?);
    }
    match frame.mti_encoding {
        NumEncoding::Bcd => out.extend(pack_bcd(mti)),
        NumEncoding::Ascii => out.extend(mti.as_bytes()),
    }
    match frame.bitmap_encoding {
        BitmapEncoding::Binary => out.extend(&bitmap),
        BitmapEncoding::AsciiHex => out.extend(hex::encode(&bitmap).into_bytes()),
    }
    out.extend(body);

    let header = match frame.length_header {
        LengthHeader::None => Vec::new(),
        LengthHeader::Binary2 => u16::try_from(out.len())
            .map_err(|_| {
                Error::Encode(format!(
                    "报文 {} 字节，超出 2 字节长度头上限 65535",
                    out.len()
                ))
            })?
            .to_be_bytes()
            .to_vec(),
        LengthHeader::Ascii4 if out.len() > 9999 => {
            return Err(Error::Encode(format!(
                "报文 {} 字节，超出 4 位 ASCII 长度头上限 9999",
                out.len()
            )))
        }
        LengthHeader::Ascii4 => format!("{:04}", out.len()).into_bytes(),
    };
    Ok([header, out].concat())
}

fn fixed_hex(value: Option<&str>, len: u8, name: &str) -> Result<Vec<u8>> {
    let text =
        value.ok_or_else(|| Error::Encode(format!("缺少 {name}（当前规范要求 {len} 字节）")))?;
    let bytes = hex::parse(text)
        .map_err(|_| Error::Encode(format!("{name}「{text}」不是合法的十六进制")))?;
    if bytes.len() != len as usize {
        return Err(Error::Encode(format!(
            "{name} 必须是 {len} 字节，实际 {} 字节",
            bytes.len()
        )));
    }
    Ok(bytes)
}
