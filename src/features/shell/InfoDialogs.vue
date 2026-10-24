<script setup lang="ts">
import Dialog from 'primevue/dialog'
import { computed } from 'vue'
import { COMMAND_GROUPS, formatShortcut, type Command } from '../../commands'
import { useUiStore } from '../../stores/ui'

const props = defineProps<{ commands: Command[] }>()
const ui = useUiStore()

const shortcuts = computed(() =>
  props.commands
    .filter((c) => c.shortcut)
    .map((c) => ({
      label: `${COMMAND_GROUPS.find((g) => g.id === c.group)?.label} › ${c.label}`,
      key: formatShortcut(c.shortcut!, ui.isMac),
    })),
)

const about = [
  ['版本', '0.1.0'],
  ['技术栈', 'Tauri 2 · Vue 3 · TypeScript · PrimeVue · Tailwind 4'],
  ['内置规范', '银联 POS'],
  ['数据处理', '全部在本机完成，不上传报文'],
]

const visible = (name: 'about' | 'shortcuts') =>
  computed({
    get: () => ui.modal === name,
    set: (open: boolean) => (ui.modal = open ? name : null),
  })
const aboutOpen = visible('about')
const shortcutsOpen = visible('shortcuts')
</script>

<template>
  <Dialog v-model:visible="shortcutsOpen" header="快捷键列表" modal class="w-[28rem] max-w-[calc(100vw-2rem)]">
    <dl class="m-0 divide-y divide-surface-100 text-sm">
      <div v-for="s in shortcuts" :key="s.label" class="flex justify-between gap-4 py-1.5">
        <dt>{{ s.label }}</dt>
        <dd class="m-0 font-mono text-xs text-surface-600">{{ s.key }}</dd>
      </div>
    </dl>
    <p class="mt-3 mb-0 text-xs text-surface-500">桌面端由原生菜单注册快捷键；Web 版暂不提供。</p>
  </Dialog>

  <Dialog v-model:visible="aboutOpen" header="关于 8583 ⇄ JSON" modal class="w-[28rem] max-w-[calc(100vw-2rem)]">
    <dl class="m-0 divide-y divide-surface-100 text-sm">
      <div v-for="[k, v] in about" :key="k" class="flex justify-between gap-4 py-1.5">
        <dt>{{ k }}</dt>
        <dd class="m-0 text-right text-surface-600">{{ v }}</dd>
      </div>
    </dl>
  </Dialog>
</template>
