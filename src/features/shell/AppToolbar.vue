<script setup lang="ts">
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import Select from 'primevue/select'
import Toolbar from 'primevue/toolbar'
import type { MenuItem } from 'primevue/menuitem'
import { computed, ref } from 'vue'
import { COMMAND_GROUPS, formatShortcut, type Command } from '../../commands'
import { samples, type Sample } from '../../samples'
import { useHistoryStore } from '../../stores/history'
import { useMessageStore } from '../../stores/message'
import { useSpecStore } from '../../stores/spec'
import { useUiStore } from '../../stores/ui'

const props = defineProps<{ commands: Command[] }>()

const message = useMessageStore()
const spec = useSpecStore()
const history = useHistoryStore()
const ui = useUiStore()

const toolbarCommands = computed(() => props.commands.filter((c) => c.toolbar))
const sample = ref<Sample | null>(null)

function tooltip(c: Command) {
  return c.shortcut ? `${c.label}（${formatShortcut(c.shortcut, ui.isMac)}）` : c.label
}

// Web 端没有原生菜单，所有命令放进「更多」菜单
const more = ref<InstanceType<typeof Menu>>()
const moreItems = computed<MenuItem[]>(() =>
  COMMAND_GROUPS.map((g) => ({
    label: g.label,
    items: props.commands
      .filter((c) => c.group === g.id)
      .map((c) => ({ label: c.label, icon: c.icon, command: () => void c.run() })),
  })),
)
</script>

<template>
  <Toolbar class="!rounded-none !border-x-0 !border-t-0 !px-3 !py-2">
    <template #start>
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="mr-2 flex items-center gap-2 font-semibold whitespace-nowrap">
          <span class="flex size-7 items-center justify-center rounded-md bg-primary font-mono text-[9px] text-primary-contrast">8583</span>
          8583 ⇄ JSON
        </span>
        <Button
          v-for="c in toolbarCommands"
          :key="c.id"
          :icon="c.icon"
          :label="c.label.split(' ')[0].replace('…', '')"
          :title="tooltip(c)"
          :severity="c.id === 'message.parse' ? undefined : 'secondary'"
          :outlined="c.id === 'message.pack'"
          size="small"
          @click="c.run()"
        />
        <Select
          v-model="sample"
          :options="samples"
          option-label="title"
          placeholder="示例报文"
          size="small"
          class="ml-2 w-40"
          aria-label="示例报文"
          @change="sample && message.loadSample(sample)"
        />
        <span class="ml-2 text-xs text-surface-500">规范：{{ spec.current?.name ?? '加载中' }}</span>
      </div>
    </template>
    <template #end>
      <div class="flex items-center gap-1.5">
        <Button icon="pi pi-history" :label="`历史 ${history.items.length}`" severity="secondary" size="small" title="历史记录" @click="ui.historyOpen = true" />
        <Button icon="pi pi-sliders-h" label="域定义" severity="secondary" size="small" title="编辑当前规范" @click="ui.specOpen = true" />
        <template v-if="ui.platformKind === 'web'">
          <Button icon="pi pi-ellipsis-h" severity="secondary" size="small" text aria-label="更多" @click="more?.toggle($event)" />
          <Menu ref="more" :model="moreItems" popup />
        </template>
      </div>
    </template>
  </Toolbar>
</template>
