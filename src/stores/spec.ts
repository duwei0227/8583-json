import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { codec, type FieldSpec, type Spec } from '../codec'
import { getPlatform } from '../platform'

/** 一套规范。来自内置预设的条目可以修改，也可以随时恢复默认；用户新建或导入的条目可以删除。 */
export interface SpecEntry {
  id: string
  preset?: string
  spec: Spec
}

const ENTRIES_KEY = 'specs'
const CURRENT_KEY = 'currentSpec'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export const useSpecStore = defineStore('spec', () => {
  const entries = ref<SpecEntry[]>([])
  const currentId = ref<string>('')
  /** 域定义面板里编辑的副本；「完成并重新解析」时才写回当前规范。 */
  const draft = ref<Spec | null>(null)
  const dirty = ref(false)

  const currentEntry = computed(() => entries.value.find((e) => e.id === currentId.value) ?? null)
  const current = computed(() => currentEntry.value?.spec ?? null)
  const fieldCount = computed(() => (current.value ? Object.keys(current.value.fields).length : 0))
  const draftProblems = computed(() => (draft.value ? codec.validateSpec(draft.value) : []))

  async function persist() {
    const storage = (await getPlatform()).storage
    await storage.set(ENTRIES_KEY, clone(entries.value))
    await storage.set(CURRENT_KEY, currentId.value)
  }

  /** 读取已保存的规范；缺少的内置预设自动补上。 */
  async function load() {
    const storage = (await getPlatform()).storage
    const saved = (await storage.get<SpecEntry[]>(ENTRIES_KEY)) ?? []
    const missing = codec
      .presetNames()
      .filter((name) => !saved.some((e) => e.preset === name))
      .map((name) => ({ id: `preset:${name}`, preset: name, spec: codec.preset(name) }))
    entries.value = [...missing, ...saved]
    const savedCurrent = await storage.get<string>(CURRENT_KEY)
    currentId.value = entries.value.some((e) => e.id === savedCurrent) ? savedCurrent! : entries.value[0].id
  }

  function startEdit() {
    draft.value = current.value ? clone(current.value) : null
    dirty.value = false
  }

  function discard() {
    startEdit()
  }

  /** 修改草稿；所有编辑都经过这里，统一标记为未应用。 */
  function edit(mutate: (spec: Spec) => void) {
    if (!draft.value) return
    mutate(draft.value)
    dirty.value = true
  }

  function setField(id: number, field: FieldSpec) {
    edit((s) => (s.fields[id] = field))
  }

  function removeField(id: number) {
    edit((s) => delete s.fields[id])
  }

  /** 应用草稿；校验不通过时返回问题列表且不写入。 */
  async function apply(): Promise<string[]> {
    const entry = currentEntry.value
    if (!draft.value || !entry) return []
    const problems = codec.validateSpec(draft.value)
    if (problems.length) return problems
    entry.spec = clone(draft.value)
    dirty.value = false
    await persist()
    return []
  }

  /** 草稿恢复为内置预设的原始定义（仍需应用才生效）。 */
  function resetDraftToPreset() {
    const preset = currentEntry.value?.preset
    if (!preset) return
    draft.value = codec.preset(preset)
    dirty.value = true
  }

  async function switchTo(id: string) {
    if (!entries.value.some((e) => e.id === id)) return
    currentId.value = id
    await persist()
    if (draft.value) startEdit()
  }

  /** 以当前规范为模板新建一套规范并切换过去。 */
  async function create(name: string) {
    const base = current.value ? clone(current.value) : codec.preset(codec.presetNames()[0])
    const entry: SpecEntry = { id: `user:${Date.now()}`, spec: { ...base, name } }
    entries.value.push(entry)
    await switchTo(entry.id)
  }

  async function remove(id: string) {
    const entry = entries.value.find((e) => e.id === id)
    if (!entry || entry.preset) return
    entries.value = entries.value.filter((e) => e.id !== id)
    if (currentId.value === id) currentId.value = entries.value[0].id
    await persist()
    if (draft.value) startEdit()
  }

  /** 导入规范 JSON；有问题时返回问题列表且不导入。 */
  async function importJson(text: string): Promise<string[]> {
    const problems = codec.validateSpec(text)
    if (problems.length) return problems
    const spec = JSON.parse(text) as Spec
    const entry: SpecEntry = { id: `user:${Date.now()}`, spec }
    entries.value.push(entry)
    await switchTo(entry.id)
    return []
  }

  function exportJson(): string {
    return JSON.stringify(current.value, null, 2)
  }

  return {
    entries, currentId, currentEntry, current, fieldCount, draft, dirty, draftProblems,
    load, startEdit, discard, edit, setField, removeField, apply, resetDraftToPreset,
    switchTo, create, remove, importJson, exportJson,
  }
})
