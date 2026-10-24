<script setup lang="ts">
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import { computed } from 'vue'
import { useSpecStore } from '../../stores/spec'
import { useUiStore } from '../../stores/ui'

// 骨架版：只读展示当前规范。编辑、草稿、导入导出在 M3 实现。
const spec = useSpecStore()
const ui = useUiStore()

const lenTypeText = { fixed: '定长', llVar: 'LLVAR', lllVar: 'LLLVAR' } as const
const rows = computed(() =>
  Object.entries(spec.current?.fields ?? {}).map(([id, f]) => ({
    id: Number(id),
    name: f.name,
    format: f.kind,
    maxLen: f.maxLen,
    lenType: lenTypeText[f.lenType],
  })),
)
</script>

<template>
  <Dialog v-model:visible="ui.specOpen" :header="`域定义配置 · ${spec.current?.name ?? ''}`" modal maximizable class="w-[56rem] max-w-[calc(100vw-2rem)]">
    <DataTable :value="rows" data-key="id" size="small" scrollable scroll-height="60vh">
      <Column field="id" header="域" />
      <Column field="name" header="名称" />
      <Column field="format" header="类型" body-class="font-mono" />
      <Column field="maxLen" header="最大长度" body-class="font-mono" />
      <Column field="lenType" header="长度形式" />
    </DataTable>
  </Dialog>
</template>
