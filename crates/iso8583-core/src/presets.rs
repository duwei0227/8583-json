//! 内置规范。规范文件编译进库，Web 和桌面端拿到的是同一份。

use crate::{Error, Result, Spec};

const CUP_POS: &str = include_str!("../presets/cup_pos.json");

/// 内置规范的标识，第一个为默认规范。
pub const NAMES: &[&str] = &["cup_pos"];

/// 内置规范的原始 JSON 文本。
pub fn json(name: &str) -> Result<&'static str> {
    match name {
        "cup_pos" => Ok(CUP_POS),
        _ => Err(Error::UnknownPreset(name.to_string())),
    }
}

/// 解析后的内置规范。
pub fn load(name: &str) -> Result<Spec> {
    Ok(serde_json::from_str(json(name)?)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::spec::{FieldKind, LenType, LengthHeader, SubSpec};

    #[test]
    fn every_preset_parses_and_validates() {
        for name in NAMES {
            let spec = load(name).unwrap_or_else(|e| panic!("{name}: {e}"));
            assert_eq!(spec.validate(), Vec::<String>::new(), "{name}");
        }
    }

    #[test]
    fn validate_reports_inconsistent_settings() {
        let mut spec = load("cup_pos").unwrap();
        spec.name = " ".into();
        spec.frame.header.parts[0].len = 3;
        let pan = spec.fields.get_mut(&2).unwrap();
        pan.max_len = 120;
        spec.fields.get_mut(&64).unwrap().max_len = 60;
        spec.fields.get_mut(&48).unwrap().sub = Some(SubSpec::Tlv);

        let problems = spec.validate();
        let has = |text: &str| problems.iter().any(|p| p.contains(text));
        assert!(has("规范名称不能为空"), "{problems:?}");
        assert!(has("报文头子段共 13 位"), "{problems:?}");
        assert!(has("第 2 域：LLVAR 最大长度不能超过 99"), "{problems:?}");
        assert!(has("第 64 域：b 型定长按 bit 计"), "{problems:?}");
        assert!(has("第 48 域：只有 b 型域可以按 TLV 拆解"), "{problems:?}");
    }

    #[test]
    fn cup_pos_matches_prototype() {
        let spec = load("cup_pos").unwrap();
        assert_eq!(spec.name, "银联 POS");
        assert_eq!(spec.fields.len(), 32);
        assert_eq!(spec.frame.length_header, LengthHeader::Binary2);
        assert_eq!(spec.frame.tpdu_len, 5);
        assert_eq!(spec.frame.header.len, 6);
        let header_digits: u16 = spec.frame.header.parts.iter().map(|p| p.len).sum();
        assert_eq!(header_digits, 12);

        let pan = &spec.fields[&2];
        assert_eq!(
            (pan.kind, pan.max_len, pan.len_type),
            (FieldKind::N, 19, LenType::LlVar)
        );
        assert_eq!(spec.fields[&55].sub, Some(SubSpec::Tlv));
        assert_eq!(spec.fields[&64].kind, FieldKind::B);
    }

    #[test]
    fn unknown_preset_is_an_error() {
        assert!(matches!(load("nope"), Err(Error::UnknownPreset(_))));
    }
}
