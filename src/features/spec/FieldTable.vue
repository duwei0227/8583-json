<script setup lang="ts">
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import { computed, ref } from 'vue'
import { fieldFormat } from '../../explain/segments'
import { useSpecStore } from '../../stores/spec'

const selected = defineModel<number | null>('selected', { required: true })
const spec = useSpecStore()

const LEN_TYPE = { fixed: '定长', llVar: 'LLVAR', lllVar: 'LLLVAR' } as const
const ENCODING = { n: 'BCD', z: 'BCD', an: 'ASCII', ans: 'ASCII', b: '二进制' } as const

const rows = computed(() =>
  Object.entries(spec.draft?.fields ?? {}).map(([id, f]) => ({
    id: Number(id),
    name: f.name,
    format: fieldFormat(f),
    lenType: LEN_TYPE[f.lenType],
    encoding: ENCODING[f.kind],
    sub: f.sub?.type === 'tlv' ? 'TLV' : f.sub?.type === 'positional' ? `${f.sub.parts.length} 个子域` : '',
  })),
)

const newId = ref<number | null>(null)
const addError = computed(() => {
  if (newId.value == null) return ''
  if (newId.value < 2 || newId.value > 128) return '域号须在 2–128 之间'
  return spec.draft?.fields[newId.value] ? `第 ${newId.value} 域已存在` : ''
})

function add() {
  if (newId.value == null || addError.value) return
  const id = newId.value
  spec.setField(id, { name: '新数据域', kind: 'ans', maxLen: 99, lenType: 'llVar' })
  selected.value = id
  newId.value = null
}
</script>

<template>
  <section class="min-w-0 overflow-hidden rounded-lg border border-surface-200 bg-white">
    <div class="flex flex-wrap items-center gap-2 border-b border-surface-200 px-3.5 py-2.5">
      <h3 class="m-0 text-sm font-semibold">域定义</h3>
      <span class="text-xs text-surface-500">{{ rows.length }} 个域 · 点击一行编辑</span>
      <div class="ml-auto flex items-center gap-1.5">
        <InputNumber v-model="newId" :min="2" :max="128" placeholder="域号" size="small" input-class="w-20 font-mono" aria-label="新增域的域号" :invalid="!!addError" @keydown.enter="add" />
        <Button label="新增域" icon="pi pi-plus" size="small" severity="secondary" :disabled="newId == null || !!addError" @click="add" />
      </div>
      <p v-if="addError" class="m-0 w-full text-right text-xs text-red-700">{{ addError }}</p>
    </div>
    <div class="max-h-[calc(100vh-14rem)] overflow-auto">
      <table class="w-full min-w-[560px] border-collapse text-[14px]">
        <thead class="sticky top-0 z-10">
          <tr class="bg-surface-50 text-left text-xs whitespace-nowrap text-surface-500">
            <th scope="col" class="px-3.5 py-2 font-medium">域</th>
            <th scope="col" class="px-2.5 py-2 font-medium">名称</th>
            <th scope="col" class="px-2.5 py-2 font-medium">格式</th>
            <th scope="col" class="px-2.5 py-2 font-medium">长度形式</th>
            <th scope="col" class="px-2.5 py-2 font-medium">编码</th>
            <th scope="col" class="px-3.5 py-2 font-medium">子域</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.id"
            class="cursor-pointer border-t border-surface-100"
            :class="row.id === selected ? 'bg-blue-100' : 'hover:bg-surface-50'"
            @click="selected = row.id"
          >
            <td class="px-3.5 py-1.5" :class="{ 'shadow-[inset_3px_0_0_var(--p-primary-color)]': row.id === selected }">
              <button
                type="button"
                class="min-h-7 min-w-11 cursor-pointer rounded-md border px-2 font-mono text-xs font-semibold"
                :class="row.id === selected ? 'border-primary bg-primary text-primary-contrast' : 'border-surface-200 bg-white text-surface-900'"
                :aria-label="`编辑第 ${row.id} 域`"
                @click.stop="selected = row.id"
              >
                {{ row.id }}
              </button>
            </td>
            <td class="px-2.5 py-1.5" :class="{ 'font-semibold': row.id === selected }">{{ row.name }}</td>
            <td class="px-2.5 py-1.5 font-mono text-xs">{{ row.format }}</td>
            <td class="px-2.5 py-1.5 text-xs">{{ row.lenType }}</td>
            <td class="px-2.5 py-1.5 text-xs">{{ row.encoding }}</td>
            <td class="px-3.5 py-1.5 text-xs text-surface-600">{{ row.sub }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
