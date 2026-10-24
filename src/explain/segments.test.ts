/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { codec, type Decoded, type Spec } from '../codec'
import { initSync } from '../codec/pkg/iso8583'
import { samples } from '../samples'
import { transactionName } from './meanings'
import { bitmapNote, describeDetail, describeSegments } from './segments'

let spec: Spec
const decodeSample = (key: string): Decoded => codec.decode(samples.find((s) => s.key === key)!.hex, spec)

beforeAll(() => {
  initSync({ module: readFileSync(new URL('../codec/pkg/iso8583_bg.wasm', import.meta.url)) })
  spec = codec.preset('cup_pos')
})

describe('segment rows', () => {
  it('lists frame segments before fields, with meanings', () => {
    const rows = describeSegments(decodeSample('sale'), spec)
    expect(rows.map((r) => r.tag).slice(0, 6)).toEqual(['长度', 'TPDU', '报文头', 'MTI', '位图', 'F2'])
    expect(rows).toHaveLength(23)
    const f22 = rows.find((r) => r.id === '22')!
    expect([f22.format, f22.raw, f22.value, f22.meaning]).toEqual(['n3', '00 51', '051', 'IC 卡插卡 · 含 PIN'])
    expect(rows.find((r) => r.id === '4')!.meaning).toBe('¥ 100.00')
    expect(rows.find((r) => r.id === 'len')!.meaning).toBe('后续 208 字节，与实际一致')
  })
})

describe('segment detail', () => {
  it('explains every MTI digit with all possible values', () => {
    const detail = describeDetail(decodeSample('sale'), spec, 'mti')!
    expect(detail.parts.map((p) => p.value)).toEqual(['1987 版', '金融类', '请求', '收单方发起'])
    expect(detail.parts[1].options!.filter((o) => o.current).map((o) => o.code)).toEqual(['2'])
    expect(detail.items.find((i) => i.label === '配对')!.value).toBe('对应的应答 MTI 为 0210')
  })

  it('splits the header and lists TLV tags with names', () => {
    const d = decodeSample('sale')
    const header = describeDetail(d, spec, 'header')!
    expect(header.parts.map((p) => [p.label, p.segment])).toEqual([
      ['应用类别', '60'], ['软件总版本号', '31'], ['终端状态', '0'], ['处理要求', '0'], ['软件分版本号', '000000'],
    ])
    const f55 = describeDetail(d, spec, '55')!
    expect(f55.tlv).toHaveLength(12)
    expect(f55.tlv[0]).toMatchObject({ tag: '9F26', name: '应用密文', length: 8 })
    expect(describeDetail(d, spec, '22')!.items[0].value).toBe('偏移 48–49（0x0030–0x0031）· 2 字节')
  })

  it('locates a field inside the bitmap', () => {
    const d = decodeSample('sale')
    expect(bitmapNote(d, '22')).toBe('第 22 域 → 位图第 3 字节 06 = 0000 0110，从高位数第 6 位为 1')
    expect(bitmapNote(d, 'mti')).toBe('「MTI」位于位图之前，不由位图控制')
  })
})

describe('transaction names', () => {
  it.each([
    ['sale', '消费'], ['resp', '消费应答'], ['void', '消费撤销'], ['refund', '退货'], ['balance', '余额查询'],
    ['preauth', '预授权'], ['complete', '预授权完成'], ['reversal', '冲正'], ['signin', '签到 / 网络管理'],
    ['signoff', '签退'], ['settle', '批结算'],
  ])('%s → %s', (key, name) => {
    expect(transactionName(decodeSample(key))).toBe(name)
  })
})
