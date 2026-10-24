/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { initSync } from '../codec/pkg/iso8583'
import type { KeyValueStore, Platform } from '../platform'
import { samples } from '../samples'
import { useMessageStore } from './message'
import { useSpecStore } from './spec'

const memory = new Map<string, unknown>()
const storage: KeyValueStore = {
  get: async <T>(key: string) => memory.get(key) as T | undefined,
  set: async (key, value) => void memory.set(key, structuredClone(value)),
  delete: async (key) => void memory.delete(key),
}
vi.mock('../platform', () => ({ getPlatform: async () => ({ storage }) as unknown as Platform }))

beforeAll(() => {
  initSync({ module: readFileSync(new URL('../codec/pkg/iso8583_bg.wasm', import.meta.url)) })
})

beforeEach(async () => {
  memory.clear()
  setActivePinia(createPinia())
  await useSpecStore().load()
})

describe('message store', () => {
  it('writes parsed JSON in message order, with every field present', () => {
    const message = useMessageStore()
    message.loadSample(samples[0])
    const json = JSON.parse(message.json)
    expect(Object.keys(json)).toEqual(['length', 'tpdu', 'header', 'mti', 'bitmap', 'fields'])
    expect(json.fields).toEqual(samples[0].message.fields)
  })

  it('packs JSON that carries the display-only length and bitmap', () => {
    const message = useMessageStore()
    message.loadSample(samples[0])
    const hex = message.hex
    message.pack()
    expect(message.status.kind).toBe('ok')
    expect(message.hex).toBe(hex)
  })

  it('format reorders keys and pretty-prints JSON alongside HEX', () => {
    const message = useMessageStore()
    message.hex = '0800 2020'
    message.json = '{"fields":{"11":"000001","3":"000000"},"mti":"0800","tpdu":"6000030000"}'
    message.format()
    expect(message.hex).toBe('08 00 20 20')
    expect(message.json).toBe(
      '{\n  "tpdu": "6000030000",\n  "mti": "0800",\n  "fields": {\n    "3": "000000",\n    "11": "000001"\n  }\n}',
    )
  })

  it('leaves invalid JSON untouched when formatting', () => {
    const message = useMessageStore()
    message.json = '{ "mti": '
    message.format()
    expect(message.json).toBe('{ "mti": ')
    expect(message.status.kind).toBe('warn')
  })
})
