<script setup lang="ts">
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import Message from 'primevue/message'
import { useConfirm } from 'primevue/useconfirm'
import { computed, ref, watch } from 'vue'
import { useMessageStore } from '../../stores/message'
import { useSpecStore } from '../../stores/spec'
import { useUiStore } from '../../stores/ui'
import FieldEditor from './FieldEditor.vue'
import FieldTable from './FieldTable.vue'
import FrameSettings from './FrameSettings.vue'
import SpecList from './SpecList.vue'

const spec = useSpecStore()
const message = useMessageStore()
const ui = useUiStore()
const confirm = useConfirm()

const selectedField = ref<number | null>(null)
const applyProblems = ref<string[]>([])

// 打开时基于当前规范建立草稿；切换规范后草稿随之重建
watch(
  () => [ui.specOpen, spec.currentId] as const,
  ([open]) => {
    if (!open) return
    spec.startEdit()
    applyProblems.value = []
    const ids = Object.keys(spec.draft?.fields ?? {}).map(Number)
    if (selectedField.value == null || !ids.includes(selectedField.value)) selectedField.value = ids[0] ?? null
  },
  { immediate: true },
)

const status = computed(() =>
  spec.draftProblems.length
    ? { text: `${spec.draftProblems.length} 个问题待修正`, cls: 'text-red-700' }
    : spec.dirty
      ? { text: '● 有未应用的修改', cls: 'text-amber-800' }
      : { text: '已与当前解析结果同步', cls: 'text-surface-500' },
)

function close() {
  if (!spec.dirty) return void (ui.specOpen = false)
  confirm.require({
    header: '放弃未应用的修改？',
    message: '关闭后，本次对规范的修改不会保存。',
    acceptProps: { label: '放弃并关闭', severity: 'danger' },
    rejectProps: { label: '继续编辑', severity: 'secondary', outlined: true },
    accept: () => {
      spec.discard()
      ui.specOpen = false
    },
  })
}

function resetToPreset() {
  confirm.require({
    header: '恢复内置默认定义？',
    message: '草稿会恢复为内置预设的原始定义，点「完成并重新解析」后生效。',
    acceptProps: { label: '恢复默认' },
    rejectProps: { label: '取消', severity: 'secondary', outlined: true },
    accept: () => spec.resetDraftToPreset(),
  })
}

async function apply() {
  applyProblems.value = await spec.apply()
  if (applyProblems.value.length) return
  ui.specOpen = false
  if (message.hex.trim()) message.parse()
  else message.setStatus('ok', `规范「${spec.current?.name}」已保存`)
}
</script>

<template>
  <Drawer :visible="ui.specOpen" position="full" :show-close-icon="false" :block-scroll="true" class="!bg-surface-50" @update:visible="!$event && close()">
    <template #header>
      <div class="flex w-full flex-wrap items-center gap-2.5">
        <h2 class="m-0 text-base font-semibold">域定义配置</h2>
        <span class="text-[13px] text-surface-500">{{ spec.draft?.name }} · {{ Object.keys(spec.draft?.fields ?? {}).length }} 个域</span>
        <span class="text-xs font-medium" :class="status.cls">{{ status.text }}</span>
        <div class="ml-auto flex flex-wrap gap-2">
          <Button v-if="spec.currentEntry?.preset" label="恢复默认" icon="pi pi-refresh" severity="secondary" text size="small" @click="resetToPreset" />
          <Button label="放弃修改" severity="secondary" outlined size="small" :disabled="!spec.dirty" @click="spec.discard()" />
          <Button label="关闭" severity="secondary" outlined size="small" @click="close" />
          <Button label="完成并重新解析" icon="pi pi-check" size="small" :disabled="spec.draftProblems.length > 0" @click="apply" />
        </div>
      </div>
    </template>

    <Message v-if="spec.draftProblems.length || applyProblems.length" severity="error" class="mb-4">
      <ul class="m-0 pl-4 text-[13px]">
        <li v-for="p in spec.draftProblems.length ? spec.draftProblems : applyProblems" :key="p">{{ p }}</li>
      </ul>
    </Message>

    <div class="flex flex-wrap items-start gap-4">
      <div class="flex min-w-0 flex-[1_1_260px] flex-col gap-4">
        <SpecList />
        <FrameSettings />
      </div>
      <div class="min-w-0 flex-[999_1_520px]">
        <FieldTable v-model:selected="selectedField" />
      </div>
      <div class="min-w-0 flex-[1_1_320px]">
        <FieldEditor v-model:selected="selectedField" />
      </div>
    </div>
  </Drawer>
</template>
