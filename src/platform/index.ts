import { isTauri } from '@tauri-apps/api/core'
import type { Platform } from './types'

export type { KeyValueStore, OpenedFile, Platform } from './types'

let current: Promise<Platform> | undefined

/** 按运行环境动态加载实现，Web 构建里不会打包 Tauri 插件代码。 */
export function getPlatform(): Promise<Platform> {
  current ??= isTauri()
    ? import('./tauri').then((m) => m.createTauriPlatform())
    : import('./web').then((m) => m.createWebPlatform())
  return current
}
