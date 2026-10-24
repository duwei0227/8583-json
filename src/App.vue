<script setup lang="ts">
import ConfirmDialog from 'primevue/confirmdialog'
import { onMounted } from 'vue'
import { codec, initCodec } from './codec'
import { createCommands, matchShortcut } from './commands'
import ConvertView from './features/convert/ConvertView.vue'
import HistoryDrawer from './features/history/HistoryDrawer.vue'
import AppToolbar from './features/shell/AppToolbar.vue'
import InfoDialogs from './features/shell/InfoDialogs.vue'
import StatusBar from './features/shell/StatusBar.vue'
import ImportSpecDialog from './features/spec/ImportSpecDialog.vue'
import SpecDialog from './features/spec/SpecDialog.vue'
import { getPlatform, type OpenedFile } from './platform'
import { useHistoryStore } from './stores/history'
import { useMessageStore } from './stores/message'
import { useSpecStore } from './stores/spec'
import { useUiStore } from './stores/ui'
import { readMessageFile } from './utils/files'

const message = useMessageStore()
const spec = useSpecStore()
const history = useHistoryStore()
const ui = useUiStore()

/** 打开或拖入的文件：JSON 填入 JSON 编辑器后组包，其余填入 HEX 编辑器后解析。 */
function loadFile(file: OpenedFile) {
  const { target, text } = readMessageFile(file.name, file.bytes)
  if (target === 'json') {
    message.json = text
    message.pack()
  } else {
    message.hex = text
    message.parse()
  }
  if (message.status.kind !== 'err') message.setStatus('ok', `已打开 ${file.name} · ${message.status.text}`)
}

async function saveText(name: string, text: string) {
  if (!text.trim()) return message.setStatus('warn', '没有可保存的内容')
  if (await (await getPlatform()).saveFile(name, text)) message.setStatus('ok', `已保存 ${name}`)
}

async function copyText(label: string, text: string) {
  await (await getPlatform()).copy(text)
  message.setStatus('ok', `${label} 已复制到剪贴板`)
}

const commands = createCommands({
  async openFile() {
    const file = await (await getPlatform()).openFile(['hex', 'txt', 'bin', 'json'])
    if (file) loadFile(file)
  },
  saveHex: () => saveText('message.hex', message.hex),
  saveJson: () => saveText('message.json', message.json),
  parse: message.parse,
  pack: message.pack,
  format: message.format,
  clear: message.clear,
  copyHex: () => copyText('HEX', message.hex),
  copyJson: () => copyText('JSON', message.json),
  toggleLayout: () => (ui.layout = ui.layout === 'row' ? 'col' : 'row'),
  toggleEditors: () => (ui.editorsOpen = !ui.editorsOpen),
  toggleAnalysis: () => (ui.analysisOpen = !ui.analysisOpen),
  toggleHistory: () => (ui.historyOpen = !ui.historyOpen),
  editSpec: () => (ui.specOpen = true),
  async newSpec() {
    await spec.create(`${spec.current?.name ?? '规范'} 副本`)
    ui.specOpen = true
    message.setStatus('info', '已新建规范，可在「域定义配置」里修改名称和定义')
  },
  importSpec: () => (ui.importOpen = true),
  exportSpec: () => saveText(`${spec.current?.name ?? 'spec'}.json`, spec.exportJson()),
  showFieldReference: () => (ui.modal = 'fields'),
  showShortcuts: () => (ui.modal = 'shortcuts'),
  showAbout: () => (ui.modal = 'about'),
})

onMounted(async () => {
  const platform = await getPlatform()
  ui.platformKind = platform.kind
  try {
    await initCodec()
    await spec.load()
    message.setStatus('info', `编解码核心 v${codec.version()} 已加载 · ${spec.current?.name} · ${spec.fieldCount} 个域`)
  } catch (e) {
    message.setStatus('err', `编解码核心加载失败：${e instanceof Error ? e.message : String(e)}`)
  }
  platform.onFileDrop({
    onDragging: (active) => (ui.dragging = active),
    onFile: loadFile,
    onError: (text) => message.setStatus('err', text),
  })
  // 桌面端由原生菜单注册快捷键；Web 端在捕获阶段监听，先于编辑器处理
  if (platform.kind === 'web') {
    window.addEventListener(
      'keydown',
      (e) => {
        const command = commands.find((c) => c.shortcut && matchShortcut(c.shortcut, e, ui.isMac))
        if (!command) return
        e.preventDefault()
        e.stopPropagation()
        void command.run()
      },
      true,
    )
  }
  await Promise.all([platform.installMenu(commands), history.load()])
})
</script>

<template>
  <div class="flex h-full flex-col bg-surface-50 font-sans text-surface-900">
    <AppToolbar :commands="commands" />
    <main class="min-h-0 flex-1 overflow-y-auto p-4">
      <ConvertView />
    </main>
    <StatusBar />
    <HistoryDrawer />
    <SpecDialog />
    <InfoDialogs :commands="commands" />
    <ImportSpecDialog />
    <ConfirmDialog />
    <div v-if="ui.dragging" class="pointer-events-none fixed inset-3 z-[2000] flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-blue-50/90" aria-live="polite">
      <div class="flex flex-col items-center gap-2 text-primary">
        <i class="pi pi-file-import text-3xl" aria-hidden="true" />
        <span class="text-base font-semibold">松开以打开报文文件</span>
        <span class="text-xs text-surface-600">.hex / .txt 十六进制文本、.bin 原始字节、.json 报文</span>
      </div>
    </div>
  </div>
</template>
