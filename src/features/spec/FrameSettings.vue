<script setup lang="ts">
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import type { FrameSpec } from '../../codec/types/FrameSpec'
import type { SubField } from '../../codec/types/SubField'
import { useSpecStore } from '../../stores/spec'
import PartsEditor from './PartsEditor.vue'

const spec = useSpecStore()

const lengthHeaders = [
  { value: 'binary2', label: '2 字节二进制' },
  { value: 'ascii4', label: '4 位 ASCII 数字' },
  { value: 'none', label: '无' },
]
const numEncodings = [
  { value: 'bcd', label: 'BCD' },
  { value: 'ascii', label: 'ASCII' },
]
const bitmapEncodings = [
  { value: 'binary', label: '二进制（8/16 字节）' },
  { value: 'asciiHex', label: 'ASCII HEX（16/32 字符）' },
]

function setFrame<K extends keyof FrameSpec>(key: K, value: FrameSpec[K]) {
  spec.edit((s) => (s.frame[key] = value))
}
function setHeaderLen(len: number) {
  spec.edit((s) => {
    s.frame.header.len = len
    if (len === 0) s.frame.header.parts = []
  })
}
function setHeaderParts(parts: SubField[]) {
  spec.edit((s) => (s.frame.header.parts = parts))
}
</script>

<template>
  <section v-if="spec.draft" class="flex flex-col gap-2.5 rounded-lg border border-surface-200 bg-white p-3.5">
    <h3 class="m-0 text-sm font-semibold">规范与报文结构</h3>

    <label for="spec-name" class="text-xs text-surface-500">规范名称</label>
    <InputText id="spec-name" fluid :model-value="spec.draft.name" size="small" @update:model-value="spec.edit((s) => (s.name = String($event ?? '')))" />

    <label for="frame-len" class="text-xs text-surface-500">长度头</label>
    <Select input-id="frame-len" fluid :model-value="spec.draft.frame.lengthHeader" :options="lengthHeaders" option-label="label" option-value="value" size="small" @update:model-value="setFrame('lengthHeader', $event)" />

    <label for="frame-tpdu" class="text-xs text-surface-500">TPDU 字节数（0 表示没有）</label>
    <InputNumber input-id="frame-tpdu" fluid :model-value="spec.draft.frame.tpduLen" :min="0" :max="16" size="small" show-buttons @update:model-value="setFrame('tpduLen', Number($event ?? 0))" />

    <label for="frame-header" class="text-xs text-surface-500">报文头字节数（0 表示没有）</label>
    <InputNumber input-id="frame-header" fluid :model-value="spec.draft.frame.header.len" :min="0" :max="32" size="small" show-buttons @update:model-value="setHeaderLen(Number($event ?? 0))" />
    <PartsEditor
      v-if="spec.draft.frame.header.len > 0"
      :parts="spec.draft.frame.header.parts"
      label="报文头子段（按 BCD 展开后的位数切分）"
      unit="位"
      @update:parts="setHeaderParts"
    />

    <div class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2 border-t border-surface-100 pt-2.5">
      <label for="frame-mti" class="text-xs text-surface-500">MTI 编码</label>
      <Select input-id="frame-mti" fluid :model-value="spec.draft.frame.mtiEncoding" :options="numEncodings" option-label="label" option-value="value" size="small" @update:model-value="setFrame('mtiEncoding', $event)" />
      <label for="frame-bitmap" class="text-xs text-surface-500">位图编码</label>
      <Select input-id="frame-bitmap" fluid :model-value="spec.draft.frame.bitmapEncoding" :options="bitmapEncodings" option-label="label" option-value="value" size="small" @update:model-value="setFrame('bitmapEncoding', $event)" />
      <label for="frame-prefix" class="text-xs text-surface-500">长度前缀</label>
      <Select input-id="frame-prefix" fluid :model-value="spec.draft.frame.lenPrefixEncoding" :options="numEncodings" option-label="label" option-value="value" size="small" @update:model-value="setFrame('lenPrefixEncoding', $event)" />
    </div>
  </section>
</template>
