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

  return { platformKind, isMac, historyOpen, specOpen, importOpen, dragging, modal, layout }
})
