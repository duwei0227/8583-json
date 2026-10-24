/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { samples } from '../samples'
import { initSync } from './pkg/iso8583'
import { codec } from '.'

// 直接加载 wasm-pack 产物，验证 JS 绑定与 Rust 黄金样例结果一致（需先执行 `pnpm wasm`）
beforeAll(() => {
  initSync({ module: readFileSync(new URL('./pkg/iso8583_bg.wasm', import.meta.url)) })
})

describe('codec (WASM)', () => {
  it('loads the built-in UnionPay POS spec', () => {
    expect(codec.presetNames()).toEqual(['cup_pos'])
    expect(Object.keys(codec.preset('cup_pos').fields)).toHaveLength(32)
  })

  it.each(samples.map((s) => [s.title, s] as const))('round-trips %s', (_, sample) => {
    const spec = codec.preset('cup_pos')
    expect(codec.encode(sample.message, spec)).toBe(sample.hex)

    const decoded = codec.decode(sample.hex, spec)
    expect(decoded.mti).toBe(sample.message.mti)
    expect(decoded.warnings).toEqual([])
    const fields = Object.fromEntries(
      decoded.segments.filter((s) => /^\d+$/.test(s.id)).map((s) => [s.id, s.value]),
    )
    expect(fields).toEqual(sample.message.fields)
  })

  it('surfaces Rust errors as JS exceptions with field and offset', () => {
    const spec = codec.preset('cup_pos')
    const truncated = samples[0].hex.slice(0, -4)
    expect(() => codec.decode(truncated, spec)).toThrow(/第 64 域 越界/)
  })
})
