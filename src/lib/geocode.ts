import { CITIES, type CityEntry } from '../data/cities'

export interface GeocodeResult {
  city: string
  province: string
  parent?: string
  adcode?: string
  source: 'offline'
  distanceKm: number
}

/**
 * 离线逆地理编码：找最接近的城市
 * 用 Haversine 公式计算地球表面距离
 *
 * 不连任何外部 API，纯客户端计算，永远秒返回。
 * 代价：城市表里没有的小城会匹配到最近的地级市。
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  console.log('[geocode] start lat=', lat, 'lng=', lng)

  let best: CityEntry | null = null
  let bestDist = Infinity
  for (const c of CITIES) {
    const d = haversine(lat, lng, c.lat, c.lng)
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }

  // 离最近城市超过 500km，说明 GPS 在我们的城市表覆盖不到的区域
  // （比如非洲、南美、远海等）。返回 null 让用户手动指定
  if (!best || bestDist > 500) {
    console.warn('[geocode] no city within 500km, nearest:', best?.name, bestDist.toFixed(1), 'km')
    return null
  }

  console.log('[geocode] →', best.name, '(', bestDist.toFixed(1), 'km away)')
  return {
    city: best.name,
    province: best.province,
    parent: best.parent,
    adcode: best.adcode,
    source: 'offline',
    distanceKm: bestDist,
  }
}

/** Haversine: 球面上两点的大圆距离，单位 km */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // 地球半径 km
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
