import type { KeyValueStore, OpenedFile, Platform } from './types'

export function createWebPlatform(): Platform {
  return {
    kind: 'web',
    openFile,
    saveFile,
    copy: (text) => navigator.clipboard.writeText(text),
    storage: createIndexedDbStore('iso8583-json', 'kv'),
    installMenu: async () => {},
  }
}

function openFile(extensions: string[]): Promise<OpenedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = extensions.map((ext) => `.${ext}`).join(',')
    input.onchange = async () => {
      const file = input.files?.[0]
      resolve(file ? { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) } : null)
    }
    input.oncancel = () => resolve(null)
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
