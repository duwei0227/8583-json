// 把编解码结果整理成界面需要的「逐段解析」行和详情面板内容。
import type { Decoded, Segment, Spec } from '../codec'
import type { FieldSpec } from '../codec/types/FieldSpec'
import { fieldMeaning, tlvTagName, transactionName } from './meanings'

export type SegmentKind = 'meta' | 'mti' | 'bitmap' | 'field'

export function segmentKind(id: string): SegmentKind {
  if (id === 'mti') return 'mti'
  if (id === 'bitmap') return 'bitmap'
  return /^\d+$/.test(id) ? 'field' : 'meta'
}

const META_TAGS: Record<string, string> = { len: '长度', tpdu: 'TPDU', header: '报文头', mti: 'MTI', bitmap: '位图' }

export function segmentTag(id: string): string {
  return META_TAGS[id] ?? `F${id}`
}

export const spaced = (hex: string) => hex.match(/.{1,2}/g)?.join(' ') ?? ''
const h4 = (n: number) => '0x' + n.toString(16).toUpperCase().padStart(4, '0')

export function offsetText(s: Segment): string {
  const end = s.offset + s.len - 1
  return `偏移 ${s.offset}–${end}（${h4(s.offset)}–${h4(end)}）· ${s.len} 字节`
}

const LEN_TYPE = { fixed: '定长', llVar: 'LLVAR', lllVar: 'LLLVAR' } as const

export function fieldFormat(f: FieldSpec): string {
  const dots = f.lenType === 'llVar' ? '..' : f.lenType === 'lllVar' ? '...' : ''
  return `${f.kind}${dots}${f.maxLen}`
}

/** 数据部分的长度：数字按位数，字符按个数，二进制按字节。 */
function dataLength(s: Segment, f: FieldSpec): number {
  return f.kind === 'b' ? s.raw.length / 2 : s.value.length
}

export interface SegmentRow {
  id: string
  kind: SegmentKind
  tag: string
  name: string
  format: string
  length: number
  raw: string
  value: string
  meaning: string
}

export function describeSegments(d: Decoded, spec: Spec): SegmentRow[] {
  return d.segments.map((s) => {
    const kind = segmentKind(s.id)
    const base = { id: s.id, kind, tag: segmentTag(s.id), raw: spaced(s.lenPrefix + s.raw) }
    if (kind === 'field') {
      const f = spec.fields[Number(s.id)]
      return { ...base, name: f.name, format: fieldFormat(f), length: dataLength(s, f), value: s.value, meaning: fieldMeaning(Number(s.id), s.value) }
    }
    const meta = describeMeta(s, d)
    return { ...base, name: meta.title, format: meta.format, length: s.len, value: meta.value, meaning: meta.meaning }
  })
}

export interface DetailItem {
  label: string
  value: string
  mono?: boolean
}

export interface DetailOption {
  code: string
  label: string
  current: boolean
}

export interface DetailPart {
  segment: string
  label: string
  value: string
  note: string
  options?: DetailOption[]
}

export interface TlvItem {
  tag: string
  name: string
  length: number
  value: string
}

export interface SegmentDetail {
  title: string
  format: string
  raw: string
  items: DetailItem[]
  partsTitle: string
  parts: DetailPart[]
  tlv: TlvItem[]
}

export function describeDetail(d: Decoded, spec: Spec, id: string): SegmentDetail | null {
  const s = d.segments.find((x) => x.id === id)
  if (!s) return null
  const position: DetailItem = { label: '位置', value: offsetText(s), mono: true }

  if (segmentKind(id) !== 'field') {
    const meta = describeMeta(s, d)
    return {
      title: meta.title,
      format: `${meta.format} · ${s.len} 字节`,
      raw: spaced(s.raw),
      items: [position, ...meta.items],
      partsTitle: meta.partsTitle,
      parts: meta.parts,
      tlv: [],
    }
  }

  const f = spec.fields[Number(id)]
  const len = dataLength(s, f)
  const unit = f.kind === 'b' ? ' 字节' : f.kind === 'n' || f.kind === 'z' ? ' 位' : ' 个字符'
  const sub = f.sub
  return {
    title: `第 ${id} 域 · ${f.name}`,
    format: fieldFormat(f),
    raw: spaced(s.lenPrefix + s.raw),
    items: [
      position,
      { label: '长度形式', value: LEN_TYPE[f.lenType] },
      { label: '长度前缀', value: s.lenPrefix ? `${spaced(s.lenPrefix)}  →  ${len}` : '无（定长）', mono: !!s.lenPrefix },
      { label: '数据长度', value: `${len}${unit}，占 ${s.raw.length / 2} 字节` },
      { label: '编码', value: f.kind === 'b' ? '二进制' : f.kind === 'n' || f.kind === 'z' ? 'BCD' : 'ASCII' },
      { label: '解析值', value: s.value, mono: true },
      { label: '含义', value: fieldMeaning(Number(id), s.value) || '—' },
    ],
    partsTitle: sub?.type === 'positional' ? '子域拆解' : '',
    parts:
      sub?.type === 'positional'
        ? s.parts.map((p) => ({ segment: p.value, label: p.name, value: `${p.value.length} 位`, note: '' }))
        : [],
    tlv:
      sub?.type === 'tlv'
        ? s.parts.map((p) => ({ tag: p.name, name: tlvTagName(p.name), length: p.value.length / 2, value: spaced(p.value) }))
        : [],
  }
}

