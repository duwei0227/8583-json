<script setup lang="ts">
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Textarea from 'primevue/textarea'
import { computed } from 'vue'
import type { Segment } from '../../codec'
import { useMessageStore } from '../../stores/message'
import { useUiStore } from '../../stores/ui'

// 骨架版：编辑器 + 逐段解析表。报文结构色块、位图、详情面板在 M2 补齐，均从 selectedId 派生。
const message = useMessageStore()
const ui = useUiStore()

const selected = computed({
  get: () => message.decoded?.segments.find((s) => s.id === message.selectedId) ?? null,
  set: (s: Segment | null) => message.select(s?.id ?? null),
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid gap-4" :class="ui.layout === 'row' ? 'md:grid-cols-2' : 'grid-cols-1'">
      <section class="flex flex-col overflow-hidden rounded-lg border border-surface-200 bg-white">
        <label for="hex-in" class="border-b border-surface-200 px-3.5 py-2.5 text-sm font-semibold">8583 报文（HEX）</label>
        <Textarea id="hex-in" v-model="message.hex" spellcheck="false" placeholder="粘贴十六进制报文，空格和换行会被忽略" class="!h-64 !rounded-none !border-0 font-mono text-[13px] leading-relaxed" />
      </section>
      <section class="flex flex-col overflow-hidden rounded-lg border border-surface-200 bg-white">
        <label for="json-in" class="border-b border-surface-200 px-3.5 py-2.5 text-sm font-semibold">JSON</label>
        <Textarea id="json-in" v-model="message.json" spellcheck="false" placeholder='{ "mti": "0200", "fields": { "3": "000000" } }' class="!h-64 !rounded-none !border-0 font-mono text-[13px] leading-relaxed" />
      </section>
    </div>

    <section v-if="message.decoded" class="overflow-hidden rounded-lg border border-surface-200 bg-white">
      <h2 class="m-0 border-b border-surface-200 px-3.5 py-3 text-sm font-semibold">逐段解析</h2>
      <DataTable v-model:selection="selected" :value="message.decoded.segments" data-key="id" selection-mode="single" size="small">
        <Column field="id" header="段" />
        <Column field="offset" header="偏移" />
        <Column field="len" header="字节" />
        <Column field="raw" header="原始字节" body-class="font-mono text-xs" />
        <Column field="value" header="解析值" body-class="font-mono text-xs" />
      </DataTable>
    </section>
    <section v-else class="rounded-lg border border-dashed border-surface-300 bg-white px-4 py-12 text-center text-sm text-surface-500">
      粘贴 8583 报文后点「解析」，或编辑 JSON 后点「组包」。也可以从工具栏选一个示例报文。
    </section>
  </div>
</template>
