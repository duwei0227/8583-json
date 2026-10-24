//! 编码细节：BCD 压缩、数字长度前缀、补位规则。

use crate::spec::{FieldKind, LenType, NumEncoding, Pad};

/// BCD 字节展开为半字节字符串（大写，可能含 A–F，由调用方校验）。
pub(crate) fn unpack_bcd(raw: &[u8]) -> String {
    crate::hex::encode(raw)
}

/// 偶数长度的半字节字符串（0–9、A–F）压缩为 BCD。调用方须先校验字符。
pub(crate) fn pack_bcd(digits: &str) -> Vec<u8> {
    debug_assert!(digits.len().is_multiple_of(2));
    digits
        .as_bytes()
        .chunks(2)
        .map(|pair| nibble(pair[0]) << 4 | nibble(pair[1]))
        .collect()
}

fn nibble(c: u8) -> u8 {
    match c {
        b'0'..=b'9' => c - b'0',
        b'A'..=b'F' => c - b'A' + 10,
        _ => {
            debug_assert!(false, "未校验的半字节字符 {c}");
            0
        }
    }
}

/// 长度前缀的位数：LLVAR 2 位，LLLVAR 3 位，定长没有前缀。
pub(crate) fn prefix_digits(len_type: LenType) -> u32 {
    match len_type {
        LenType::Fixed => 0,
        LenType::LlVar => 2,
        LenType::LllVar => 3,
    }
}

/// 一个 `digits` 位十进制数按 `enc` 编码后占的字节数。
pub(crate) fn number_width(digits: u32, enc: NumEncoding) -> usize {
    match enc {
        NumEncoding::Bcd => digits.div_ceil(2) as usize,
        NumEncoding::Ascii => digits as usize,
    }
}

pub(crate) fn decode_number(raw: &[u8], enc: NumEncoding) -> Option<usize> {
    let text = match enc {
        NumEncoding::Bcd => unpack_bcd(raw),
        NumEncoding::Ascii => std::str::from_utf8(raw).ok()?.to_string(),
    };
    if text.is_empty() || !text.bytes().all(|c| c.is_ascii_digit()) {
        return None;
    }
    text.parse().ok()
}

/// 把 `value` 编码为 `digits` 位十进制数。调用方须保证 `value < 10^digits`。
pub(crate) fn encode_number(value: usize, digits: u32, enc: NumEncoding) -> Vec<u8> {
    let text = format!("{value:0width$}", width = digits as usize);
    match enc {
        NumEncoding::Bcd if text.len() % 2 == 1 => pack_bcd(&format!("0{text}")),
        NumEncoding::Bcd => pack_bcd(&text),
        NumEncoding::Ascii => text.into_bytes(),
    }
}

/// 规范里没写补位时，按类型取默认规则。
pub(crate) fn effective_pad(kind: FieldKind, len_type: LenType, pad: Option<Pad>) -> Option<Pad> {
    pad.or_else(|| Pad::default_for(kind, len_type))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bcd_round_trip() {
        assert_eq!(pack_bcd("0200"), vec![0x02, 0x00]);
        assert_eq!(unpack_bcd(&[0x62, 0x3D]), "623D");
    }

    #[test]
    fn length_prefixes() {
        assert_eq!(encode_number(19, 2, NumEncoding::Bcd), vec![0x19]);
        assert_eq!(encode_number(75, 3, NumEncoding::Bcd), vec![0x00, 0x75]);
        assert_eq!(encode_number(75, 3, NumEncoding::Ascii), b"075".to_vec());
        assert_eq!(decode_number(&[0x00, 0x75], NumEncoding::Bcd), Some(75));
        assert_eq!(decode_number(b"075", NumEncoding::Ascii), Some(75));
        assert_eq!(decode_number(&[0x1A], NumEncoding::Bcd), None);
        assert_eq!(number_width(3, NumEncoding::Bcd), 2);
    }
}
