<script setup lang="ts">
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useConfirm } from 'primevue/useconfirm'
import { computed } from 'vue'
import type { FieldSpec } from '../../codec'
import type { SubField } from '../../codec/types/SubField'
import { useSpecStore } from '../../stores/spec'
import PartsEditor from './PartsEditor.vue'

const selected = defineModel<number | null>('selected', { required: true })
const spec = useSpecStore()
const confirm = useConfirm()

const ids = computed(() => Object.keys(spec.draft?.fields ?? {}).map(Number))
const field = computed(() => (selected.value != null ? spec.draft?.fields[selected.value] : undefined))
const index = computed(() => ids.value.indexOf(selected.value ?? -1))
const options = computed(() => ids.value.map((id) => ({ id, label: `第 ${id} 域 · ${spec.draft!.fields[id].name}` })))

const kinds = [
  { value: 'n', label: 'n · 数字（BCD）' },
  { value: 'z', label: 'z · 磁道（BCD，= 编为 D）' },
  { value: 'an', label: 'an · 字母数字（ASCII）' },
  { value: 'ans', label: 'ans · 含特殊字符（ASCII）' },
  { value: 'b', label: 'b · 二进制' },
]
const lenTypes = [
  { value: 'fixed', label: '定长' },
  { value: 'llVar', label: 'LLVAR · 2 位长度前缀' },
  { value: 'lllVar', label: 'LLLVAR · 3 位长度前缀' },
]
const pads = [
  { value: 'default', label: '默认（按类型）' },
  { value: 'leftZero', label: '左补 0' },
  { value: 'rightZero', label: '右补 0' },
  { value: 'rightF', label: '右补 F' },
  { value: 'rightSpace', label: '右补空格' },
]
const subTypes = computed(() => [
  { value: 'none', label: '不拆分' },
  ...(field.value?.kind === 'b' ? [{ value: 'tlv', label: 'TLV（如 55 域）' }] : [{ value: 'positional', label: '按位置切分（如 60 域）' }]),
])

const lengthLabel = computed(() => {
  const f = field.value
  if (!f) return ''
  if (f.kind === 'b') return f.lenType === 'fixed' ? '长度（bit，8 的倍数）' : '最大长度（字节）'
  return f.lenType === 'fixed' ? '长度' : '最大长度'
})
const hint = computed(() => {
  const f = field.value
  if (!f) return ''
  if (f.kind === 'b') return 'b 型定长按 bit 计（b64 = 8 字节），变长按字节计'
  if (f.kind === 'n' || f.kind === 'z') return '数字按位数计，2 位压缩为 1 字节'
  return '按字符数计，1 个字符占 1 字节'
})
const preview = computed(() => (field.value ? JSON.stringify({ [selected.value!]: field.value }, null, 2) : ''))

function patch(change: Partial<FieldSpec>) {
  if (selected.value == null || !field.value) return
  const next: FieldSpec = { ...field.value, ...change }
  // 切换类型后，原有的子域方式可能不再适用（TLV 只适用于 b 型）
  if (next.sub?.type === 'tlv' && next.kind !== 'b') delete next.sub
  if (next.sub?.type === 'positional' && next.kind === 'b') delete next.sub
  if (change.pad === undefined && 'pad' in change) delete next.pad
  spec.setField(selected.value, next)
}

function setSub(type: string) {
  if (type === 'none') {
    const next = { ...field.value! }
    delete next.sub
    spec.setField(selected.value!, next)
  } else if (type === 'tlv') patch({ sub: { type: 'tlv' } })
  else patch({ sub: { type: 'positional', parts: [{ name: '子域 1', len: 1 }] } })
}

function setParts(parts: SubField[]) {
  patch({ sub: { type: 'positional', parts } })
}

function remove() {
  const id = selected.value
  if (id == null) return
  confirm.require({
    header: `删除第 ${id} 域？`,
    message: '删除后，含有该域的报文将无法解析。点「完成并重新解析」前仍可放弃修改。',
    acceptProps: { label: '删除', severity: 'danger' },
    rejectProps: { label: '取消', severity: 'secondary', outlined: true },
    accept: () => {
      const next = ids.value[index.value + 1] ?? ids.value[index.value - 1] ?? null
      spec.removeField(id)
      selected.value = next
    },
  })
}
</script>

<template>
  <section v-if="field" class="flex flex-col gap-2.5 rounded-lg border border-surface-200 bg-white p-3.5">
    <div class="flex items-center gap-1.5">
      <h3 class="m-0 text-sm font-semibold">编辑域</h3>
      <Button label="删除该域" icon="pi pi-trash" severity="danger" text size="small" class="ml-auto" @click="remove" />
    </div>
    <div class="flex items-center gap-1.5">
      <Select v-model="selected" :options="options" option-label="label" option-value="id" size="small" class="min-w-0 flex-1" aria-label="选择要编辑的域" />
      <Button icon="pi pi-chevron-left" severity="secondary" outlined size="small" aria-label="上一个域" :disabled="index <= 0" @click="selected = ids[index - 1]" />
      <Button icon="pi pi-chevron-right" severity="secondary" outlined size="small" aria-label="下一个域" :disabled="index >= ids.length - 1" @click="selected = ids[index + 1]" />
    </div>

    <label for="field-name" class="text-xs text-surface-500">名称</label>
    <InputText id="field-name" fluid :model-value="field.name" size="small" @update:model-value="patch({ name: String($event ?? '') })" />

    <label for="field-kind" class="text-xs text-surface-500">类型</label>
    <Select input-id="field-kind" fluid :model-value="field.kind" :options="kinds" option-label="label" option-value="value" size="small" @update:model-value="patch({ kind: $event })" />

    <label for="field-len-type" class="text-xs text-surface-500">长度形式</label>
    <Select input-id="field-len-type" fluid :model-value="field.lenType" :options="lenTypes" option-label="label" option-value="value" size="small" @update:model-value="patch({ lenType: $event })" />

    <label for="field-max" class="text-xs text-surface-500">{{ lengthLabel }}</label>
    <InputNumber input-id="field-max" fluid :model-value="field.maxLen" :min="1" :max="9999" size="small" @update:model-value="patch({ maxLen: Number($event ?? 1) })" />
    <span class="text-xs text-surface-500">{{ hint }}</span>

    <label for="field-pad" class="text-xs text-surface-500">补位</label>
    <Select input-id="field-pad" fluid :model-value="field.pad ?? 'default'" :options="pads" option-label="label" option-value="value" size="small" @update:model-value="patch({ pad: $event === 'default' ? undefined : $event })" />

    <label for="field-sub" class="text-xs text-surface-500">子域</label>
    <Select input-id="field-sub" fluid :model-value="field.sub?.type ?? 'none'" :options="subTypes" option-label="label" option-value="value" size="small" @update:model-value="setSub" />
    <PartsEditor v-if="field.sub?.type === 'positional'" :parts="field.sub.parts" label="子域" :unit="field.kind === 'n' || field.kind === 'z' ? '位' : '个字符'" @update:parts="setParts" />

    <div class="flex flex-col gap-1 border-t border-surface-100 pt-2.5">
      <span class="text-xs text-surface-500">配置片段（导出格式）</span>
      <pre class="m-0 rounded-md bg-surface-900 p-2.5 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-surface-100">{{ preview }}</pre>
    </div>
  </section>
  <section v-else class="rounded-lg border border-dashed border-surface-300 bg-white p-6 text-center text-sm text-surface-500">在左侧表格中选择一个域进行编辑</section>
</template>
