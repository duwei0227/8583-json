import { defineStore } from 'pinia'
import { ref } from 'vue'

export type Modal = 'about' | 'shortcuts' | 'fields' | null

export const useUiStore = defineStore('ui', () => {
  const platformKind = ref<'web' | 'desktop'>('web')
  const isMac = ref(typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent))
  const historyOpen = ref(false)
  const specOpen = ref(false)
  const importOpen = ref(false)
  /** 文件正被拖到窗口上方 */
  const dragging = ref(false)
  const modal = ref<Modal>(null)
  /** 编辑器左右或上下排列 */
  const layout = ref<'row' | 'col'>('row')
  /** 报文区（HEX、JSON 编辑器）和结构与解析区各自展开或折叠，折叠一个可让另一个占满屏幕 */
  const editorsOpen = ref(true)
  const analysisOpen = ref(true)

  return { platformKind, isMac, historyOpen, specOpen, importOpen, dragging, modal, layout, editorsOpen, analysisOpen }
})
