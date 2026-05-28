// 端口自 src/lib/trips.ts
const SAME_TRIP_GAP_DAYS = 7

function clusterIntoTrips(cities) {
  if (!cities || cities.length === 0) return []
  const sorted = [...cities].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const buckets = []
  let current = []

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

  return buckets.map(bucketToTrip).reverse()
}

function bucketToTrip(cities) {
  const startDate = cities[0].date
  const endDate = cities[cities.length - 1].date
  const cityNames = cities.map((c) => c.name)
  const id = `${startDate}_${endDate}_${cityNames[0]}`
  return {
    id,
    cityNames,
    startDate,
    endDate,
    title: generateTitle(cityNames),
    dayCount: daysBetween(startDate, endDate) + 1,
  }
}

function generateTitle(cityNames) {
  const stripped = cityNames.map((n) =>
    n.replace(/(市|特别行政区|自治州|地区|盟|县)$/g, ''),
  )
  if (stripped.length === 1) return `${stripped[0]} 之旅`
  if (stripped.length === 2) return `${stripped[0]} & ${stripped[1]}`
  if (stripped.length === 3) return `${stripped[0]} · ${stripped[1]} · ${stripped[2]}`
  return `${stripped[0]} 等 ${stripped.length} 城之旅`
}

function daysBetween(a, b) {
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  if (isNaN(ta) || isNaN(tb)) return 0
  return Math.round(Math.abs(tb - ta) / 86400000)
}

function formatDateRange(startDate, endDate) {
  if (startDate === endDate) return startDate.replace(/-/g, '.')
  const [sy, sm, sd] = startDate.split('-')
  const [ey, em, ed] = endDate.split('-')
  if (sy === ey && sm === em) return `${sy}.${sm}.${sd} – ${ed}`
  if (sy === ey) return `${sy}.${sm}.${sd} – ${em}.${ed}`
  return `${sy}.${sm}.${sd} – ${ey}.${em}.${ed}`
}

module.exports = { clusterIntoTrips, formatDateRange }
