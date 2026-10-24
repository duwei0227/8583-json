import { describe, expect, it } from 'vitest'
import { compactHex, formatHex } from './hex'

describe('hex helpers', () => {
  it('compacts whitespace and upper-cases', () => {
    expect(compactHex(' 00 d0\n60 ')).toBe('00D060')
  })

  it('formats 16 bytes per line', () => {
    const text = '00'.repeat(17)
    expect(formatHex(text).split('\n')).toEqual([Array(16).fill('00').join(' '), '00'])
  })
})
