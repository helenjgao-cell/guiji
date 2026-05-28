import type { City } from './storage'
import { clusterIntoTrips } from './trips'

/** 中国地级行政区总数（含港澳台 = 337 + 港澳 + 台湾，这里用 337 国内基准）*/
export const TOTAL_CN_PREFECTURES = 337

export interface Stats {
  cityCount: number
  cnCityCount: number // 有 adcode 的城市数（国内地级市 / 县级市）
  provinceCount: number
  thisYearCount: number
  tripCount: number
  /** 国内地级市覆盖率：0-100 */
  cnProgressPct: number

  // 极值城市（>= 2 城时才有意义）
  north?: City
  south?: City
  east?: City
  west?: City

  // 跨度（km）
  latSpanKm: number
  lngSpanKm: number
}

const EMPTY: Stats = {
  cityCount: 0,
  cnCityCount: 0,
  provinceCount: 0,
  thisYearCount: 0,
  tripCount: 0,
  cnProgressPct: 0,
  latSpanKm: 0,
  lngSpanKm: 0,
}

export function computeStats(cities: City[]): Stats {
  if (cities.length === 0) return EMPTY

  // 唯一省份/地区集合
  const provinceSet = new Set<string>()
  for (const c of cities) provinceSet.add(c.province)

  // 今年新增（基于照片日期，不是 addedAt）
  const currentYear = new Date().getFullYear()
  const thisYearCount = cities.filter((c) => {
    const m = /^(\d{4})/.exec(c.date)
    return m ? parseInt(m[1], 10) === currentYear : false
  }).length

  // 国内地级市去重（按 adcode 唯一计数；县级市的 adcode 是其上级地级市，所以宜兴+无锡=1）
  const cnAdcodes = new Set<string>()
  for (const c of cities) {
    if (c.adcode) cnAdcodes.add(c.adcode)
  }
  const cnCityCount = cnAdcodes.size
  const cnProgressPct = (cnCityCount / TOTAL_CN_PREFECTURES) * 100

  // 极值
  let north = cities[0]
  let south = cities[0]
  let east = cities[0]
  let west = cities[0]
  for (const c of cities) {
    if (c.lat > north.lat) north = c
    if (c.lat < south.lat) south = c
    if (c.lng > east.lng) east = c
    if (c.lng < west.lng) west = c
  }

  const latSpanKm = haversine(north.lat, north.lng, south.lat, south.lng)
  const lngSpanKm = haversine(east.lat, east.lng, west.lat, west.lng)

  const tripCount = clusterIntoTrips(cities).length

  return {
    cityCount: cities.length,
    cnCityCount,
    provinceCount: provinceSet.size,
    thisYearCount,
    tripCount,
    cnProgressPct,
    north,
    south,
    east,
    west,
    latSpanKm,
    lngSpanKm,
  }
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function formatKm(km: number): string {
  if (km < 1) return '<1 km'
  if (km < 10) return km.toFixed(1) + ' km'
  return Math.round(km).toLocaleString('en-US') + ' km'
}