/** 选中段在位图中的位置说明。 */
export function bitmapNote(d: Decoded, id: string | null): string {
  if (!id) return ''
  if (id === 'bitmap') return `已选中位图本身：着色的格子就是报文中存在的 ${d.bits.filter((b) => b > 1).length} 个域`
  const n = Number(id)
  if (!Number.isInteger(n) || n < 2) return `「${segmentTag(id)}」位于位图之前，不由位图控制`
  const bitmap = d.segments.find((s) => s.id === 'bitmap')?.value ?? ''
  const byteIndex = Math.floor((n - 1) / 8)
  const byte = bitmap.slice(byteIndex * 2, byteIndex * 2 + 2)
  const bin = parseInt(byte, 16).toString(2).padStart(8, '0')
  return `第 ${n} 域 → 位图第 ${byteIndex + 1} 字节 ${byte} = ${bin.slice(0, 4)} ${bin.slice(4)}，从高位数第 ${((n - 1) % 8) + 1} 位为 1`
}

// ---------- 报文头部各段 ----------

interface MetaDescription {
  title: string
  format: string
  value: string
  meaning: string
  items: DetailItem[]
  partsTitle: string
  parts: DetailPart[]
}

const MTI_DIGITS: { label: string; options: Record<string, string>; notes: Record<string, string> }[] = [
  {
    label: '第 1 位 · 版本号',
    options: { '0': '1987 版', '1': '1993 版', '2': '2003 版' },
    notes: { '0': 'ISO 8583:1987，国内银行卡系统和大多数 POS 仍在使用', '1': 'ISO 8583:1993', '2': 'ISO 8583:2003' },
  },
  {
    label: '第 2 位 · 报文类别',
    options: { '1': '授权类', '2': '金融类', '3': '文件操作类', '4': '冲正 / 退单类', '5': '对账类', '6': '管理类', '8': '网络管理类' },
    notes: {
      '1': '只冻结额度、不实际扣款，如预授权', '2': '实际发生资金划转，如消费、取现、退货、余额查询',
      '3': '更新系统文件，如黑名单', '4': '撤销上一笔失败或超时的交易，或发卡方退单', '5': '批结算、对账',
      '6': '管理类通知', '8': '签到、签退、密钥交换、回响测试等，不涉及资金',
    },
  },
  {
    label: '第 3 位 · 报文功能',
    options: { '0': '请求', '1': '请求应答', '2': '通知', '3': '通知应答', '4': '通告' },
    notes: {
      '0': '发起方要求对方处理，并等待应答', '1': '对请求的处理结果，结果看第 39 域应答码',
      '2': '告知对方已发生的事件，需要对方应答确认', '3': '对通知的确认', '4': '仅告知，不需要应答',
    },
  },
  {
    label: '第 4 位 · 报文来源',
    options: { '0': '收单方发起', '1': '收单方重发', '2': '发卡方发起', '3': '发卡方重发', '4': '其他' },
    notes: {
      '0': 'POS、ATM 所属的收单机构首次发送', '1': '收单方没收到应答时重发，内容与原报文相同',
      '2': '发卡行首次发送', '3': '发卡方重发', '4': '其他机构发送',
    },
  },
]

const TERMINAL_STATE: Record<string, string> = { '0': '正常', '1': '测试' }
const PROCESS_REQUIREMENT: Record<string, string> = {
  '0': '无处理要求', '1': '下传终端磁条卡参数', '2': '上传终端磁条卡状态信息', '3': '重新签到',
  '4': '通知终端更新公钥信息', '5': '下载终端 IC 卡参数', '6': 'TMS 参数下载',
}

