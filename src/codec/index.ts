// 编解码入口：UI 和 stores 只通过这里调用 WASM，不直接 import pkg。
import init, * as wasm from './pkg/iso8583'
import type { Decoded } from './types/Decoded'
import type { MessageJson } from './types/MessageJson'
import type { Spec } from './types/Spec'

export type { Decoded, MessageJson, Spec }
export type { Segment } from './types/Segment'

let ready: Promise<void> | undefined

/** 加载 WASM 模块，重复调用只加载一次。 */
export function initCodec(): Promise<void> {
  ready ??= init().then(() => undefined)
  return ready
}

export const codec = {
  version: (): string => wasm.version(),
  presetNames: (): string[] => wasm.presetNames(),
  preset: (name: string): Spec => JSON.parse(wasm.preset(name)) as Spec,
  decode: (hex: string, spec: Spec): Decoded => wasm.decode(hex, JSON.stringify(spec)) as Decoded,
  encode: (message: MessageJson, spec: Spec): string =>
    wasm.encode(JSON.stringify(message), JSON.stringify(spec)),
}
