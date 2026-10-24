// 字段值的业务含义与交易名称。只做「翻译」，字节切分由编解码核心负责。
import type { Decoded } from '../codec'

const PROCESSING: Record<string, string> = { '00': '消费', '01': '取现', '03': '预授权', '20': '退货 / 撤销', '31': '余额查询' }
const ENTRY_MODE: Record<string, string> = { '01': '手工输入', '02': '磁条', '05': 'IC 卡插卡', '07': '非接 qPBOC', '98': '非接磁条' }
const PIN_MODE: Record<string, string> = { '0': '未指明', '1': '含 PIN', '2': '不含 PIN' }
const CONDITION: Record<string, string> = { '00': '正常提交', '06': '预授权', '14': '退货', '91': '自助终端' }
const RESPONSE: Record<string, string> = {
  '00': '承兑或交易成功', '05': '不予承兑', '14': '无效卡号', '51': '余额不足', '54': '过期卡',
  '55': '密码错', '91': '发卡方不能操作', '96': '系统故障', '98': '超时未收到应答', A0: 'MAC 校验错',
}
const CURRENCY: Record<string, string> = { '156': '人民币 CNY', '840': '美元 USD', '344': '港币 HKD' }
const TXN_TYPE: Record<string, string> = {
  '00': '管理类', '01': '余额查询', '10': '预授权', '20': '预授权完成', '22': '消费', '23': '消费撤销', '25': '退货',
}
const NET_CODE: Record<string, string> = { '001': '签到·单倍长密钥', '003': '签到·双倍长密钥', '002': '签退', '201': '批结算' }

const money = (s: string) =>
  '¥ ' + (Number(s) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 数据域取值的业务含义；没有可说明的内容时返回空串。 */
export function fieldMeaning(id: number, v: string): string {
  switch (id) {
    case 3:
      return `${PROCESSING[v.slice(0, 2)] ?? '交易类型 ' + v.slice(0, 2)} · 账户类型 ${v.slice(2)}`
    case 4:
      return money(v)
    case 12:
      return `${v.slice(0, 2)}:${v.slice(2, 4)}:${v.slice(4, 6)}`
    case 13:
    case 15:
      return `${v.slice(0, 2)} 月 ${v.slice(2, 4)} 日`
    case 14:
      return `20${v.slice(0, 2)} 年 ${v.slice(2, 4)} 月`
    case 22:
      return `${ENTRY_MODE[v.slice(0, 2)] ?? '方式 ' + v.slice(0, 2)} · ${PIN_MODE[v[2]] ?? ''}`
    case 25:
      return CONDITION[v] ?? ''
    case 26:
      return `PIN 最大 ${Number(v)} 位`
    case 35:
    case 36:
      return '卡号 / 有效期 / 服务码，以 = 分隔'
    case 39:
      return RESPONSE[v] ?? `应答码 ${v}`
    case 48:
      return v.length >= 31
        ? `内卡借记 ${money(v.slice(0, 12))} / ${Number(v.slice(12, 15))} 笔 · 贷记 ${money(v.slice(15, 27))} / ${Number(v.slice(27, 30))} 笔`
        : ''
    case 49:
      return CURRENCY[v] ?? ''
    case 52:
      return 'PIN 密文'
    case 53:
      return `PIN 格式 ${v[0]} · 加密算法 ${v[1]}`
    case 60: {
      const tt = TXN_TYPE[v.slice(0, 2)]
      const nm = NET_CODE[v.slice(8, 11)]
      return (
        `交易类型 ${v.slice(0, 2)}${tt ? `（${tt}）` : ''} · 批次号 ${v.slice(2, 8)}` +
        (v.length > 8 ? ` · 网管码 ${v.slice(8, 11)}${nm ? `（${nm}）` : ''}` : '')
      )
    }
    case 61:
      return (
        `原批次号 ${v.slice(0, 6)} · 原流水号 ${v.slice(6, 12)}` +
        (v.length >= 16 ? ` · 原交易日期 ${v.slice(12, 14)}-${v.slice(14, 16)}` : '')
      )
    case 64:
      return 'MAC'
    default:
      return ''
  }
}

const MTI_NAMES: Record<string, string> = {
  '0100': '预授权', '0110': '预授权应答', '0220': '退货', '0230': '退货应答', '0400': '冲正', '0410': '冲正应答',
  '0500': '批结算', '0510': '批结算应答', '0800': '签到 / 网络管理', '0810': '签到应答', '0820': '签退', '0830': '签退应答',
}

/** 结合 MTI、处理码和服务点条件码判断交易名称。 */
export function transactionName(d: Decoded): string {
  const get = (id: number) => d.segments.find((s) => s.id === String(id))?.value ?? ''
  if (d.mti === '0200' || d.mti === '0210') {
    const base =
      get(25) === '06'
        ? '预授权完成'
        : ({ '00': '消费', '31': '余额查询', '20': '消费撤销', '01': '取现' } as Record<string, string>)[get(3).slice(0, 2)] ??
          '金融交易'
    return d.mti === '0210' ? base + '应答' : base
  }
  return MTI_NAMES[d.mti] ?? `报文 ${d.mti}`
}

const TLV_TAGS: Record<string, string> = {
  '9F26': '应用密文', '9F27': '密文信息数据', '9F10': '发卡行应用数据', '9F37': '不可预知数', '9F36': '应用交易计数器',
  '95': '终端验证结果', '9A': '交易日期', '9C': '交易类型', '9F02': '授权金额', '9F03': '其他金额', '5F2A': '交易货币代码',
  '82': '应用交互特征', '9F1A': '终端国家代码', '9F33': '终端性能', '84': '专用文件名称', '91': '发卡行认证数据',
}

export function tlvTagName(tag: string): string {
  return TLV_TAGS[tag] ?? '未知标签'
}