function describeMeta(s: Segment, d: Decoded): MetaDescription {
  const raw = s.raw
  switch (s.id) {
    case 'len': {
      const total = d.total - s.len
      const declared = Number(s.value)
      const ok = declared === total
      return {
        title: '报文长度头',
        format: s.len === 2 ? 'b16' : 'n4',
        value: s.value,
        meaning: `后续 ${declared} 字节${ok ? '，与实际一致' : `，实际为 ${total} 字节`}`,
        items: [
          { label: '编码', value: s.len === 2 ? '2 字节无符号整数，网络字节序（高字节在前）' : '4 位 ASCII 十进制数字' },
          ...(s.len === 2
            ? [{ label: '计算', value: `0x${raw} = ${parseInt(raw.slice(0, 2), 16)} × 256 + ${parseInt(raw.slice(2), 16)} = ${declared}`, mono: true }]
            : []),
          { label: '校验', value: ok ? `通过：${declared} = 总长 ${d.total} − ${s.len}` : `不一致：声明 ${declared} 字节，实际 ${total} 字节` },
          { label: '说明', value: '不含长度头自身。TCP 收包时先读长度头，再按长度收完整条报文，用来处理粘包和拆包' },
        ],
        partsTitle: '',
        parts: [],
      }
    }
    case 'tpdu': {
      const [id, dst, src] = [raw.slice(0, 2), raw.slice(2, 6), raw.slice(6, 10)]
      return {
        title: 'TPDU 传输协议数据单元',
        format: `n${s.len * 2}`,
        value: `ID ${id} · 目的 ${dst} · 源 ${src}`,
        meaning: '网络路由信息，不属于 ISO 8583 业务数据',
        items: [
          { label: '编码', value: 'BCD，按 2 + 4 + 4 位数字切分' },
          { label: '作用', value: '前置机或网关根据它转发报文，业务系统一般原样回带' },
          { label: '应答', value: `应答报文的 TPDU 应为 ${id}${src}${dst}（目的、源对调）`, mono: true },
        ],
        partsTitle: '逐段拆解',
        parts: [
          { segment: id, label: 'TPDU ID', value: id, note: id === '60' ? '固定为 60，表示这是 TPDU' : '规范要求为 60，请核对' },
          { segment: spaced(dst), label: '目的地址', value: dst, note: '报文要送达的节点地址（NII），前置机据此路由' },
          { segment: spaced(src), label: '源地址', value: src, note: '发出报文的节点地址' },
        ],
      }
    }
    case 'header': {
      const notes: Record<string, (v: string) => string> = {
        终端状态: (v) => TERMINAL_STATE[v] ?? '自定义状态',
        处理要求: (v) => `${PROCESS_REQUIREMENT[v] ?? '自定义要求'}；应答中由主机填写，通知终端下一步动作`,
      }
      return {
        title: '报文头',
        format: `n${s.len * 2}`,
        value: raw,
        meaning: s.parts.map((p) => `${p.name} ${p.value}`).slice(0, 2).join(' · '),
        items: [
          { label: '编码', value: `${s.len} 字节 BCD，展开成 ${s.len * 2} 位数字后按子段切分` },
          { label: '展开', value: raw.split('').join(' '), mono: true },
        ],
        partsTitle: `按数字位拆解（共 ${s.len * 2} 位）`,
        parts: s.parts.map((p) => ({ segment: p.value, label: p.name, value: `${p.value.length} 位`, note: notes[p.name]?.(p.value) ?? '' })),
      }
    }
    case 'mti': {
      const m = s.value
      const name = transactionName(d)
      const isRequest = m[2] === '0' || m[2] === '2'
      return {
        title: 'MTI 报文类型标识',
        format: 'n4',
        value: m,
        meaning: `${MTI_DIGITS[1].options[m[1]] ?? '类别 ' + m[1]}${MTI_DIGITS[2].options[m[2]] ?? ''} · ${name}`,
        items: [
          { label: '编码', value: raw === m ? '2 字节 BCD，每个字节的高 4 位、低 4 位各存 1 位数字' : '4 字节 ASCII 数字' },
          { label: '展开', value: `${spaced(raw)}  →  ${m.split('').join(' ')}  →  ${m}`, mono: true },
          { label: '交易', value: name },
          { label: '配对', value: isRequest ? `对应的应答 MTI 为 ${m.slice(0, 2)}${Number(m[2]) + 1}${m[3]}` : '这是一条应答报文' },
        ],
        partsTitle: '逐位拆解',
        parts: MTI_DIGITS.map((digit, i) => ({
          segment: m[i],
          label: digit.label,
          value: digit.options[m[i]] ?? '保留值',
          note: digit.notes[m[i]] ?? 'ISO 保留，或由私有规范自定义',
          options: Object.entries(digit.options).map(([code, label]) => ({ code, label, current: code === m[i] })),
        })),
      }
    }
    default: {
      const bytes = s.value.match(/.{2}/g) ?? []
      const set = d.bits.filter((b) => b > 1)
      const extended = bytes.length > 8
      return {
        title: extended ? '位图（主位图 + 扩展位图）' : '主位图',
        format: `b${bytes.length * 8}`,
        value: `${set.length} 个域`,
        meaning: `第 1 位为 ${extended ? '1，带扩展位图' : '0，无扩展位图'}`,
        items: [
          { label: '编码', value: `${bytes.length} 字节，每 1 位对应 1 个域` },
          { label: '第 1 位', value: extended ? '1：后面紧跟 8 字节扩展位图（第 65–128 域）' : '0：没有扩展位图，只有第 1–64 域' },
          { label: '置位域', value: set.join(', '), mono: true },
          { label: '读法', value: '每个字节展开成 8 位二进制，从最高位开始依次对应域号；为 1 表示该域存在，随后按域号从小到大读取' },
        ],
        partsTitle: '按字节拆解',
        parts: bytes.map((b, i) => {
          const on = d.bits.filter((n) => Math.floor((n - 1) / 8) === i)
          return {
            segment: `${b} = ${parseInt(b, 16).toString(2).padStart(8, '0')}`,
            label: `域 ${i * 8 + 1}–${i * 8 + 8}`,
            value: on.length ? `置位 ${on.join(', ')}` : '无',
            note: '',
          }
        }),
      }
    }
  }
}
