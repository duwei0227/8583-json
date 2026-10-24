//! BER-TLV 解析，用于 55 域等 IC 卡数据。

/// 解析 TLV 序列，返回（标签, 值）列表；结构不完整时返回 `None`。
pub(crate) fn parse(data: &[u8]) -> Option<Vec<(Vec<u8>, Vec<u8>)>> {
    let mut items = Vec::new();
    let mut i = 0;
    while i < data.len() {
        // 标签：首字节低 5 位全为 1 时为多字节标签，后续字节最高位为 1 表示还有下一字节
        let tag_start = i;
        let first = *data.get(i)?;
        i += 1;
        if first & 0x1F == 0x1F {
            loop {
                let b = *data.get(i)?;
                i += 1;
                if b & 0x80 == 0 {
                    break;
                }
            }
        }
        let tag = data[tag_start..i].to_vec();

        // 长度：最高位为 0 时即长度本身；否则低 7 位表示后续长度字节数
        let len_byte = *data.get(i)?;
        i += 1;
        let len = if len_byte & 0x80 == 0 {
            len_byte as usize
        } else {
            let n = (len_byte & 0x7F) as usize;
            if n == 0 || n > 3 {
                return None;
            }
            let bytes = data.get(i..i + n)?;
            i += n;
            bytes.iter().fold(0usize, |acc, &b| acc << 8 | b as usize)
        };

        let value = data.get(i..i + len)?.to_vec();
        i += len;
        items.push((tag, value));
    }
    Some(items)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_single_and_multi_byte_tags() {
        let data = [0x9F, 0x26, 0x02, 0xAB, 0xCD, 0x95, 0x01, 0x80];
        let items = parse(&data).unwrap();
        assert_eq!(items[0], (vec![0x9F, 0x26], vec![0xAB, 0xCD]));
        assert_eq!(items[1], (vec![0x95], vec![0x80]));
    }

    #[test]
    fn parses_long_form_length() {
        let mut data = vec![0x91, 0x81, 0x80];
        data.extend([0u8; 0x80]);
        assert_eq!(parse(&data).unwrap()[0].1.len(), 0x80);
    }

    #[test]
    fn rejects_truncated_value() {
        assert!(parse(&[0x9F, 0x26, 0x08, 0x01]).is_none());
        assert!(parse(&[0x9F]).is_none());
    }
}
