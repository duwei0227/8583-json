import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getPlatform } from '../platform'

export interface HistoryItem {
  id: string
  time: number
  direction: 'parse' | 'pack'
  mti: string
  bytes: number
  hex: string
}

const STORAGE_KEY = 'history'
const LIMIT = 50

export const useHistoryStore = defineStore('history', () => {
  const items = ref<HistoryItem[]>([])

  async function persist() {
    // 响应式代理无法被 IndexedDB 结构化克隆，先转成普通对象
    const plain = items.value.map((item) => ({ ...item }))
    await (await getPlatform()).storage.set(STORAGE_KEY, plain)
  }

  async function load() {
    items.value = (await (await getPlatform()).storage.get<HistoryItem[]>(STORAGE_KEY)) ?? []
  }

  async function push(item: Omit<HistoryItem, 'id' | 'time'>) {
    const time = Date.now()
    items.value = [{ ...item, id: `${time}-${items.value.length}`, time }, ...items.value].slice(0, LIMIT)
    await persist()
  }

  async function remove(id: string) {
    items.value = items.value.filter((i) => i.id !== id)
    await persist()
  }

  async function clear() {
    items.value = []
    await persist()
  }

  return { items, load, push, remove, clear }
})
