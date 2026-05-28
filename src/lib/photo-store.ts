/**
 * IndexedDB 照片存储
 * 一个城市存一张代表照片（最后一次上传的覆盖之前的）
 * localStorage 限 5MB，存压缩后的 JPEG 也只能存几张；IndexedDB 50MB+ 够用
 */

const DB_NAME = 'suyep'
const DB_VERSION = 1
const STORE = 'photos'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'cityKey' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

export interface PhotoRecord {
  cityKey: string
  blob: Blob
  width: number
  height: number
  storedAt: number
}

export async function savePhoto(
  cityKey: string,
  blob: Blob,
  width: number,
  height: number,
): Promise<void> {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const record: PhotoRecord = { cityKey, blob, width, height, storedAt: Date.now() }
    const req = store.put(record)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function getPhoto(cityKey: string): Promise<PhotoRecord | null> {
  const db = await openDB()
  return new Promise<PhotoRecord | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.get(cityKey)
    req.onsuccess = () => resolve((req.result as PhotoRecord | undefined) ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function deletePhoto(cityKey: string): Promise<void> {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.delete(cityKey)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function clearAllPhotos(): Promise<void> {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
