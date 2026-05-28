/**
 * 图片处理 pipeline：
 * 1. HEIC → JPEG（heic-to 优先 / heic2any 备用，都懒加载）
 * 2. resize 到最长边 800px
 * 3. JPEG 0.85 压缩
 * 输出：~100-300KB 的 Blob，能秒展示，存 IndexedDB 不爆
 *
 * 双层 HEIC 兜底：
 * - heic-to 用 libheif 1.18+，支持 iPhone 15/16 Pro Max 的新 HEIC (10-bit HDR)
 * - heic2any 用更老的 libheif，部分老格式更稳
 * - 都失败时抛错，调用方捕获后跳过照片但城市照点亮
 */

const MAX_LONG_EDGE = 800
const JPEG_QUALITY = 0.85

// 懒加载缓存
let heicToPromise: Promise<typeof import('heic-to').heicTo> | null = null
let heic2anyPromise: Promise<(opts: any) => Promise<Blob | Blob[]>> | null = null

function loadHeicTo() {
  if (!heicToPromise) heicToPromise = import('heic-to').then((m) => m.heicTo)
  return heicToPromise
}

function loadHeic2any() {
  if (!heic2anyPromise) heic2anyPromise = import('heic2any').then((m) => m.default)
  return heic2anyPromise
}

function isHEIC(file: File): boolean {
  const type = (file.type || '').toLowerCase()
  if (type === 'image/heic' || type === 'image/heif') return true
  const name = file.name.toLowerCase()
  return name.endsWith('.heic') || name.endsWith('.heif')
}

async function convertHEIC(file: File): Promise<Blob> {
  // 策略 1：heic-to (libheif 1.18+，支持新 iPhone)
  try {
    const heicTo = await loadHeicTo()
    const blob = await heicTo({
      blob: file,
      type: 'image/jpeg',
      quality: 0.92,
    })
    console.log('[heic] heic-to converted', file.name, '→', blob.size, 'bytes')
    return blob
  } catch (e1) {
    console.warn('[heic] heic-to failed, trying heic2any:', e1)
  }

  // 策略 2：heic2any (老 libheif，部分老格式可能更稳)
  try {
    const heic2any = await loadHeic2any()
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    })
    const blob = Array.isArray(result) ? result[0] : result
    console.log('[heic] heic2any converted', file.name, '→', blob.size, 'bytes')
    return blob
  } catch (e2) {
    console.warn('[heic] heic2any also failed:', e2)
  }

  throw new Error('两个 HEIC 解码器都失败了，可能是新格式或损坏文件')
}

export interface ProcessedImage {
  blob: Blob
  width: number
  height: number
}

export async function processImage(file: File): Promise<ProcessedImage> {
  let inputBlob: Blob = file

  // 1. HEIC → JPEG
  if (isHEIC(file)) {
    inputBlob = await convertHEIC(file)
  }

  // 2. 加载到 Image
  const url = URL.createObjectURL(inputBlob)
  try {
    const img = await loadImage(url)

    // 3. 算 resize 比例，最长边压到 800
    const longEdge = Math.max(img.width, img.height)
    const scale = longEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / longEdge : 1
    const targetW = Math.round(img.width * scale)
    const targetH = Math.round(img.height * scale)

    // 4. canvas 渲染 + JPEG 导出
    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas getContext failed')
    ctx.drawImage(img, 0, 0, targetW, targetH)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    })
    if (!blob) throw new Error('canvas.toBlob returned null')

    return { blob, width: targetW, height: targetH }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = url
  })
}
