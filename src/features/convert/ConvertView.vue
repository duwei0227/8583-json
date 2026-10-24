<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useMessageStore } from '../../stores/message'
import { useUiStore } from '../../stores/ui'
import { compactHex } from '../../utils/hex'
import BitmapGrid from './BitmapGrid.vue'
import SegmentDetail from './SegmentDetail.vue'
import SegmentTable from './SegmentTable.vue'
import StructureStrip from './StructureStrip.vue'

// CodeMirror 体积较大，单独拆包按需加载
const CodeEditor = defineAsyncComponent(() => import('./CodeEditor.vue'))

const message = useMessageStore()
const ui = useUiStore()

const hexBytes = computed(() => Math.floor(compactHex(message.hex).length / 2))

// HEX 编辑器与选中段双向联动：高亮选中段的字节；点击某个字节则选中它所在的段
const highlight = computed(() => {
  const s = message.decoded?.segments.find((x) => x.id === message.selectedId)
  return s ? { offset: s.offset, len: s.len } : null
})

function selectByte(index: number) {
  const s = message.decoded?.segments.find((x) => index >= x.offset && index < x.offset + x.len)
  if (s) message.select(s.id)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid gap-4" :class="ui.layout === 'row' ? 'md:grid-cols-2' : 'grid-cols-1'">
      <section class="flex flex-col overflow-hidden rounded-lg border border-surface-200 bg-white">
        <div class="flex items-center gap-2 border-b border-surface-200 px-3.5 py-2.5">
          <h2 class="m-0 text-sm font-semibold">8583 报文</h2>
          <span class="font-mono text-xs text-surface-500">HEX · {{ hexBytes }} 字节</span>
        </div>
        <CodeEditor
          id="hex-in"
          v-model="message.hex"
          language="hex"
          label="8583 报文（HEX）"
          placeholder="粘贴十六进制报文，空格和换行会被忽略；点击任一字节可选中它所在的段"
          :highlight="highlight"
          @cursor-byte="selectByte"
        />
      </section>
      <section class="flex flex-col overflow-hidden rounded-lg border border-surface-200 bg-white">
        <div class="flex items-center gap-2 border-b border-surface-200 px-3.5 py-2.5">
          <h2 class="m-0 text-sm font-semibold">JSON</h2>
          <span class="font-mono text-xs text-surface-500">{ mti, tpdu, header, fields }</span>
        </div>
        <CodeEditor id="json-in" v-model="message.json" language="json" label="JSON 报文" placeholder='{ "mti": "0200", "fields": { "3": "000000" } }' />
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
