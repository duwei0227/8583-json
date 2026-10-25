<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'
import { ref, watch } from 'vue'
import { getPlatform } from '../../platform'
import { useMessageStore } from '../../stores/message'
import { useSpecStore } from '../../stores/spec'
import { useUiStore } from '../../stores/ui'

const spec = useSpecStore()
const message = useMessageStore()
const ui = useUiStore()

const text = ref('')
const problems = ref<string[]>([])

watch(
  () => ui.importOpen,
  (open) => {
    if (open) {
      text.value = ''
      problems.value = []
    }
  },
)

async function pickFile() {
  const file = await (await getPlatform()).openFile(['json'])
  if (file) text.value = new TextDecoder().decode(file.bytes)
}

async function submit() {
  problems.value = await spec.importJson(text.value)
  if (problems.value.length) return
  ui.importOpen = false
  message.setStatus('ok', `已导入并切换到规范「${spec.current?.name}」`)
}
</script>

<template>
  <Dialog v-model:visible="ui.importOpen" header="导入规范" modal class="w-[40rem] max-w-[calc(100vw-2rem)]">
    <div class="flex flex-col gap-3">
      <p class="m-0 text-[14px] text-surface-600">粘贴规范 JSON，或选择导出的 .json 文件。导入前会先校验，通过后作为新规范加入列表并切换过去。</p>
      <Textarea v-model="text" rows="12" spellcheck="false" aria-label="规范 JSON" placeholder='{ "schema": 1, "name": "…", "frame": { … }, "fields": { … } }' class="font-mono text-xs" />
      <Message v-if="problems.length" severity="error">
        <ul class="m-0 pl-4 text-[14px]">
          <li v-for="p in problems" :key="p">{{ p }}</li>
        </ul>
      </Message>
    </div>
    <template #footer>
      <Button label="选择文件…" icon="pi pi-folder-open" severity="secondary" outlined size="small" @click="pickFile" />
      <Button label="导入" icon="pi pi-check" size="small" :disabled="!text.trim()" @click="submit" />
    </template>
  </Dialog>
</template>
