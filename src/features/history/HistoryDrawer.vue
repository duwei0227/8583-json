<script setup lang="ts">
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import { useConfirm } from 'primevue/useconfirm'
import { useHistoryStore } from '../../stores/history'
import { useMessageStore } from '../../stores/message'
import { useUiStore } from '../../stores/ui'
import { formatHex } from '../../utils/hex'

const history = useHistoryStore()
const message = useMessageStore()
const ui = useUiStore()
const confirm = useConfirm()

function clearAll() {
  confirm.require({
    header: '清空全部历史记录？',
    message: `将删除本机保存的 ${history.items.length} 条转换记录，无法恢复。`,
    acceptProps: { label: '清空', severity: 'danger' },
    rejectProps: { label: '取消', severity: 'secondary', outlined: true },
    accept: () => void history.clear(),
  })
}

function load(hex: string) {
  message.hex = formatHex(hex)
  message.parse()
  ui.historyOpen = false
}
</script>

<template>
  <Drawer v-model:visible="ui.historyOpen" position="right" header="历史记录" class="w-[26rem] max-w-full">
    <div class="mb-3 flex items-center justify-between text-xs text-surface-500">
      <span>保存在本机，最多 50 条</span>
      <Button label="清空" size="small" severity="secondary" text :disabled="!history.items.length" @click="clearAll" />
    </div>
    <p v-if="!history.items.length" class="py-10 text-center text-sm text-surface-500">还没有转换记录。</p>
    <ul v-else class="m-0 flex list-none flex-col gap-2 p-0">
      <li v-for="item in history.items" :key="item.id" class="flex flex-col gap-1.5 rounded-lg border border-surface-200 px-3 py-2.5">
        <div class="flex items-center gap-2 text-sm">
          <span class="rounded bg-violet-100 px-1.5 font-mono text-xs font-semibold text-violet-800">{{ item.mti }}</span>
          <span class="text-surface-600">{{ item.direction === 'parse' ? '8583 → JSON' : 'JSON → 8583' }} · {{ item.bytes }} 字节</span>
          <span class="ml-auto font-mono text-xs text-surface-500">{{ new Date(item.time).toLocaleTimeString() }}</span>
        </div>
        <div class="flex gap-1.5">
          <Button label="载入" size="small" outlined @click="load(item.hex)" />
          <Button label="删除" size="small" severity="danger" text @click="history.remove(item.id)" />
        </div>
      </li>
    </ul>
  </Drawer>
</template>
