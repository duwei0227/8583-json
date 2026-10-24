<script setup lang="ts">
import { computed } from 'vue'
import { useMessageStore, type StatusKind } from '../../stores/message'
import { useSpecStore } from '../../stores/spec'
import { useUiStore } from '../../stores/ui'

const message = useMessageStore()
const spec = useSpecStore()
const ui = useUiStore()

const tone: Record<StatusKind, { label: string; dot: string; text: string }> = {
  ok: { label: '成功', dot: 'bg-green-500', text: 'text-green-800' },
  warn: { label: '注意', dot: 'bg-amber-500', text: 'text-amber-800' },
  err: { label: '错误', dot: 'bg-red-500', text: 'text-red-700' },
  info: { label: '提示', dot: 'bg-blue-500', text: 'text-blue-800' },
}
const current = computed(() => tone[message.status.kind])
</script>

<template>
  <footer role="status" class="flex min-h-7 flex-wrap items-center gap-x-4 gap-y-0.5 border-t border-surface-200 bg-surface-100 px-3 py-1 text-xs text-surface-700">
    <span class="flex min-w-0 items-center gap-1.5" :class="current.text">
      <span class="size-2 flex-none rounded-full" :class="current.dot" aria-hidden="true" />
      <span class="font-semibold">{{ current.label }}</span>
      <span class="break-all">{{ message.status.text }}</span>
    </span>
    <span v-if="message.selectedId" class="ml-auto font-mono">选中 {{ message.selectedId }}</span>
    <span :class="{ 'ml-auto': !message.selectedId }">{{ spec.current?.name }}</span>
    <span>{{ ui.platformKind === 'desktop' ? '桌面端' : 'Web' }} · v0.1.0</span>
  </footer>
</template>
