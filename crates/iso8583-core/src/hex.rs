//! 十六进制文本与字节互转。输入允许夹带空格和换行（用户常从日志里直接复制）。

use crate::{Error, Result};

/// 解析十六进制文本，忽略所有空白字符。
pub fn parse(text: &str) -> Result<Vec<u8>> {
    let digits: Vec<u8> = text.bytes().filter(|b| !b.is_ascii_whitespace()).collect();
    if digits.is_empty() {
        return Err(Error::InvalidHex("请输入十六进制报文".into()));
    }
    if !digits.len().is_multiple_of(2) {
        return Err(Error::InvalidHex(format!(
            "共 {} 个十六进制字符，为奇数，报文不完整",
            digits.len()
        )));
    }
    digits
        .chunks(2)
        .enumerate()
        .map(|(i, pair)| match (nibble(pair[0]), nibble(pair[1])) {
            (Some(hi), Some(lo)) => Ok(hi << 4 | lo),
            _ => Err(Error::InvalidHex(format!(
                "第 {} 字节「{}」不是十六进制",
                i,
                String::from_utf8_lossy(pair)
            ))),
        })
        .collect()
}

/// 字节转大写十六进制，不带分隔符。
pub fn encode(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789ABCDEF";
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(DIGITS[(b >> 4) as usize] as char);
        out.push(DIGITS[(b & 0x0F) as usize] as char);
    }
    out
}

fn nibble(c: u8) -> Option<u8> {
    match c {
        b'0'..=b'9' => Some(c - b'0'),
        b'a'..=b'f' => Some(c - b'a' + 10),
        b'A'..=b'F' => Some(c - b'A' + 10),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_with_whitespace_and_mixed_case() {
        assert_eq!(parse("00 d0\n60 0A").unwrap(), vec![0x00, 0xD0, 0x60, 0x0A]);
    }

    #[test]
    fn round_trips() {
        let bytes = [0x02, 0x00, 0x70, 0x24, 0xFF];
        assert_eq!(parse(&encode(&bytes)).unwrap(), bytes);
    }

    #[test]
    fn rejects_odd_length_and_bad_digits() {
        assert!(matches!(parse("ABC"), Err(Error::InvalidHex(_))));
        assert!(matches!(parse("0G"), Err(Error::InvalidHex(_))));
        assert!(matches!(parse("  "), Err(Error::InvalidHex(_))));
    }
}
