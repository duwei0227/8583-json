import type { Command } from '../commands'

export interface OpenedFile {
  name: string
  bytes: Uint8Array
}

export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
}

export interface FileDropHandlers {
  onDragging(active: boolean): void
  onFile(file: OpenedFile): void
  onError(message: string): void
}

/** Web 与桌面端差异的唯一出口；UI 和 stores 不直接调用浏览器文件 API 或 Tauri 插件。 */
export interface Platform {
  readonly kind: 'web' | 'desktop'
  openFile(extensions: string[]): Promise<OpenedFile | null>
  saveFile(suggestedName: string, data: Uint8Array | string): Promise<boolean>
  copy(text: string): Promise<void>
  readonly storage: KeyValueStore
  /**
   * 文件拖入窗口：`onDragging` 用于显示「松开以打开」的遮罩，`onFile` 收到读取好的文件，
   * `onError` 收到读取失败的原因（如文件过大）。
   */
  onFileDrop(handlers: FileDropHandlers): void
  /** 桌面端据命令注册表生成原生菜单；Web 端由页面内菜单承担，不做任何事。 */
  installMenu(commands: Command[]): Promise<void>
}
