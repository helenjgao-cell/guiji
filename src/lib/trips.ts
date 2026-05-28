import type { City } from './storage'

/**
 * 旅行（Trip）
 * 一次旅行 = 时间相邻（≤ 7 天间隔）的多个城市访问记录
 *
 * v0 简化：trips 完全从 cities 派生，不单独存储
 * （未来如果用户要编辑 trip 标题/封面，再加单独 storage）
 */
export interface Trip {
  /** 稳定 ID：start-end-city0 hash */
  id: string
  /** 这次旅行覆盖的城市名（按时间排序）*/
  cityNames: string[]
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  /** 自动生成的标题 */
  title: string
  /** 跨度天数 */
  dayCount: number
}

const SAME_TRIP_GAP_DAYS = 7

/**
 * 把城市列表聚类为旅行
 * 按 city.date 升序，相邻两城日期差 > 7 天就拆出一个新 trip
 */
export function clusterIntoTrips(cities: City[]): Trip[] {
  if (cities.length === 0) return []

  const sorted = [...cities].sort((a, b) => a.date.localeCompare(b.date))
  const buckets: City[][] = []
  let current: City[] = []

  for (const c of sorted) {
    if (current.length === 0) {
      current.push(c)
      continue
    }
    const last = current[current.length - 1]
    const gap = daysBetween(last.date, c.date)
    if (gap <= SAME_TRIP_GAP_DAYS) {
      current.push(c)
    } else {
      buckets.push(current)
      current = [c]
    }
  }
  if (current.length > 0) buckets.push(current)

  // 倒序：最新的旅行在前
  return buckets.map(bucketToTrip).reverse()
}

function bucketToTrip(cities: City[]): Trip {
  const startDate = cities[0].date
  const endDate = cities[cities.length - 1].date
  const cityNames = cities.map((c) => c.name)
  const id = `${startDate}_${endDate}_${cityNames[0]}`
  const title = generateTitle(cityNames, startDate, endDate)
  const dayCount = daysBetween(startDate, endDate) + 1
  return { id, cityNames, startDate, endDate, title, dayCount }
}

function generateTitle(cityNames: string[], _start: string, _end: string): string {
  const stripped = cityNames.map((n) => n.replace(/(市|特别行政区|自治州|地区|盟|县)$/g, ''))
  if (stripped.length === 1) return `${stripped[0]} 之旅`
  if (stripped.length === 2) return `${stripped[0]} & ${stripped[1]}`
  if (stripped.length === 3) return `${stripped[0]} · ${stripped[1]} · ${stripped[2]}`
  return `${stripped[0]} 等 ${stripped.length} 城之旅`
}

function daysBetween(a: string, b: string): number {
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  if (isNaN(ta) || isNaN(tb)) return 0
  return Math.round(Math.abs(tb - ta) / 86400000)
}

/** 友好显示日期区间："2024.05.10 - 05.13"（同月省年）*/
export function formatDateRange(startDate: string, endDate: string): string {
  if (startDate === endDate) {
    return startDate.replace(/-/g, '.')
  }
  const [sy, sm, sd] = startDate.split('-')
  const [ey, em, ed] = endDate.split('-')
  if (sy === ey && sm === em) {
    return `${sy}.${sm}.${sd} – ${ed}`
  }
  if (sy === ey) {
    return `${sy}.${sm}.${sd} – ${em}.${ed}`
  }
  return `${sy}.${sm}.${sd} – ${ey}.${em}.${ed}`
}
