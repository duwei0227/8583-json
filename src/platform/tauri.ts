import { listen } from '@tauri-apps/api/event'
import { Image } from '@tauri-apps/api/image'
import { IconMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readFile, writeFile } from '@tauri-apps/plugin-fs'
import { load } from '@tauri-apps/plugin-store'
import { COMMAND_GROUPS, type Command } from '../commands'
import type { FileDropHandlers, KeyValueStore, Platform } from './types'

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

    onFileDrop,

    installMenu,
  }
}

/** Rust 侧（src-tauri/src/lib.rs）读取拖入的文件后发出的事件 */
interface DroppedFile {
  name: string
  bytes?: number[]
  error?: string
}

function onFileDrop(h: FileDropHandlers) {
  // 遮罩只关心拖入 / 离开；文件内容由 Rust 读取，前端无需额外的文件系统权限
  void getCurrentWebview().onDragDropEvent((e) => {
    h.onDragging(e.payload.type === 'enter' || e.payload.type === 'over')
  })
  void listen<DroppedFile>('file-dropped', (e) => {
    const { name, bytes, error } = e.payload
    if (error || !bytes) h.onError(error ?? `无法读取 ${name}`)
    else h.onFile({ name, bytes: new Uint8Array(bytes) })
  })
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
      const items: (MenuItem | IconMenuItem | PredefinedMenuItem)[] = await Promise.all(
        commands
          .filter((c) => c.group === group.id)
          .map(async (c) =>
            IconMenuItem.new({
              id: c.id,
              text: c.label,
              icon: await menuIcon(c.icon),
              accelerator: c.shortcut,
              action: () => void c.run(),
            }),
          ),
      )
      // macOS 的 WebView 依赖「编辑」菜单里的系统项，Cmd+C / Cmd+V 才能在输入框里生效
      if (group.id === 'edit') {
        items.push(
          await PredefinedMenuItem.new({ item: 'Separator' }),
          await PredefinedMenuItem.new({ item: 'Cut', text: '剪切' }),
          await PredefinedMenuItem.new({ item: 'Copy', text: '复制' }),
          await PredefinedMenuItem.new({ item: 'Paste', text: '粘贴' }),
          await PredefinedMenuItem.new({ item: 'SelectAll', text: '全选' }),
        )
      }
      // 系统预置的「退出」在 Linux 上不受支持（显示为禁用的英文 Quit），改用自定义项关闭窗口
      if (group.id === 'file') {
        items.push(
          await PredefinedMenuItem.new({ item: 'Separator' }),
          await IconMenuItem.new({ id: 'app.quit', text: '退出', icon: await menuIcon('pi pi-sign-out'), accelerator: 'CmdOrCtrl+Q', action: () => void getCurrentWindow().close() }),
        )
      }
      return Submenu.new({ text: group.label, items })
    }),
  )
  const menu = await Menu.new({ items: submenus })
  await menu.setAsAppMenu()
}

const ICON_SIZE = 32
const ICON_COLOR = '#52525b'

/**
 * 把 PrimeIcons 图标画成 RGBA 位图，供原生菜单使用，与工具栏图标保持一致。
 * 原生菜单只接受位图；字体未就绪或绘制失败时返回 undefined，菜单项照常显示文字。
 */
async function menuIcon(icon: string): Promise<Image | undefined> {
  try {
    await document.fonts.load(`${ICON_SIZE}px primeicons`)
    const probe = document.createElement('i')
    probe.className = icon
    document.body.append(probe)
    const glyph = getComputedStyle(probe, '::before').content.replace(/^["']|["']$/g, '')
    probe.remove()
    if (!glyph || glyph === 'none') return undefined

    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = ICON_SIZE
    const ctx = canvas.getContext('2d')!
    ctx.font = `${Math.round(ICON_SIZE * 0.8)}px primeicons`
    ctx.fillStyle = ICON_COLOR
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(glyph, ICON_SIZE / 2, ICON_SIZE / 2)
    const { data } = ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE)
    return await Image.new(new Uint8Array(data.buffer), ICON_SIZE, ICON_SIZE)
  } catch {
    return undefined
  }
}
