import { Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readFile, writeFile } from '@tauri-apps/plugin-fs'
import { load } from '@tauri-apps/plugin-store'
import { COMMAND_GROUPS, type Command } from '../commands'
import type { KeyValueStore, Platform } from './types'

export function createTauriPlatform(): Platform {
  return {
    kind: 'desktop',

    async openFile(extensions) {
      const path = await open({ multiple: false, filters: [{ name: '报文文件', extensions }] })
      if (typeof path !== 'string') return null
      return { name: path.split(/[\\/]/).pop() ?? path, bytes: await readFile(path) }
    },

    async saveFile(suggestedName, data) {
      const path = await save({ defaultPath: suggestedName })
      if (!path) return false
      await writeFile(path, typeof data === 'string' ? new TextEncoder().encode(data) : data)
      return true
    },

    copy: (text) => writeText(text),

    storage: createStore('settings.json'),

    installMenu,
  }
}

function createStore(file: string): KeyValueStore {
  const store = load(file, { autoSave: true, defaults: {} })
  return {
    get: async (key) => (await store).get(key),
    set: async (key, value) => (await store).set(key, value),
    delete: async (key) => {
      await (await store).delete(key)
    },
  }
}

/** 按命令注册表生成原生菜单，与工具栏、快捷键列表共用同一份定义。 */
async function installMenu(commands: Command[]): Promise<void> {
  const submenus = await Promise.all(
    COMMAND_GROUPS.map(async (group) => {
      const items: (MenuItem | PredefinedMenuItem)[] = await Promise.all(
        commands
          .filter((c) => c.group === group.id)
          .map((c) =>
            MenuItem.new({
              id: c.id,
              text: c.label,
              accelerator: c.shortcut,
              action: () => void c.run(),
            }),
          ),
      )
      // macOS 的 WebView 依赖「编辑」菜单里的系统项，Cmd+C / Cmd+V 才能在输入框里生效
      if (group.id === 'edit') {
        items.push(
          await PredefinedMenuItem.new({ item: 'Separator' }),
          await PredefinedMenuItem.new({ item: 'Cut' }),
          await PredefinedMenuItem.new({ item: 'Copy' }),
          await PredefinedMenuItem.new({ item: 'Paste' }),
          await PredefinedMenuItem.new({ item: 'SelectAll' }),
        )
      }
      if (group.id === 'file') {
        items.push(await PredefinedMenuItem.new({ item: 'Separator' }), await PredefinedMenuItem.new({ item: 'Quit' }))
      }
      return Submenu.new({ text: group.label, items })
    }),
  )
  const menu = await Menu.new({ items: submenus })
  await menu.setAsAppMenu()
}
