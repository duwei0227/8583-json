<script setup lang="ts">
import { computed } from 'vue'
import { describeDetail, segmentKind } from '../../explain/segments'
import { useMessageStore } from '../../stores/message'
import { useSpecStore } from '../../stores/spec'
import { KIND_STYLES } from './kindStyles'

const message = useMessageStore()
const spec = useSpecStore()

const detail = computed(() =>
  message.decoded && spec.current && message.selectedId
    ? describeDetail(message.decoded, spec.current, message.selectedId)
    : null,
)
const accent = computed(() => KIND_STYLES[segmentKind(message.selectedId ?? '')].text)
</script>

<template>
  <section v-if="detail" class="flex flex-col gap-2.5 rounded-lg border border-surface-200 bg-white p-3.5">
    <div class="flex items-baseline gap-2">
      <h2 class="m-0 text-sm font-semibold">{{ detail.title }}</h2>
      <span class="ml-auto font-mono text-xs text-surface-500">{{ detail.format }}</span>
    </div>
    <div class="rounded-md bg-surface-50 px-2.5 py-2 font-mono text-xs break-all">
      <span class="text-surface-500">原始字节 </span>{{ detail.raw }}
    </div>

    <dl class="m-0 flex flex-col gap-1.5 text-[14px]">
      <div v-for="item in detail.items" :key="item.label" class="grid grid-cols-[76px_minmax(0,1fr)] gap-2.5">
        <dt class="text-surface-500">{{ item.label }}</dt>
        <dd class="m-0 break-all" :class="{ 'font-mono text-xs leading-5': item.mono }">{{ item.value }}</dd>
      </div>
    </dl>

    <div v-if="detail.parts.length" class="flex flex-col overflow-hidden rounded-lg border border-surface-200">
      <div class="bg-surface-50 px-2.5 py-1.5 text-xs font-semibold">{{ detail.partsTitle }}</div>
      <div
        v-for="part in detail.parts"
        :key="part.label"
        class="grid grid-cols-[120px_minmax(0,1fr)] gap-x-2.5 gap-y-0.5 border-t border-surface-100 px-2.5 py-1.5 text-xs"
      >
        <span class="font-mono font-semibold break-all" :class="accent">{{ part.segment }}</span>
        <span class="font-medium">{{ part.label }}<span class="font-normal text-surface-500"> · {{ part.value }}</span></span>
        <template v-if="part.note">
          <span />
          <span class="text-surface-700">{{ part.note }}</span>
        </template>
        <template v-if="part.options">
          <span />
          <div class="flex flex-wrap gap-1 pt-1">
            <span
              v-for="option in part.options"
              :key="option.code"
              class="rounded border px-1.5 text-[12px] whitespace-nowrap"
              :class="option.current ? 'border-violet-800 bg-violet-800 text-white' : 'border-surface-200 text-surface-500'"
              :aria-current="option.current || undefined"
            >
              <span class="font-mono font-semibold">{{ option.code }}</span> {{ option.label }}
            </span>
          </div>
        </template>
      </div>
    </div>

    <div v-if="detail.tlv.length" class="flex flex-col overflow-hidden rounded-lg border border-surface-200">
      <div class="bg-surface-50 px-2.5 py-1.5 text-xs font-semibold">TLV 子域</div>
      <div
        v-for="(t, i) in detail.tlv"
        :key="`${t.tag}-${i}`"
        class="grid grid-cols-[48px_minmax(0,1fr)] gap-x-2 gap-y-0.5 border-t border-surface-100 px-2.5 py-1.5 text-xs"
      >
        <span class="font-mono font-semibold text-blue-800">{{ t.tag }}</span>
        <span>{{ t.name }} <span class="text-surface-500">· {{ t.length }} 字节</span></span>
        <span />
        <span class="font-mono break-all text-surface-700">{{ t.value }}</span>
      </div>
    </div>
  </section>
</template>
