import type { MessageJson } from '../codec/types/MessageJson'
import data from './samples.json'

/**
 * 示例报文，同时是 Rust 与前端共用的黄金样例：
 * `message` 按银联 POS 规范组包后应当逐字节等于 `hex`。
 */
export interface Sample {
  key: string
  title: string
  description: string
  message: MessageJson
  hex: string
}

// JSON 推断出的是逐条不同的字面量类型，这里按契约收窄
export const samples = data as unknown as Sample[]
