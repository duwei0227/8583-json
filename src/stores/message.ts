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

  function clear() {
    hex.value = ''
    json.value = ''
    decoded.value = null
    selectedId.value = null
    setStatus('info', '已清空')
  }

  return {
    hex, json, decoded, selectedId, status,
    setStatus, parse, pack, loadSample, clear,
    formatHex: () => (hex.value = formatHex(hex.value)),
    select: (id: string | null) => (selectedId.value = id),
  }
})

/** 解析结果 → JSON 报文（与 `MessageJson` 契约一致）。 */
function toMessage(d: Decoded): MessageJson {
  const raw = (id: string) => d.segments.find((s) => s.id === id)?.raw
  const tpdu = raw('tpdu')
  const header = raw('header')
  const fields: MessageJson['fields'] = {}
  for (const s of d.segments) if (/^\d+$/.test(s.id)) fields[Number(s.id)] = s.value
  // 键顺序与契约一致：mti、tpdu、header、fields
  return { mti: d.mti, ...(tpdu && { tpdu }), ...(header && { header }), fields }
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
