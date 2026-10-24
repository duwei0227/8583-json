<script setup lang="ts">
import { computed } from 'vue'
import { bitmapNote, spaced } from '../../explain/segments'
import { useMessageStore } from '../../stores/message'

const message = useMessageStore()

const bitmap = computed(() => message.decoded?.segments.find((s) => s.id === 'bitmap')?.value ?? '')
const cells = computed(() => {
  const bits = new Set(message.decoded?.bits ?? [])
  return Array.from({ length: bitmap.value.length * 4 || 64 }, (_, i) => {
    const n = i + 1
    const on = bits.has(n)
    const id = String(n)
    // 第 1 位是扩展位图标志，不对应数据域，不可点击
    const clickable = on && n > 1
    const cls = !on
      ? 'bg-surface-100 text-surface-500'
      : id === message.selectedId
        ? 'bg-surface-900 font-bold text-white ring-2 ring-primary ring-offset-2'
        : id === message.hoverId
          ? 'bg-primary font-semibold text-primary-contrast ring-2 ring-surface-900'
          : 'bg-primary font-semibold text-primary-contrast'
    return { n, id, on, clickable, cls }
  })
})

const binary = computed(() =>
  (bitmap.value.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16).toString(2).padStart(8, '0')).join(' '),
)
const note = computed(() => (message.decoded ? bitmapNote(message.decoded, message.selectedId) : ''))
</script>

<template>
  <section class="flex flex-col gap-3 rounded-lg border border-surface-200 bg-white p-3.5">
    <div class="flex items-center gap-2">
      <h2 class="m-0 text-sm font-semibold">位图</h2>
      <span class="text-xs text-surface-500">{{ bitmap.length > 16 ? '主位图 + 扩展位图 · 128 位' : '主位图 · 64 位' }}</span>
    </div>
    <div class="grid grid-cols-8 gap-1">
      <button
        v-for="cell in cells"
        :key="cell.n"
        type="button"
        class="h-7 rounded font-mono text-[11px] disabled:cursor-default"
        :class="[cell.cls, { 'cursor-pointer': cell.clickable }]"
        :disabled="!cell.clickable"
        :aria-label="`第 ${cell.n} 位 ${cell.on ? '已置位' : '未置位'}`"
        @click="message.select(cell.id)"
        @mouseenter="cell.clickable && message.hover(cell.id)"
        @mouseleave="message.hover(null)"
      >
        {{ cell.n }}
      </button>
    </div>
    <p v-if="note" class="m-0 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-2 text-xs text-blue-900">{{ note }}</p>
    <div class="flex flex-col gap-1 rounded-md bg-surface-50 p-2.5 font-mono text-xs">
      <span><span class="text-surface-500">HEX </span>{{ spaced(bitmap) }}</span>
      <span class="break-all"><span class="text-surface-500">BIN </span>{{ binary }}</span>
    </div>
  </section>
</template>
