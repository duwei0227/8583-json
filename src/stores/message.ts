import { defineStore } from 'pinia'
import { ref } from 'vue'
import { codec, type Decoded, type MessageJson } from '../codec'
import type { Sample } from '../samples'
import { compactHex, formatHex } from '../utils/hex'
import { useHistoryStore } from './history'
import { useSpecStore } from './spec'

export type StatusKind = 'ok' | 'warn' | 'err' | 'info'

export const useMessageStore = defineStore('message', () => {
  const hex = ref('')
  const json = ref('')
  const decoded = ref<Decoded | null>(null)
  /** 选中段的唯一来源：结构色块、逐段解析表、位图、详情面板都从它派生。 */
  const selectedId = ref<string | null>(null)
  /** 鼠标悬停的段，只用于各视图的轻量高亮。 */
  const hoverId = ref<string | null>(null)
  /** 请求逐段解析表把某段滚动到视野内；只有从报文结构选中时才发出，计数保证重复点击同一段也能触发。 */
  const revealRequest = ref<{ id: string; seq: number } | null>(null)
  const status = ref<{ kind: StatusKind; text: string }>({ kind: 'info', text: '就绪' })

  const spec = useSpecStore()
  const history = useHistoryStore()

  function setStatus(kind: StatusKind, text: string) {
    status.value = { kind, text }
  }

  function show(result: Decoded, verb: string) {
    decoded.value = result
    selectedId.value = result.segments[0]?.id ?? null
    const fields = result.segments.filter((s) => /^\d+$/.test(s.id)).length
    const warn = result.warnings.map((w) => w.message).join('；')
    setStatus(warn ? 'warn' : 'ok', `${verb}成功 · ${result.total} 字节 · ${fields} 个数据域${warn ? ' · ' + warn : ''}`)
  }

  function parse() {
    if (!spec.current) return
    try {
      const result = codec.decode(hex.value, spec.current)
      json.value = JSON.stringify(toMessage(result), null, 2)
      show(result, '解析')
      void history.push({ direction: 'parse', mti: result.mti, bytes: result.total, hex: compactHex(hex.value) })
    } catch (e) {
      decoded.value = null
      setStatus('err', errorText(e))
    }
  }

  function pack() {
    if (!spec.current) return
    let message: MessageJson
    try {
      message = JSON.parse(json.value) as MessageJson
    } catch (e) {
      setStatus('err', `JSON 语法错误：${errorText(e)}`)
      return
    }
    try {
      const out = codec.encode(message, spec.current)
      hex.value = formatHex(out)
      const result = codec.decode(out, spec.current)
      show(result, '组包')
      void history.push({ direction: 'pack', mti: result.mti, bytes: result.total, hex: out })
    } catch (e) {
      setStatus('err', errorText(e))
    }
  }

  function loadSample(sample: Sample) {
    hex.value = formatHex(sample.hex)
    json.value = JSON.stringify(sample.message, null, 2)
    parse()
  }

  /** 同时格式化 HEX 和 JSON；JSON 语法有误时保持原样并提示。 */
  function format() {
    hex.value = formatHex(hex.value)
    if (!json.value.trim()) return
    try {
      json.value = JSON.stringify(orderKeys(JSON.parse(json.value)), null, 2)
    } catch (e) {
      setStatus('warn', `HEX 已格式化；JSON 语法错误，未格式化：${errorText(e)}`)
    }
  }

  function clear() {
    hex.value = ''
    json.value = ''
    decoded.value = null
    selectedId.value = null
    setStatus('info', '已清空')
  }

  return {
    hex, json, decoded, selectedId, hoverId, revealRequest, status,
    setStatus, parse, pack, loadSample, clear, format,
    select: (id: string | null) => (selectedId.value = id),
    /** 选中并让逐段解析表滚动到这一行 */
    selectAndReveal: (id: string) => {
      selectedId.value = id
      revealRequest.value = { id, seq: (revealRequest.value?.seq ?? 0) + 1 }
    },
    hover: (id: string | null) => (hoverId.value = id),
  }
})

/**
 * JSON 报文的键顺序，与报文中的字节顺序一致。
 * `length`、`bitmap` 只用于展示，组包时由规范和 fields 重新生成，传入的值会被忽略。
 */
const KEY_ORDER = ['length', 'tpdu', 'header', 'mti', 'bitmap', 'fields']

/** 解析结果 → JSON 报文（`MessageJson` 契约外加只读的 length、bitmap）。 */
function toMessage(d: Decoded): MessageJson & { length?: string; bitmap?: string } {
  const value = (id: string) => d.segments.find((s) => s.id === id)?.value
  const raw = (id: string) => d.segments.find((s) => s.id === id)?.raw
  const length = value('len')
  const tpdu = raw('tpdu')
  const header = raw('header')
  const bitmap = value('bitmap')
  const fields: MessageJson['fields'] = {}
  for (const s of d.segments) if (/^\d+$/.test(s.id)) fields[Number(s.id)] = s.value
  return { length, tpdu, header, mti: d.mti, bitmap, fields }
}

/** 按 KEY_ORDER 重排顶层键，未知键排在最后；值为 undefined 的键会被 JSON.stringify 省略。 */
export function orderKeys<T>(value: T): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const rank = (k: string) => (KEY_ORDER.includes(k) ? KEY_ORDER.indexOf(k) : KEY_ORDER.length)
  const keys = Object.keys(value).sort((a, b) => rank(a) - rank(b))
  return Object.fromEntries(keys.map((k) => [k, (value as Record<string, unknown>)[k]])) as T
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
