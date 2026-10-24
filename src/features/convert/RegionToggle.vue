<script setup lang="ts">
// 分区标题栏：点击展开或折叠下方整块内容，折叠后只保留这一行
defineProps<{ title: string; controls: string }>()
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <button
    type="button"
    class="flex w-full cursor-pointer items-center gap-1.5 rounded border-0 bg-transparent px-1 py-0.5 text-left text-xs font-semibold text-surface-600 hover:text-surface-900"
    :aria-expanded="open"
    :aria-controls="controls"
    :title="open ? `折叠${title}` : `展开${title}`"
    @click="open = !open"
  >
    <i class="pi text-[0.7rem]" :class="open ? 'pi-chevron-down' : 'pi-chevron-right'" aria-hidden="true" />
    <span>{{ title }}</span>
    <span v-if="!open" class="font-normal text-surface-400">已折叠，点击展开</span>
    <span class="ml-2 h-px flex-1 bg-surface-200" aria-hidden="true" />
  </button>
</template>
