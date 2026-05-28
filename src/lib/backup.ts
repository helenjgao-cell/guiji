import { getCities, saveCities, type City } from './storage'
import { getPhoto, savePhoto, clearAllPhotos } from './photo-store'

/**
 * 备份格式 v1
 * 字段：cities + photos（base64 dataUrl 编码）
 */
export interface BackupData {
  version: 1
  exportedAt: string
  cities: City[]
  photos: Array<{
    cityKey: string
    dataUrl: string
    width: number
    height: number
  }>
}

export async function buildBackup(): Promise<BackupData> {
  const cities = getCities()
  const photos: BackupData['photos'] = []
  for (const c of cities) {
    try {
      const record = await getPhoto(c.name)
      if (record) {
        const dataUrl = await blobToDataUrl(record.blob)
        photos.push({
          cityKey: c.name,
          dataUrl,
          width: record.width,
          height: record.height,
        })
      }
    } catch (e) {
      console.warn('[backup] failed to read photo for', c.name, e)
    }
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    cities,
    photos,
  }
}

export async function restoreBackup(data: BackupData, opts: { merge: boolean }): Promise<{
  citiesRestored: number
  photosRestored: number
}> {
  if (data.version !== 1) {
    throw new Error(`不支持的备份版本：${data.version}`)
  }
  if (!Array.isArray(data.cities)) {
    throw new Error('备份格式错误：cities 不是数组')
  }

  let cities = data.cities
  if (opts.merge) {
    const existing = getCities()
    const map = new Map<string, City>()
    for (const c of existing) map.set(c.name, c)
    for (const c of data.cities) map.set(c.name, c) // 备份覆盖现有同名
    cities = Array.from(map.values())
  } else {
    await clearAllPhotos().catch(() => {})
  }

  saveCities(cities)

  let photosRestored = 0
  for (const p of data.photos ?? []) {
    try {
      const blob = await dataUrlToBlob(p.dataUrl)
      await savePhoto(p.cityKey, blob, p.width, p.height)
      photosRestored++
    } catch (e) {
      console.warn('[backup] failed to restore photo for', p.cityKey, e)
    }
  }

  return { citiesRestored: cities.length, photosRestored }
}

export function downloadBackup(data: BackupData, filename?: string): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `suyep-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}
