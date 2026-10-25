<script setup lang="ts">
import Button from 'primevue/button'
import { useConfirm } from 'primevue/useconfirm'
import { getPlatform } from '../../platform'
import { useMessageStore } from '../../stores/message'
import { useSpecStore, type SpecEntry } from '../../stores/spec'
import { useUiStore } from '../../stores/ui'

const spec = useSpecStore()
const message = useMessageStore()
const ui = useUiStore()
const confirm = useConfirm()

/** 有未应用的修改时，先确认是否放弃。 */
function guardDirty(next: () => void) {
  if (!spec.dirty) return next()
  confirm.require({
    header: '放弃未应用的修改？',
    message: '当前规范有未应用的修改，继续操作会丢失这些修改。',
    acceptProps: { label: '放弃修改', severity: 'danger' },
    rejectProps: { label: '取消', severity: 'secondary', outlined: true },
    accept: next,
  })
}

function select(entry: SpecEntry) {
  if (entry.id !== spec.currentId) guardDirty(() => void spec.switchTo(entry.id))
}

function create() {
  guardDirty(() => void spec.create(`${spec.current?.name ?? '规范'} 副本`))
}

function remove(entry: SpecEntry) {
  confirm.require({
    header: `删除规范「${entry.spec.name}」？`,
    message: '删除后无法恢复。如需保留，请先导出。',
    acceptProps: { label: '删除', severity: 'danger' },
    rejectProps: { label: '取消', severity: 'secondary', outlined: true },
    accept: () => void spec.remove(entry.id),
  })
}

async function exportCurrent() {
  const name = `${spec.current?.name ?? 'spec'}.json`
  if (await (await getPlatform()).saveFile(name, spec.exportJson())) message.setStatus('ok', `已导出 ${name}`)
}
</script>

<template>
  <section class="flex flex-col gap-2 rounded-lg border border-surface-200 bg-white p-3.5">
    <h3 class="m-0 mb-1 text-sm font-semibold">规范列表</h3>
    <div
      v-for="entry in spec.entries"
      :key="entry.id"
      class="flex items-center gap-1 rounded-lg border"
      :class="entry.id === spec.currentId ? 'border-primary bg-blue-50 shadow-[inset_3px_0_0_var(--p-primary-color)]' : 'border-surface-200'"
    >
      <button type="button" class="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.5 bg-transparent px-3 py-2 text-left" :aria-pressed="entry.id === spec.currentId" @click="select(entry)">
        <span class="truncate text-[14px] font-semibold">{{ entry.spec.name }}</span>
        <span class="text-xs text-surface-500">
          {{ entry.preset ? '内置' : '自定义' }} · {{ Object.keys(entry.spec.fields).length }} 个域{{ entry.id === spec.currentId ? ' · 当前使用' : '' }}
        </span>
      </button>
      <Button v-if="!entry.preset" icon="pi pi-trash" severity="danger" text size="small" :aria-label="`删除规范 ${entry.spec.name}`" @click="remove(entry)" />
    </div>
    <div class="mt-1 grid grid-cols-3 gap-1.5">
      <Button label="新建" icon="pi pi-plus" size="small" severity="secondary" title="以当前规范为模板新建" @click="create" />
      <Button label="导入" icon="pi pi-download" size="small" severity="secondary" @click="ui.importOpen = true" />
      <Button label="导出" icon="pi pi-upload" size="small" severity="secondary" @click="exportCurrent" />
    </div>
  </section>
</template>
