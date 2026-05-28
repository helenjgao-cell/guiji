import ExifReader from 'exifreader'
import exifr from 'exifr'

export interface GPSInfo {
  lat: number
  lng: number
  date: string // YYYY-MM-DD
}

export async function extractGPS(file: File): Promise<GPSInfo | null> {
  console.log('[exif] processing', file.name, '|', file.type || 'unknown', '|', formatBytes(file.size))

  // 策略 1：ExifReader —— HEIC / AVIF / 大部分格式兼容性最好
  const fromExifReader = await tryExifReader(file)
  if (fromExifReader) return fromExifReader

  // 策略 2：exifr —— 作为备选，对部分 JPEG 处理更稳
  const fromExifr = await tryExifr(file)
  if (fromExifr) return fromExifr

  console.log('[exif] both libraries failed for', file.name)
  return null
}

async function tryExifReader(file: File): Promise<GPSInfo | null> {
  try {
    const tags = await ExifReader.load(file, { expanded: true, async: true })
    console.log('[exif][exifreader] tags:', tags)

    const gps = (tags as any).gps
    if (!gps || gps.Latitude == null || gps.Longitude == null) {
      console.log('[exif][exifreader] no GPS in tags')
      return null
    }

    const exif = (tags as any).exif
    const dateStr =
      exif?.DateTimeOriginal?.description ||
      exif?.CreateDate?.description ||
      exif?.DateTime?.description ||
      null

    return {
      lat: gps.Latitude,
      lng: gps.Longitude,
      date: parseDate(dateStr, file.lastModified),
    }
  } catch (e: unknown) {
    console.warn('[exif][exifreader] failed:', errorMessage(e))
    return null
  }
}

async function tryExifr(file: File): Promise<GPSInfo | null> {
  try {
    const gps = await exifr.gps(file).catch(() => null)
    console.log('[exif][exifr] gps result:', gps)
    if (!gps || gps.latitude == null || gps.longitude == null) return null

    const meta = await exifr
      .parse(file, ['DateTimeOriginal', 'CreateDate'])
      .catch(() => null)

    const dateRaw = meta?.DateTimeOriginal || meta?.CreateDate || file.lastModified
    const dt = new Date(dateRaw)
    const date = isNaN(dt.getTime())
      ? new Date(file.lastModified).toISOString().slice(0, 10)
      : dt.toISOString().slice(0, 10)

    return { lat: gps.latitude, lng: gps.longitude, date }
  } catch (e: unknown) {
    console.warn('[exif][exifr] failed:', errorMessage(e))
    return null
  }
}

function parseDate(raw: string | null, fallback: number): string {
  if (raw && typeof raw === 'string') {
    // EXIF 日期常见格式："2024:05:25 14:30:00"，把日期部分的冒号换成短横线
    const normalized = raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
    const dt = new Date(normalized)
    if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10)
  }
  return new Date(fallback).toISOString().slice(0, 10)
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`
  return `${(n / 1024 / 1024).toFixed(1)}MB`
}
