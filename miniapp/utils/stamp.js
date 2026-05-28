// 印章 SVG 生成器（端口自 src/lib/stamp.ts）
// 小程序里 SVG 可在 <cover-view> 或 image 的 base64 url 中使用
const SUFFIXES_TO_STRIP = [
  '蒙古族藏族自治州', '土家族苗族自治州', '布依族苗族自治州', '苗族侗族自治州',
  '哈尼族彝族自治州', '藏族羌族自治州', '壮族苗族自治州', '傣族景颇族自治州',
  '柯尔克孜自治州', '哈萨克自治州', '景颇族自治州', '傈僳族自治州',
  '蒙古自治州', '回族自治州', '白族自治州', '藏族自治州', '傣族自治州',
  '彝族自治州', '苗族自治州', '侗族自治州', '羌族自治州',
  '回族自治区', '壮族自治区', '维吾尔自治区',
  '特别行政区', '自治州', '自治区', '自治县',
  '地区', '盟', '县', '市',
]

function stripCitySuffix(name) {
  for (const suf of SUFFIXES_TO_STRIP) {
    if (name.endsWith(suf) && name.length > suf.length) {
      return name.slice(0, -suf.length)
    }
  }
  return name
}

function generateStampSVG(cityName, size) {
  size = size || 64
  const display = stripCitySuffix(cityName) || cityName
  const isAscii = /^[\x00-\x7F]+$/.test(display)
  const eff = isAscii ? display.length * 0.55 : display.length
  let fs
  if (eff <= 1) fs = size * 0.55
  else if (eff <= 2) fs = size * 0.42
  else if (eff <= 3) fs = size * 0.32
  else if (eff <= 4) fs = size * 0.26
  else if (eff <= 5) fs = size * 0.22
  else fs = size * 0.18

  const cx = size / 2
  const cy = size / 2
  const outerR = size / 2 - 1
  const innerR = outerR - 3.5
  const safeName = display.replace(/[<>&"']/g, '')

  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${cx}" cy="${cy}" r="${outerR}" fill="#c0322a"/><circle cx="${cx}" cy="${cy}" r="${innerR}" fill="none" stroke="#fff" stroke-width="0.9" stroke-opacity="0.8"/><text x="${cx}" y="${cy + fs * 0.36}" font-family="STKaiti,KaiTi,FangSong,serif" font-weight="600" font-size="${fs}" fill="#fff" text-anchor="middle">${safeName}</text></svg>`
}

/** 印章 SVG → data URL（小程序 image 组件可用 src）*/
function stampDataUrl(cityName, size) {
  const svg = generateStampSVG(cityName, size)
  // 小程序里要 encodeURIComponent，不能直接 base64 因为可能包含中文
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

module.exports = { generateStampSVG, stampDataUrl, stripCitySuffix }
