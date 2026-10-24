<script setup lang="ts">
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint'
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, placeholder as placeholderExt, type DecorationSet } from '@codemirror/view'
import { basicSetup, EditorView } from 'codemirror'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { byteIndexAt, byteSpans } from '../../utils/hex'

const props = defineProps<{
  modelValue: string
  language: 'hex' | 'json'
  label: string
  placeholder?: string
  /** 仅 HEX：需要高亮的字节范围（选中段） */
  highlight?: { offset: number; len: number } | null
  /** 拉伸占满父级剩余高度（父级需为纵向 flex），否则固定 16rem */
  fill?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  /** 仅 HEX：用户点击或移动光标到某个字节 */
  cursorByte: [index: number]
}>()

const host = ref<HTMLDivElement>()
let view: EditorView | undefined

// 选中段高亮：外部通过 effect 设置，文档变化时随之映射
const setHighlight = StateEffect.define<{ from: number; to: number } | null>()
const segmentMark = Decoration.mark({ class: 'cm-segment' })
const highlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const e of tr.effects) {
      if (e.is(setHighlight)) deco = e.value ? Decoration.set([segmentMark.range(e.value.from, e.value.to)]) : Decoration.none
    }
    return deco
  },
  provide: (f) => EditorView.decorations.from(f),
})

const hexLinter = linter((v) => {
  const diagnostics: Diagnostic[] = []
  const text = v.state.doc.toString()
  for (const m of text.matchAll(/[^0-9a-fA-F\s]+/g)) {
    diagnostics.push({ from: m.index, to: m.index + m[0].length, severity: 'error', message: '不是十六进制字符' })
  }
  return diagnostics
})

const theme = EditorView.theme({
  '&': { position: 'absolute', inset: '0', fontSize: '13px', backgroundColor: 'var(--p-surface-50)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.7' },
  '.cm-gutters': { backgroundColor: 'var(--p-surface-50)', borderRight: '1px solid var(--p-surface-200)' },
  '.cm-segment': { backgroundColor: 'var(--p-blue-200)', borderRadius: '2px' },
})

function extensions(): Extension[] {
  const common = [
    basicSetup,
    theme,
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ 'aria-label': props.label, spellcheck: 'false' }),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) emit('update:modelValue', u.state.doc.toString())
      const userMoved = u.selectionSet && !u.docChanged && u.transactions.some((tr) => tr.isUserEvent('select'))
      if (props.language === 'hex' && userMoved) {
        const index = byteIndexAt(u.state.doc.toString(), u.state.selection.main.head)
        if (index >= 0) emit('cursorByte', index)
      }
    }),
  ]
  if (props.placeholder) common.push(placeholderExt(props.placeholder))
  return props.language === 'json'
    ? [...common, json(), linter((v) => (v.state.doc.length ? jsonParseLinter()(v) : [])), lintGutter()]
    : [...common, highlightField, hexLinter]
}

/** 字节范围 → 文本位置范围；超出当前文本时不高亮。 */
function charRange(h: { offset: number; len: number } | null | undefined) {
  if (!h || !view) return null
  const spans = byteSpans(view.state.doc.toString())
  const first = spans[h.offset]
  const last = spans[h.offset + h.len - 1]
  return first && last ? { from: first.from, to: last.to } : null
}

function applyHighlight(scroll: boolean) {
  if (!view || props.language !== 'hex') return
  const range = charRange(props.highlight)
  view.dispatch({ effects: setHighlight.of(range) })
  if (scroll && range) scrollInside(range.from)
}

/**
 * 只滚动编辑器自己的滚动区，让高亮行可见。
 * 不用 EditorView.scrollIntoView：它会连带滚动外层页面，点击表格或位图时页面会被拽回编辑器附近。
 */
function scrollInside(pos: number) {
  const v = view!
  v.requestMeasure({
    read: () => ({ block: v.lineBlockAt(pos), top: v.scrollDOM.scrollTop, height: v.scrollDOM.clientHeight }),
    write: ({ block, top, height }) => {
      if (block.top < top || block.bottom > top + height) v.scrollDOM.scrollTop = Math.max(0, block.top - height / 3)
    },
  })
}

onMounted(() => {
  view = new EditorView({
    parent: host.value!,
    state: EditorState.create({ doc: props.modelValue, extensions: extensions() }),
  })
  applyHighlight(false)
})

onBeforeUnmount(() => view?.destroy())

// 外部改了内容（载入示例、格式化、组包）时同步进编辑器
watch(
  () => props.modelValue,
  (value) => {
    if (!view || value === view.state.doc.toString()) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    applyHighlight(false)
  },
)

watch(
  () => props.highlight,
  () => applyHighlight(true),
  { deep: true },
)
</script>

<template>
  <!-- 编辑器绝对定位铺满宿主，高度由外层决定：默认 16rem，另一区折叠时随可用空间拉伸 -->
  <div ref="host" class="relative min-w-0" :class="fill ? 'min-h-64 flex-1' : 'h-64'" />
</template>
