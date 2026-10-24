/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { initSync } from '../codec/pkg/iso8583'
import type { KeyValueStore, Platform } from '../platform'
import { useSpecStore } from './spec'

// 内存版存储，替代 IndexedDB / Tauri store
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

beforeEach(() => {
  memory.clear()
  setActivePinia(createPinia())
})

describe('spec store', () => {
  it('seeds the built-in preset and uses it by default', async () => {
    const spec = useSpecStore()
    await spec.load()
    expect(spec.entries.map((e) => e.id)).toEqual(['preset:cup_pos'])
    expect(spec.current?.name).toBe('银联 POS')
    expect(spec.fieldCount).toBe(32)
  })

  it('edits a draft and only writes it back when valid', async () => {
    const spec = useSpecStore()
    await spec.load()
    spec.startEdit()
    spec.edit((s) => (s.fields[2].maxLen = 120))
    expect(spec.dirty).toBe(true)
    expect(spec.draftProblems[0]).toContain('LLVAR 最大长度不能超过 99')
    expect(await spec.apply()).not.toEqual([])
    expect(spec.current?.fields[2].maxLen).toBe(19)

    spec.edit((s) => (s.fields[2].maxLen = 18))
    expect(await spec.apply()).toEqual([])
    expect(spec.current?.fields[2].maxLen).toBe(18)
    expect(spec.dirty).toBe(false)
  })

  it('restores a preset to its original definition', async () => {
    const spec = useSpecStore()
    await spec.load()
    spec.startEdit()
    spec.removeField(64)
    await spec.apply()
    spec.resetDraftToPreset()
    await spec.apply()
    expect(spec.fieldCount).toBe(32)
  })

  it('creates, persists and deletes user specs', async () => {
    const first = useSpecStore()
    await first.load()
    await first.create('某银行 ATM')
    expect(first.current?.name).toBe('某银行 ATM')

    setActivePinia(createPinia())
    const reloaded = useSpecStore()
    await reloaded.load()
    expect(reloaded.entries).toHaveLength(2)
    expect(reloaded.current?.name).toBe('某银行 ATM')

    await reloaded.remove(reloaded.currentId)
    expect(reloaded.entries).toHaveLength(1)
    expect(reloaded.currentId).toBe('preset:cup_pos')
    await reloaded.remove('preset:cup_pos')
    expect(reloaded.entries).toHaveLength(1)
  })

  it('rejects invalid imports and accepts exported specs', async () => {
    const spec = useSpecStore()
    await spec.load()
    expect((await spec.importJson('{ "name": '))[0]).toContain('规范 JSON 无效')

    const exported = JSON.parse(spec.exportJson())
    exported.name = '导入的规范'
    expect(await spec.importJson(JSON.stringify(exported))).toEqual([])
    expect(spec.current?.name).toBe('导入的规范')
  })
})
