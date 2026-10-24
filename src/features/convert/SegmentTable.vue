<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { transactionName } from '../../explain/meanings'
import { describeSegments } from '../../explain/segments'
import { useMessageStore } from '../../stores/message'
import { useSpecStore } from '../../stores/spec'
import { KIND_STYLES } from './kindStyles'

const message = useMessageStore()
const spec = useSpecStore()

const rows = computed(() => (message.decoded && spec.current ? describeSegments(message.decoded, spec.current) : []))
const summary = computed(() => {
  const d = message.decoded
  if (!d) return ''
  return `MTI ${d.mti} · ${transactionName(d)} · ${rows.value.filter((r) => r.kind === 'field').length} 个数据域`
})

// 从报文结构点击时，把对应行平滑滚动到视野中间
const tbody = ref<HTMLTableSectionElement>()
watch(
  () => message.revealRequest,
  async (req) => {
    if (!req) return
    await nextTick()
    const row = tbody.value?.querySelector<HTMLElement>(`tr[data-segment-id="${CSS.escape(req.id)}"]`)
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  },
)

const truncate = (text: string, max: number) => (text.length > max ? text.slice(0, max) + '…' : text)
</script>

<template>
  <section class="min-w-0 overflow-hidden rounded-lg border border-surface-200 bg-white">
    <div class="flex flex-wrap items-center gap-2 border-b border-surface-200 px-3.5 py-3">
      <h2 class="m-0 text-sm font-semibold">逐段解析</h2>
      <span class="text-xs text-surface-500">{{ summary }} · 点击任一行查看拆解说明</span>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full min-w-[760px] border-collapse text-[13px]">
        <thead>
          <tr class="bg-surface-50 text-left text-xs whitespace-nowrap text-surface-500">
            <th scope="col" class="px-3.5 py-2 font-medium">段</th>
            <th scope="col" class="px-2.5 py-2 font-medium">名称</th>
            <th scope="col" class="px-2.5 py-2 font-medium">格式</th>
            <th scope="col" class="px-2.5 py-2 font-medium">长度</th>
            <th scope="col" class="px-2.5 py-2 font-medium">原始字节</th>
            <th scope="col" class="px-2.5 py-2 font-medium">解析值</th>
            <th scope="col" class="px-3.5 py-2 font-medium">含义</th>
          </tr>
        </thead>
        <tbody ref="tbody">
          <tr
            v-for="row in rows"
            :key="row.id"
            :data-segment-id="row.id"
            class="cursor-pointer border-t border-surface-100"
            :class="row.id === message.selectedId ? 'bg-blue-100' : row.id === message.hoverId ? 'bg-surface-50' : 'hover:bg-surface-50'"
            @click="message.select(row.id)"
            @mouseenter="message.hover(row.id)"
            @mouseleave="message.hover(null)"
          >
            <!-- 选中态：左侧主色竖条 + 加深底色 + 徽标反白 + 名称加粗 -->
            <td class="px-3.5 py-1.5" :class="{ 'shadow-[inset_3px_0_0_var(--p-primary-color)]': row.id === message.selectedId }">
              <button
                type="button"
                class="min-h-7 min-w-13 cursor-pointer rounded-md border px-2 font-mono text-xs font-semibold whitespace-nowrap"
                :class="row.id === message.selectedId ? KIND_STYLES[row.kind].solid : KIND_STYLES[row.kind].soft"
                :aria-label="`查看 ${row.tag} 的解析说明`"
                @click.stop="message.select(row.id)"
              >
                {{ row.tag }}
              </button>
            </td>
            <td class="px-2.5 py-1.5 whitespace-nowrap" :class="{ 'font-semibold': row.id === message.selectedId }">{{ row.name }}</td>
            <td class="px-2.5 py-1.5 font-mono text-xs whitespace-nowrap text-surface-600">{{ row.format }}</td>
            <td class="px-2.5 py-1.5 font-mono text-xs text-surface-600">{{ row.length }}</td>
            <td class="px-2.5 py-1.5 font-mono text-xs whitespace-nowrap text-surface-500">{{ truncate(row.raw, 26) }}</td>
            <td class="px-2.5 py-1.5 font-mono text-xs break-all">{{ truncate(row.value, 40) }}</td>
            <td class="px-3.5 py-1.5 text-xs text-surface-700">{{ row.meaning }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
