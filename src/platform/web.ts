import type { FileDropHandlers, KeyValueStore, OpenedFile, Platform } from './types'

/** 与桌面端一致的拖入文件大小上限 */
const MAX_DROP_BYTES = 1024 * 1024

export function createWebPlatform(): Platform {
  return {
    kind: 'web',
    openFile,
    saveFile,
    copy: (text) => navigator.clipboard.writeText(text),
    storage: createIndexedDbStore('iso8583-json', 'kv'),
    onFileDrop,
    installMenu: async () => {},
  }
}

function onFileDrop(h: FileDropHandlers) {
  // dragenter / dragleave 会在子元素间反复触发，用计数判断是否真正离开窗口
  let depth = 0
  const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false
  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return
    depth++
    h.onDragging(true)
  })
  window.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return
    depth = Math.max(0, depth - 1)
    if (depth === 0) h.onDragging(false)
  })
  window.addEventListener('dragover', (e) => {
    if (hasFiles(e)) e.preventDefault()
  })
  window.addEventListener('drop', async (e) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    depth = 0
    h.onDragging(false)
    const file = e.dataTransfer?.files[0]
    if (!file) return
    if (file.size > MAX_DROP_BYTES) return h.onError(`文件 ${file.name} 超过 1 MB，不像是单条报文`)
    h.onFile({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })
  })
}

function openFile(extensions: string[]): Promise<OpenedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = extensions.map((ext) => `.${ext}`).join(',')
    // 挂到文档上再打开：游离的 input 可能被回收，浏览器偶尔不弹出选择框或收不到 change
    input.hidden = true
    document.body.append(input)
    const done = (file: OpenedFile | null) => {
      input.remove()
      resolve(file)
    }
    input.onchange = async () => {
      const file = input.files?.[0]
      done(file ? { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) } : null)
    }
    input.oncancel = () => done(null)
    input.click()
  })
}

async function saveFile(suggestedName: string, data: Uint8Array | string): Promise<boolean> {
  const blob = new Blob([data as BlobPart])
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = suggestedName
  link.click()
  URL.revokeObjectURL(url)
  return true
}

function createIndexedDbStore(dbName: string, storeName: string): KeyValueStore {
  let db: Promise<IDBDatabase> | undefined
  const open = () =>
    (db ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(storeName)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    }))
  const run = async <T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T> => {
    const store = (await open()).transaction(storeName, mode).objectStore(storeName)
    return new Promise((resolve, reject) => {
      const req = op(store)
      req.onsuccess = () => resolve(req.result as T)
      req.onerror = () => reject(req.error)
    })
  }
  return {
    get: (key) => run('readonly', (s) => s.get(key)),
    set: (key, value) => run('readwrite', (s) => s.put(value, key)),
    delete: (key) => run('readwrite', (s) => s.delete(key)),
  }
}
