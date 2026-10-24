<script setup lang="ts">
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import { computed } from 'vue'
import type { SubField } from '../../codec/types/SubField'

// 子段列表编辑器：报文头子段和定长子域共用
const props = defineProps<{ parts: SubField[]; unit: string; label: string }>()
const emit = defineEmits<{ 'update:parts': [parts: SubField[]] }>()

const total = computed(() => props.parts.reduce((sum, p) => sum + p.len, 0))

function update(i: number, patch: Partial<SubField>) {
  emit('update:parts', props.parts.map((p, j) => (j === i ? { ...p, ...patch } : p)))
}
function remove(i: number) {
  emit('update:parts', props.parts.filter((_, j) => j !== i))
}
function add() {
  emit('update:parts', [...props.parts, { name: `子段 ${props.parts.length + 1}`, len: 1 }])
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between text-xs text-surface-500">
      <span>{{ label }}</span>
      <span>共 {{ total }} {{ unit }}</span>
    </div>
    <div v-for="(part, i) in parts" :key="i" class="flex items-center gap-1.5">
      <InputText :model-value="part.name" size="small" class="min-w-0 flex-1" :aria-label="`${label}第 ${i + 1} 项名称`" @update:model-value="update(i, { name: String($event ?? '') })" />
      <InputNumber :model-value="part.len" :min="1" :max="999" size="small" input-class="w-14 font-mono" :aria-label="`${label}第 ${i + 1} 项长度`" @update:model-value="update(i, { len: Number($event ?? 1) })" />
      <Button icon="pi pi-times" severity="secondary" text size="small" :aria-label="`删除${label}第 ${i + 1} 项`" @click="remove(i)" />
    </div>
    <Button label="添加一项" icon="pi pi-plus" size="small" severity="secondary" text class="self-start" @click="add" />
  </div>
</template>
