/**
 * 命令注册表：工具栏、桌面原生菜单、Web「更多」菜单、快捷键列表的唯一来源。
 * 新增功能时只在这里加一条，各入口自动出现。
 */

export type CommandGroup = 'file' | 'edit' | 'view' | 'spec' | 'help'

export const COMMAND_GROUPS: { id: CommandGroup; label: string }[] = [
  { id: 'file', label: '文件' },
  { id: 'edit', label: '编辑' },
  { id: 'view', label: '视图' },
  { id: 'spec', label: '规范' },
  { id: 'help', label: '帮助' },
]

export interface Command {
  id: string
  label: string
  /** PrimeIcons 类名，例如 `pi pi-play` */
  icon: string
  group: CommandGroup
  /** Tauri accelerator 写法，例如 `CmdOrCtrl+Enter` */
  shortcut?: string
  /** 是否放在工具栏上 */
  toolbar?: boolean
  run: () => void | Promise<void>
}

/** 命令需要的动作，由 App 用 stores 和 platform 组装后注入，便于测试。 */
export interface CommandActions {
  openFile(): Promise<void>
  saveHex(): Promise<void>
  saveJson(): Promise<void>
  parse(): void
  pack(): void
  formatHex(): void
  clear(): void
  copyHex(): Promise<void>
  copyJson(): Promise<void>
  toggleLayout(): void
  toggleHistory(): void
  editSpec(): void
  showFieldReference(): void
  showShortcuts(): void
  showAbout(): void
}

export function createCommands(a: CommandActions): Command[] {
  return [
    { id: 'file.open', label: '打开报文文件…', icon: 'pi pi-folder-open', group: 'file', shortcut: 'CmdOrCtrl+O', toolbar: true, run: a.openFile },
    { id: 'file.saveHex', label: '保存 HEX…', icon: 'pi pi-save', group: 'file', shortcut: 'CmdOrCtrl+S', run: a.saveHex },
    { id: 'file.saveJson', label: '保存 JSON…', icon: 'pi pi-file-export', group: 'file', shortcut: 'CmdOrCtrl+Shift+S', run: a.saveJson },

    { id: 'message.parse', label: '解析 8583 → JSON', icon: 'pi pi-play', group: 'edit', shortcut: 'CmdOrCtrl+Enter', toolbar: true, run: a.parse },
    { id: 'message.pack', label: '组包 JSON → 8583', icon: 'pi pi-replay', group: 'edit', shortcut: 'CmdOrCtrl+Shift+Enter', toolbar: true, run: a.pack },
    { id: 'message.format', label: '格式化 HEX', icon: 'pi pi-align-left', group: 'edit', shortcut: 'CmdOrCtrl+Shift+F', toolbar: true, run: a.formatHex },
    { id: 'message.clear', label: '清空', icon: 'pi pi-trash', group: 'edit', toolbar: true, run: a.clear },
    { id: 'message.copyHex', label: '复制 HEX', icon: 'pi pi-copy', group: 'edit', run: a.copyHex },
    { id: 'message.copyJson', label: '复制 JSON', icon: 'pi pi-copy', group: 'edit', run: a.copyJson },

    { id: 'view.layout', label: '切换编辑器排列', icon: 'pi pi-table', group: 'view', run: a.toggleLayout },
    { id: 'view.history', label: '历史记录', icon: 'pi pi-history', group: 'view', shortcut: 'CmdOrCtrl+H', run: a.toggleHistory },

    { id: 'spec.edit', label: '编辑当前规范…', icon: 'pi pi-sliders-h', group: 'spec', shortcut: 'CmdOrCtrl+,', run: a.editSpec },

    { id: 'help.fields', label: '8583 字段速查', icon: 'pi pi-book', group: 'help', run: a.showFieldReference },
    { id: 'help.shortcuts', label: '快捷键列表', icon: 'pi pi-key', group: 'help', shortcut: 'CmdOrCtrl+/', run: a.showShortcuts },
    { id: 'help.about', label: '关于 8583 ⇄ JSON', icon: 'pi pi-info-circle', group: 'help', run: a.showAbout },
  ]
}

/** 把 accelerator 转成界面显示用的写法：macOS 显示 ⌘，其他平台显示 Ctrl。 */
export function formatShortcut(shortcut: string, mac: boolean): string {
  return shortcut.replace('CmdOrCtrl', mac ? '⌘' : 'Ctrl')
}
