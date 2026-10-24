//! 随机往返测试：按规范随机生成合法报文，encode → decode 必须还原。

use std::collections::BTreeMap;

use iso8583_core::spec::{FieldKind, LenType, SubSpec};
use iso8583_core::{decode, encode, presets, MessageJson};

/// 固定种子的 xorshift，失败时可按迭代序号复现。
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }
    fn below(&mut self, n: usize) -> usize {
        (self.next() % n as u64) as usize
    }
}

#[test]
fn random_messages_round_trip() {
    let spec = presets::load("cup_pos").unwrap();
    let mut rng = Rng(0x9E37_79B9_7F4A_7C15);

    for iteration in 0..500 {
        let mut fields = BTreeMap::new();
        for (&id, f) in &spec.fields {
            if rng.below(10) >= 4 {
                continue;
            }
            let max = f.max_len as usize;
            let fixed = f.len_type == LenType::Fixed;
            // 定长域取满长：较短的值会被补位，解码后自然不等于原值
            let value = match f.kind {
                FieldKind::N | FieldKind::Z => {
                    let len = if fixed { max } else { rng.below(max + 1) };
                    (0..len)
                        .map(|i| {
                            if f.kind == FieldKind::Z && i > 0 && rng.below(8) == 0 {
                                '='
                            } else {
                                char::from(b'0' + rng.below(10) as u8)
                            }
                        })
                        .collect()
                }
                FieldKind::An | FieldKind::Ans => {
                    let len = if fixed {
                        max
                    } else {
                        rng.below(max.min(40) + 1)
                    };
                    (0..len)
                        .map(|_| char::from(0x21 + rng.below(0x5E) as u8))
                        .collect()
                }
                // 规范声明为 TLV 的域生成合法 TLV，否则解码会如实给出「TLV 结构不完整」的警告
                FieldKind::B if f.sub == Some(SubSpec::Tlv) => (0..rng.below(6))
                    .map(|_| {
                        let n = rng.below(9);
                        let value: String =
                            (0..n).map(|_| format!("{:02X}", rng.below(256))).collect();
                        format!("9F{:02X}{n:02X}{value}", 0x10 + rng.below(0x30))
                    })
                    .collect(),
                FieldKind::B => {
                    let len = if fixed {
                        max / 8
                    } else {
                        rng.below(max.min(64) + 1)
                    };
                    (0..len)
                        .map(|_| format!("{:02X}", rng.below(256)))
                        .collect()
                }
            };
            fields.insert(id, value);
        }
        if fields.is_empty() {
            fields.insert(11, "000001".into());
        }

        let message = MessageJson {
            mti: "0200".into(),
            tpdu: Some("6000030000".into()),
            header: Some("603100000000".into()),
            fields,
        };
        let bytes = encode(&message, &spec).unwrap_or_else(|e| panic!("#{iteration}: {e}"));
        let decoded = decode(&bytes, &spec).unwrap_or_else(|e| panic!("#{iteration}: {e}"));
        assert_eq!(decoded.to_message(), message, "#{iteration}");
        assert!(
            decoded.warnings.is_empty(),
            "#{iteration}: {:?}",
            decoded.warnings
        );
    }
}
