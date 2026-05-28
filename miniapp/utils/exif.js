/**
 * 小程序纯 JS EXIF GPS 解析器
 * 仅处理 JPEG（不支持 HEIC——iPhone 用户请把相机格式改成"兼容性最佳"）
 *
 * 入参：tempFilePath（wx.chooseMedia 返回的）
 * 出参：{ lat, lng, date }  或 null
 */

function readEXIF(tempFilePath) {
  return new Promise((resolve) => {
    const fs = wx.getFileSystemManager()
    fs.readFile({
      filePath: tempFilePath,
      success: (res) => {
        try {
          const result = parseJPEGExif(res.data)
          resolve(result)
        } catch (e) {
          console.warn('[exif] parse error', e)
          resolve(null)
        }
      },
      fail: (err) => {
        console.warn('[exif] read error', err)
        resolve(null)
      },
    })
  })
}

function parseJPEGExif(buffer) {
  const view = new DataView(buffer)
  if (view.getUint16(0) !== 0xffd8) return null // not JPEG

  let offset = 2
  while (offset < view.byteLength) {
    const marker = view.getUint16(offset)
    if (marker === 0xffe1) {
      // APP1 segment
      const length = view.getUint16(offset + 2)
      // 检查是否 "Exif\0\0"
      if (view.getUint32(offset + 4) === 0x45786966 && view.getUint16(offset + 8) === 0x0000) {
        return parseTIFFForGPS(view, offset + 10)
      }
      offset += 2 + length
    } else if ((marker & 0xff00) !== 0xff00) {
      break
    } else {
      const length = view.getUint16(offset + 2)
      offset += 2 + length
    }
  }
  return null
}

function parseTIFFForGPS(view, tiffStart) {
  // 字节序：0x4949 = little-endian, 0x4d4d = big-endian
  const byteOrder = view.getUint16(tiffStart)
  const little = byteOrder === 0x4949
  const u16 = (off) => view.getUint16(off, little)
  const u32 = (off) => view.getUint32(off, little)

  if (u16(tiffStart + 2) !== 0x002a) return null

  // IFD0 偏移
  const ifd0 = tiffStart + u32(tiffStart + 4)
  const ifd0Count = u16(ifd0)

  let gpsIfdOffset = 0
  let dateTimeOriginal = ''

  // 扫描 IFD0 找 GPS pointer (tag 0x8825) 和 EXIF pointer (tag 0x8769)
  let exifIfdOffset = 0
  for (let i = 0; i < ifd0Count; i++) {
    const entry = ifd0 + 2 + i * 12
    const tag = u16(entry)
    if (tag === 0x8825) gpsIfdOffset = tiffStart + u32(entry + 8)
    if (tag === 0x8769) exifIfdOffset = tiffStart + u32(entry + 8)
  }

  // 在 EXIF IFD 找 DateTimeOriginal (tag 0x9003)
  if (exifIfdOffset) {
    const cnt = u16(exifIfdOffset)
    for (let i = 0; i < cnt; i++) {
      const entry = exifIfdOffset + 2 + i * 12
      const tag = u16(entry)
      if (tag === 0x9003) {
        const len = u32(entry + 4)
        const valOff = tiffStart + u32(entry + 8)
        dateTimeOriginal = readAscii(view, valOff, len)
        break
      }
    }
  }

  if (!gpsIfdOffset) return null

  // 解析 GPS IFD
  const gpsCount = u16(gpsIfdOffset)
  let latRef = '',
    lat = null,
    lngRef = '',
    lng = null
  for (let i = 0; i < gpsCount; i++) {
    const entry = gpsIfdOffset + 2 + i * 12
    const tag = u16(entry)
    const type = u16(entry + 2)
    const count = u32(entry + 4)
    if (tag === 0x0001) {
      // GPSLatitudeRef (1=byte ASCII)
      latRef = readAscii(view, entry + 8, 2).trim()
    } else if (tag === 0x0002) {
      // GPSLatitude — 3 RATIONAL (8 bytes each)
      const off = tiffStart + u32(entry + 8)
      lat = readRationalDMS(view, off, little)
    } else if (tag === 0x0003) {
      lngRef = readAscii(view, entry + 8, 2).trim()
    } else if (tag === 0x0004) {
      const off = tiffStart + u32(entry + 8)
      lng = readRationalDMS(view, off, little)
    }
    void type
    void count
  }

  if (lat === null || lng === null) return null
  if (latRef === 'S') lat = -lat
  if (lngRef === 'W') lng = -lng

  return {
    lat,
    lng,
    date: parseExifDate(dateTimeOriginal) || new Date().toISOString().slice(0, 10),
  }
}

function readRationalDMS(view, offset, little) {
  // 3 个 unsigned rational：度/分/秒 (numerator/denominator)
  const u32 = (off) => view.getUint32(off, little)
  const d = u32(offset) / u32(offset + 4)
  const m = u32(offset + 8) / u32(offset + 12)
  const s = u32(offset + 16) / u32(offset + 20)
  return d + m / 60 + s / 3600
}

function readAscii(view, offset, length) {
  let s = ''
  for (let i = 0; i < length; i++) {
    const b = view.getUint8(offset + i)
    if (b === 0) break
    s += String.fromCharCode(b)
  }
  return s
}

/** EXIF 日期格式 "2024:05:25 14:30:00" → "2024-05-25" */
function parseExifDate(raw) {
  if (!raw) return ''
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})/)
  if (!m) return ''
  return `${m[1]}-${m[2]}-${m[3]}`
}

module.exports = { readEXIF }
