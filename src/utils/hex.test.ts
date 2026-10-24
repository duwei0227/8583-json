import { describe, expect, it } from 'vitest'
import { byteIndexAt, byteSpans, compactHex, formatHex } from './hex'

describe('hex helpers', () => {
  it('compacts whitespace and upper-cases', () => {
    expect(compactHex(' 00 d0\n60 ')).toBe('00D060')
  })

  it('formats 16 bytes per line', () => {
    const text = '00'.repeat(17)
    expect(formatHex(text).split('\n')).toEqual([Array(16).fill('00').join(' '), '00'])
  })
})

describe('byte positions', () => {
  const text = '00 D0\n60 0A'

  it('maps bytes to text ranges across spaces and newlines', () => {
    expect(byteSpans(text)).toEqual([
      { from: 0, to: 2 },
      { from: 3, to: 5 },
      { from: 6, to: 8 },
      { from: 9, to: 11 },
    ])
  })

  it('finds the byte under a cursor position', () => {
    expect(byteIndexAt(text, 0)).toBe(0)
    expect(byteIndexAt(text, 4)).toBe(1)
    expect(byteIndexAt(text, 5)).toBe(1)
    expect(byteIndexAt(text, 10)).toBe(3)
    expect(byteIndexAt('', 0)).toBe(-1)
  })
})
