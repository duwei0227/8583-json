import { formatHex } from './hex'

/**
 * 打开或拖入的文件 → 填入哪个编辑器、填什么内容。
 * .json 进 JSON 编辑器；内容本身是十六进制文本的进 HEX 编辑器；其余（如 .bin 抓包原始字节）转成十六进制。
 */
export function readMessageFile(name: string, bytes: Uint8Array): { target: 'hex' | 'json'; text: string } {
  const lower = name.toLowerCase()
  const text = new TextDecoder().decode(bytes)
  if (lower.endsWith('.json')) return { target: 'json', text }
  if (!lower.endsWith('.bin') && text.trim() && /^[0-9a-fA-F\s]*$/.test(text)) return { target: 'hex', text: formatHex(text) }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return { target: 'hex', text: formatHex(hex) }
}
