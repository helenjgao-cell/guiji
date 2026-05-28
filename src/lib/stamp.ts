/**
 * 城市印章 SVG 生成器
 * 风格：朱砂红圆形章 + 楷体白字 + 双圈描边（仿景区盖章质感）
 *
 * 用法：
 *   const svg = generateStampSVG('宜兴市', 64)
 *   // 在 React: <div dangerouslySetInnerHTML={{ __html: svg }} />
 *   // 在 AMap.Marker 的 content: 直接传 svg 字符串
 */

const STAMP_RED = '#c0322a'
const STAMP_RED_DARK = '#9a2820'

// 后缀按"长 → 短"排序，避免短后缀先匹配（"自治州"会先吃掉"白族自治州"）
const SUFFIXES_TO_STRIP = [
  '蒙古族藏族自治州',
  '土家族苗族自治州',
  '布依族苗族自治州',
  '苗族侗族自治州',
  '哈尼族彝族自治州',
  '藏族羌族自治州',
  '壮族苗族自治州',
  '傣族景颇族自治州',
  '柯尔克孜自治州',
  '哈萨克自治州',
  '景颇族自治州',
  '傈僳族自治州',
  '蒙古自治州',
  '回族自治州',
  '白族自治州',
  '藏族自治州',
  '傣族自治州',
  '彝族自治州',
  '苗族自治州',
  '侗族自治州',
  '羌族自治州',
  '回族自治区',
  '壮族自治区',
  '维吾尔自治区',
  '特别行政区',
  '自治州',
  '自治区',
  '自治县',
  '地区',
  '盟',
  '县',
  '市',
]

export function stripCitySuffix(name: string): string {
  for (const suf of SUFFIXES_TO_STRIP) {
    if (name.endsWith(suf) && name.length > suf.length) {
      return name.slice(0, -suf.length)
    }
  }
  return name
}

function fontSizeForName(displayName: string, stampSize: number): number {
  // 中文字符 ~1 个等效宽度，英文字符 ~0.55
  const isAscii = /^[\x00-\x7F]+$/.test(displayName)
  const eff = isAscii ? displayName.length * 0.55 : displayName.length

  if (eff <= 1) return stampSize * 0.55
  if (eff <= 2) return stampSize * 0.42
  if (eff <= 3) return stampSize * 0.32
  if (eff <= 4) return stampSize * 0.26
  if (eff <= 5) return stampSize * 0.22
  return stampSize * 0.18
}

export function generateStampSVG(cityName: string, size: number = 64): string {
  const display = stripCitySuffix(cityName) || cityName
  const fs = fontSizeForName(display, size)
  const cx = size / 2
  const cy = size / 2
  const outerR = size / 2 - 1
  const innerR = outerR - 3.5

  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <radialGradient id="stamp-grad-${cityName}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${STAMP_RED}" />
      <stop offset="100%" stop-color="${STAMP_RED_DARK}" />
    </radialGradient>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="url(#stamp-grad-${escapeXml(cityName)})" />
  <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="none" stroke="#ffffff" stroke-width="0.9" stroke-opacity="0.8" />
  <text x="${cx}" y="${cy + fs * 0.36}"
        font-family="'STKaiti', 'KaiTi', 'STZhongsong', 'FangSong', '楷体', serif"
        font-weight="600"
        font-size="${fs}"
        fill="#ffffff"
        text-anchor="middle"
        letter-spacing="-0.5">${escapeXml(display)}</text>
</svg>`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
