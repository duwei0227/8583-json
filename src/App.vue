<script setup lang="ts">
import ConfirmDialog from 'primevue/confirmdialog'
import { onMounted } from 'vue'
import { codec, initCodec } from './codec'
import { createCommands } from './commands'
import ConvertView from './features/convert/ConvertView.vue'
import HistoryDrawer from './features/history/HistoryDrawer.vue'
import AppToolbar from './features/shell/AppToolbar.vue'
import InfoDialogs from './features/shell/InfoDialogs.vue'
import StatusBar from './features/shell/StatusBar.vue'
import ImportSpecDialog from './features/spec/ImportSpecDialog.vue'
import SpecDialog from './features/spec/SpecDialog.vue'
import { getPlatform } from './platform'
import { useHistoryStore } from './stores/history'
import { useMessageStore } from './stores/message'
import { useSpecStore } from './stores/spec'
import { useUiStore } from './stores/ui'

const message = useMessageStore()
const spec = useSpecStore()
const history = useHistoryStore()
const ui = useUiStore()

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
    const file = await (await getPlatform()).openFile(['hex', 'txt', 'json'])
    if (!file) return
    const text = new TextDecoder().decode(file.bytes)
    if (file.name.endsWith('.json')) message.json = text
    else message.hex = text
    message.setStatus('info', `已打开 ${file.name}`)
  },
  saveHex: () => saveText('message.hex', message.hex),
  saveJson: () => saveText('message.json', message.json),
  parse: message.parse,
  pack: message.pack,
  formatHex: message.formatHex,
  clear: message.clear,
  copyHex: () => copyText('HEX', message.hex),
  copyJson: () => copyText('JSON', message.json),
  toggleLayout: () => (ui.layout = ui.layout === 'row' ? 'col' : 'row'),
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
  </div>
</template>
