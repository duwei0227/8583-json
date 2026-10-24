//! 异常输入：错误必须带上位置信息，且绝不 panic。

use iso8583_core::spec::{BitmapEncoding, LengthHeader, NumEncoding};
use iso8583_core::{decode, encode, presets, Error, MessageJson, Spec};

fn spec() -> Spec {
    presets::load("cup_pos").unwrap()
}

fn sign_in() -> MessageJson {
    serde_json::from_str(
        r#"{"mti":"0800","tpdu":"6000030000","header":"603100000000",
            "fields":{"11":"000124","41":"12345678","42":"123456789012345","60":"00000001003","63":"001"}}"#,
    )
    .unwrap()
}

#[test]
fn truncated_message_reports_field_and_offset() {
    let bytes = encode(&sign_in(), &spec()).unwrap();
    let err = decode(&bytes[..bytes.len() - 2], &spec()).unwrap_err();
    match err {
        Error::OutOfBounds {
            what, need, left, ..
        } => {
            assert_eq!(what, "第 63 域");
            assert_eq!((need, left), (3, 1));
        }
        other => panic!("unexpected {other}"),
    }
}

#[test]
fn wrong_mti_encoding_is_caught_at_the_mti() {
    // BCD 报文按 ASCII 读 MTI 时，读到的是 08 00 70 24，不是数字字符
    let bytes = encode(&sign_in(), &spec()).unwrap();
    let mut ascii_mti = spec();
    ascii_mti.frame.mti_encoding = NumEncoding::Ascii;
    let err = decode(&bytes, &ascii_mti).unwrap_err().to_string();
    assert!(
        err.contains("偏移 13") && err.contains("不是 4 位数字"),
        "{err}"
    );
}

#[test]
fn shifted_frame_surfaces_as_a_located_error() {
    // 少读 TPDU 时后续字节整体错位，错误仍需带出域号和偏移
    let bytes = encode(&sign_in(), &spec()).unwrap();
    let mut no_tpdu = spec();
    no_tpdu.frame.tpdu_len = 0;
    assert!(matches!(
        decode(&bytes, &no_tpdu),
        Err(Error::FieldAt { .. } | Error::OutOfBounds { .. } | Error::Decode { .. })
    ));
}

#[test]
fn undefined_field_is_reported() {
    let bytes = encode(&sign_in(), &spec()).unwrap();
    let mut spec = spec();
    spec.fields.remove(&41);
    assert!(matches!(
        decode(&bytes, &spec),
        Err(Error::FieldAt { id: 41, .. })
    ));
}

#[test]
fn length_prefix_above_maximum_is_rejected() {
    let mut spec = spec();
    spec.fields.get_mut(&60).unwrap().max_len = 10;
    let mut bigger = spec.clone();
    bigger.fields.get_mut(&60).unwrap().max_len = 17;
    let bytes = encode(&sign_in(), &bigger).unwrap();
    let err = decode(&bytes, &spec).unwrap_err().to_string();
    assert!(
        err.contains("第 60 域") && err.contains("超过最大值 10"),
        "{err}"
    );
}

#[test]
fn trailing_bytes_and_length_mismatch_are_warnings() {
    let mut bytes = encode(&sign_in(), &spec()).unwrap();
    bytes.extend([0xAA, 0xBB]);
    let d = decode(&bytes, &spec()).unwrap();
    let messages: Vec<_> = d.warnings.iter().map(|w| w.message.as_str()).collect();
    assert!(messages.iter().any(|m| m.contains("长度头声明")));
    assert!(messages.iter().any(|m| m.contains("末尾有 2 字节")));
}

#[test]
fn encode_rejects_invalid_values() {
    let check = |edit: fn(&mut MessageJson), expect: &str| {
        let mut m = sign_in();
        edit(&mut m);
        let err = encode(&m, &spec()).unwrap_err().to_string();
        assert!(err.contains(expect), "expected「{expect}」in「{err}」");
    };
    check(|m| m.mti = "02X0".into(), "4 位数字");
    check(|m| m.tpdu = None, "缺少 tpdu");
    check(
        |m| {
            m.fields.insert(11, "12A".into());
        },
        "应为数字",
    );
    check(
        |m| {
            m.fields.insert(11, "1234567".into());
        },
        "超过最大值 6",
    );
    check(
        |m| {
            m.fields.insert(1, "x".into());
        },
        "扩展位图",
    );
    check(
        |m| {
            m.fields.insert(64, "ABCD".into());
        },
        "必须是 8 字节",
    );
    check(
        |m| {
            m.fields.insert(41, "终端0001".into());
        },
        "可打印 ASCII",
    );
    check(
        |m| {
            m.fields.insert(5, "1".into());
        },
        "未定义",
    );
}

#[test]
fn garbage_never_panics() {
    let spec = spec();
    let mut seed = 0x2545_F491_4F6C_DD1Du64;
    for len in 0..300 {
        let bytes: Vec<u8> = (0..len)
            .map(|_| {
                seed ^= seed << 13;
                seed ^= seed >> 7;
                seed ^= seed << 17;
                seed as u8
            })
            .collect();
        let _ = decode(&bytes, &spec);
    }
}

#[test]
fn ascii_frame_variants_round_trip() {
    let mut spec = spec();
    spec.frame.length_header = LengthHeader::Ascii4;
    spec.frame.mti_encoding = NumEncoding::Ascii;
    spec.frame.bitmap_encoding = BitmapEncoding::AsciiHex;
    spec.frame.len_prefix_encoding = NumEncoding::Ascii;

    let m = sign_in();
    let bytes = encode(&m, &spec).unwrap();
    assert_eq!(&bytes[..4], format!("{:04}", bytes.len() - 4).as_bytes());
    let d = decode(&bytes, &spec).unwrap();
    assert_eq!(d.to_message(), m);
    assert!(d.warnings.is_empty());
    // 4 字节长度头 + 5 字节 TPDU + 6 字节报文头之后是 ASCII 的 MTI
    assert_eq!(&bytes[15..19], b"0800");
}
