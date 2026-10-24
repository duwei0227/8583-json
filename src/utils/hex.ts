/** 去掉空白并转大写；不校验字符，校验交给编解码核心统一报错。 */
export function compactHex(text: string): string {
  return text.replace(/\s+/g, '').toUpperCase()
}

/** 每字节一个空格、每行 16 字节，便于阅读和对照偏移。 */
export function formatHex(text: string): string {
  const bytes = compactHex(text).match(/.{1,2}/g) ?? []
  const lines: string[] = []
  for (let i = 0; i < bytes.length; i += 16) lines.push(bytes.slice(i, i + 16).join(' '))
  return lines.join('\n')
}
