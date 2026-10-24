import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { codec, type Spec } from '../codec'

export const useSpecStore = defineStore('spec', () => {
  const current = ref<Spec | null>(null)
  /** 域定义弹窗里编辑的副本；点「完成并重新解析」才写回 current（M3）。 */
  const draft = ref<Spec | null>(null)
  const dirty = ref(false)

  const fieldCount = computed(() => (current.value ? Object.keys(current.value.fields).length : 0))

  function loadPreset(name: string) {
    current.value = codec.preset(name)
    draft.value = null
    dirty.value = false
  }

  return { current, draft, dirty, fieldCount, loadPreset }
})
