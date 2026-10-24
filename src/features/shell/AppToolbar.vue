<script setup lang="ts">
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import Select from 'primevue/select'
import Toolbar from 'primevue/toolbar'
import type { MenuItem } from 'primevue/menuitem'
import { computed, ref } from 'vue'
import { COMMAND_GROUPS, formatShortcut, type Command } from '../../commands'
import { samples } from '../../samples'
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
const specOptions = computed(() => spec.entries.map((e) => ({ id: e.id, name: e.spec.name })))

async function switchSpec(id: string) {
  await spec.switchTo(id)
  if (message.hex.trim()) message.parse()
  else message.setStatus('info', `已切换到规范「${spec.current?.name}」`)
}

// 示例是一次性动作而不是状态：点一下就载入，按交易类别分组
const sampleMenu = ref<InstanceType<typeof Menu>>()
const SAMPLE_GROUPS = ['金融类', '冲正类', '管理类'] as const
const groupOf = (mti: string) => (/^0[12]/.test(mti) ? '金融类' : mti.startsWith('04') ? '冲正类' : '管理类')
const sampleItems: MenuItem[] = SAMPLE_GROUPS.map((g) => ({
  label: g,
  items: samples
    .filter((s) => groupOf(s.message.mti) === g)
    .map((s) => ({ label: s.title, mti: s.message.mti, command: () => message.loadSample(s) })),
}))

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
      </div>
    </template>
    <template #end>
      <div class="flex items-center gap-1.5">
        <Button severity="secondary" size="small" aria-haspopup="true" @click="sampleMenu?.toggle($event)">
          <span class="pi pi-file" aria-hidden="true" />
          <span>载入示例</span>
          <span class="pi pi-chevron-down text-[10px]" aria-hidden="true" />
        </Button>
        <Menu ref="sampleMenu" :model="sampleItems" popup class="w-52">
          <template #item="{ item, props: p }">
            <a v-bind="p.action" class="flex items-center gap-3">
              <span class="flex-1">{{ item.label }}</span>
              <span class="font-mono text-xs text-surface-500">{{ item.mti }}</span>
            </a>
          </template>
        </Menu>
        <Button icon="pi pi-history" :label="`历史 ${history.items.length}`" severity="secondary" size="small" title="历史记录" @click="ui.historyOpen = true" />
        <span class="mx-1.5 h-5 w-px bg-surface-300" aria-hidden="true" />
        <Select
          :model-value="spec.currentId"
          :options="specOptions"
          option-label="name"
          option-value="id"
          size="small"
          class="w-44"
          aria-label="当前规范"
          @update:model-value="switchSpec"
        >
          <template #value="{ value }"><span class="text-surface-500">规范：</span>{{ specOptions.find((o) => o.id === value)?.name }}</template>
        </Select>
        <Button icon="pi pi-sliders-h" label="域定义" severity="secondary" size="small" title="编辑当前规范" @click="ui.specOpen = true" />
        <template v-if="ui.platformKind === 'web'">
          <Button icon="pi pi-ellipsis-h" severity="secondary" size="small" text aria-label="更多" @click="more?.toggle($event)" />
          <Menu ref="more" :model="moreItems" popup />
        </template>
      </div>
    </template>
  </Toolbar>
</template>
