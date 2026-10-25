<script setup lang="ts">
import { computed } from 'vue'
import { offsetText, segmentKind, segmentTag, spaced } from '../../explain/segments'
import { useMessageStore } from '../../stores/message'
import { KIND_LEGEND, KIND_STYLES } from './kindStyles'

const message = useMessageStore()

const chips = computed(() =>
  (message.decoded?.segments ?? []).map((s) => {
    const style = KIND_STYLES[segmentKind(s.id)]
    const selected = s.id === message.selectedId
    const hovered = s.id === message.hoverId
    return {
      id: s.id,
      tag: segmentTag(s.id),
      hex: spaced(s.lenPrefix + s.raw),
      cls: selected ? `${style.solid} ring-2 ring-offset-1 ring-current` : hovered ? `${style.soft} ${style.ring}` : `${style.soft} border-transparent`,
    }
  }),
)

const selected = computed(() => message.decoded?.segments.find((s) => s.id === message.selectedId))
</script>

<template>
  <section class="flex flex-col gap-3 rounded-lg border border-surface-200 bg-white p-3.5">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="m-0 text-sm font-semibold">报文结构</h2>
      <span class="text-xs text-surface-500">悬停或点击色块，可联动下方表格和位图；点击后自动定位到表格对应行</span>
      <div class="ml-auto flex flex-wrap gap-3 text-xs text-surface-700">
        <span v-for="item in KIND_LEGEND" :key="item.kind" class="flex items-center gap-1.5">
          <span class="size-2.5 rounded-sm" :class="KIND_STYLES[item.kind].swatch" aria-hidden="true" />{{ item.label }}
        </span>
      </div>
    </div>
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="chip in chips"
        :key="chip.id"
        type="button"
        class="flex max-w-full cursor-pointer flex-col items-start gap-0.5 rounded-md border px-2 py-1 text-left"
        :class="chip.cls"
        :aria-pressed="chip.id === message.selectedId"
        @click="message.selectAndReveal(chip.id)"
        @mouseenter="message.hover(chip.id)"
        @mouseleave="message.hover(null)"
      >
        <span class="text-[12px] font-semibold">{{ chip.tag }}</span>
        <span class="font-mono text-xs break-all">{{ chip.hex }}</span>
      </button>
    </div>
    <div v-if="selected" class="flex flex-wrap items-center gap-2 border-t border-surface-100 pt-2.5 text-xs text-surface-700">
      <span class="text-surface-500">当前选中</span>
      <span class="font-semibold text-surface-900">{{ segmentTag(selected.id) }}</span>
      <span class="font-mono">{{ offsetText(selected) }}</span>
    </div>
  </section>
</template>
