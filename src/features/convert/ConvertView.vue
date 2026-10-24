<script setup lang="ts">
import Textarea from 'primevue/textarea'
import { computed } from 'vue'
import { useMessageStore } from '../../stores/message'
import { useUiStore } from '../../stores/ui'
import { compactHex } from '../../utils/hex'
import BitmapGrid from './BitmapGrid.vue'
import SegmentDetail from './SegmentDetail.vue'
import SegmentTable from './SegmentTable.vue'
import StructureStrip from './StructureStrip.vue'

const message = useMessageStore()
const ui = useUiStore()

const hexBytes = computed(() => Math.floor(compactHex(message.hex).length / 2))
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid gap-4" :class="ui.layout === 'row' ? 'md:grid-cols-2' : 'grid-cols-1'">
      <section class="flex flex-col overflow-hidden rounded-lg border border-surface-200 bg-white">
        <div class="flex items-center gap-2 border-b border-surface-200 px-3.5 py-2.5">
          <label for="hex-in" class="text-sm font-semibold">8583 报文</label>
          <span class="font-mono text-xs text-surface-500">HEX · {{ hexBytes }} 字节</span>
        </div>
        <Textarea id="hex-in" v-model="message.hex" spellcheck="false" placeholder="粘贴十六进制报文，空格和换行会被忽略" class="!h-64 !rounded-none !border-0 font-mono text-[13px] leading-relaxed" />
      </section>
      <section class="flex flex-col overflow-hidden rounded-lg border border-surface-200 bg-white">
        <div class="flex items-center gap-2 border-b border-surface-200 px-3.5 py-2.5">
          <label for="json-in" class="text-sm font-semibold">JSON</label>
          <span class="font-mono text-xs text-surface-500">{ mti, tpdu, header, fields }</span>
        </div>
        <Textarea id="json-in" v-model="message.json" spellcheck="false" placeholder='{ "mti": "0200", "fields": { "3": "000000" } }' class="!h-64 !rounded-none !border-0 font-mono text-[13px] leading-relaxed" />
      </section>
    </div>

    <template v-if="message.decoded">
      <StructureStrip />
      <div class="flex flex-wrap items-start gap-4">
        <div class="min-w-0 flex-[999_1_560px]">
          <SegmentTable />
        </div>
        <!-- 右侧吸顶：滚动表格时位图和详情保持可见 -->
        <aside class="flex min-w-0 flex-[1_1_340px] flex-col gap-4 lg:sticky lg:top-0">
          <BitmapGrid />
          <SegmentDetail />
        </aside>
      </div>
    </template>
    <section v-else class="rounded-lg border border-dashed border-surface-300 bg-white px-4 py-12 text-center text-sm text-surface-500">
      粘贴 8583 报文后点「解析」，或编辑 JSON 后点「组包」。也可以从工具栏选一个示例报文。
    </section>
  </div>
</template>
