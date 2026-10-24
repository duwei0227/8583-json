import { describe, expect, it } from 'vitest'
import { readMessageFile } from './files'

const bytes = (s: string) => new TextEncoder().encode(s)

describe('readMessageFile', () => {
  it('routes JSON files to the JSON editor as-is', () => {
    expect(readMessageFile('msg.json', bytes('{"mti":"0200"}'))).toEqual({ target: 'json', text: '{"mti":"0200"}' })
  })

  it('formats hex text files', () => {
    expect(readMessageFile('msg.txt', bytes('0200 70\n24'))).toEqual({ target: 'hex', text: '02 00 70 24' })
  })

  it('converts raw binary to hex', () => {
    expect(readMessageFile('capture.bin', new Uint8Array([0x00, 0xd0, 0x60]))).toEqual({ target: 'hex', text: '00 D0 60' })
    // 扩展名不是 .bin、但内容不是十六进制文本时，同样按原始字节处理
    expect(readMessageFile('dump', new Uint8Array([0x02, 0x00, 0xff]))).toEqual({ target: 'hex', text: '02 00 FF' })
  })
})
