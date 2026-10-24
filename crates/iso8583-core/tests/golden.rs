//! 黄金样例：与前端共用 `src/samples/samples.json`，保证两端结果逐字节一致。

use iso8583_core::{decode, encode, hex, presets, MessageJson};
use serde::Deserialize;

#[derive(Deserialize)]
struct Sample {
    key: String,
    message: MessageJson,
    hex: String,
}

fn samples() -> Vec<Sample> {
    serde_json::from_str(include_str!("../../../src/samples/samples.json")).unwrap()
}

#[test]
fn every_sample_encodes_to_expected_hex() {
    let spec = presets::load("cup_pos").unwrap();
    for s in samples() {
        let bytes = encode(&s.message, &spec).unwrap_or_else(|e| panic!("{}: {e}", s.key));
        assert_eq!(hex::encode(&bytes), s.hex, "{}", s.key);
    }
}

#[test]
fn every_sample_decodes_back_to_its_message() {
    let spec = presets::load("cup_pos").unwrap();
    for s in samples() {
        let decoded = decode(&hex::parse(&s.hex).unwrap(), &spec)
            .unwrap_or_else(|e| panic!("{}: {e}", s.key));
        assert_eq!(decoded.to_message(), s.message, "{}", s.key);
        assert!(
            decoded.warnings.is_empty(),
            "{}: {:?}",
            s.key,
            decoded.warnings
        );

        // 各段首尾相接，正好覆盖整条报文
        let mut offset = 0;
        for seg in &decoded.segments {
            assert_eq!(seg.offset, offset, "{} 段 {}", s.key, seg.id);
            offset += seg.len;
        }
        assert_eq!(offset, decoded.total, "{}", s.key);
    }
}

#[test]
fn sale_sample_is_explained_segment_by_segment() {
    let spec = presets::load("cup_pos").unwrap();
    let sale = samples().into_iter().find(|s| s.key == "sale").unwrap();
    let d = decode(&hex::parse(&sale.hex).unwrap(), &spec).unwrap();

    let seg = |id: &str| d.segments.iter().find(|s| s.id == id).unwrap();
    assert_eq!(d.total, 210);
    assert_eq!(seg("len").value, "208");
    assert_eq!(seg("bitmap").raw, "702406C020C09A11");
    assert_eq!(
        d.bits,
        vec![2, 3, 4, 11, 14, 22, 23, 25, 26, 35, 41, 42, 49, 52, 53, 55, 60, 64]
    );

    // 与逐段讲解里的偏移一致：F22 位于 0x30–0x31
    assert_eq!((seg("22").offset, seg("22").len), (0x30, 2));
    assert_eq!(seg("2").len_prefix, "19");

    let header: Vec<_> = seg("header")
        .parts
        .iter()
        .map(|p| p.value.as_str())
        .collect();
    assert_eq!(header, ["60", "31", "0", "0", "000000"]);

    let mti: Vec<_> = seg("mti").parts.iter().map(|p| p.value.as_str()).collect();
    assert_eq!(mti, ["0", "2", "0", "0"]);

    let tlv = &seg("55").parts;
    assert_eq!(tlv.len(), 12);
    assert_eq!(
        (tlv[0].name.as_str(), tlv[0].value.as_str()),
        ("9F26", "A1B2C3D4E5F60718")
    );

    let f60: Vec<_> = seg("60").parts.iter().map(|p| p.value.as_str()).collect();
    assert_eq!(f60, ["22", "000001", "000", "6", "0", "0"]);
}
