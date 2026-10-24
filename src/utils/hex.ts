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

/** 每个字节在原始文本中的位置 [from, to)，跳过空白；末尾不足一个字节的半字节忽略。 */
export function byteSpans(text: string): { from: number; to: number }[] {
  const spans: { from: number; to: number }[] = []
  let first = -1
  for (let i = 0; i < text.length; i++) {
    if (/\s/.test(text[i])) continue
    if (first < 0) first = i
    else {
      spans.push({ from: first, to: i + 1 })
      first = -1
    }
  }
  return spans
}

/** 文本位置所在（或紧邻其前）的字节序号；文本里没有字节时返回 -1。 */
export function byteIndexAt(text: string, pos: number): number {
  const spans = byteSpans(text)
  for (let i = spans.length - 1; i >= 0; i--) if (spans[i].from <= pos) return i
  return spans.length ? 0 : -1
}
