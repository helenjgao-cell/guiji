// 端口自 src/lib/stats.ts
const { haversine } = require('./geocode.js')
const { clusterIntoTrips } = require('./trips.js')

const TOTAL_CN_PREFECTURES = 337

function computeStats(cities) {
  const empty = {
    cityCount: 0, cnCityCount: 0, provinceCount: 0,
    thisYearCount: 0, tripCount: 0, cnProgressPct: 0,
    latSpanKm: 0, lngSpanKm: 0,
  }
  if (!cities || cities.length === 0) return empty

  const provinceSet = new Set()
  for (const c of cities) provinceSet.add(c.province)

  const currentYear = new Date().getFullYear()
  const thisYearCount = cities.filter((c) => {
    const m = /^(\d{4})/.exec(c.date || '')
    return m ? parseInt(m[1], 10) === currentYear : false
  }).length

  const cnAdcodes = new Set()
  for (const c of cities) {
    if (c.adcode) cnAdcodes.add(c.adcode)
  }
  const cnCityCount = cnAdcodes.size

  let north = cities[0], south = cities[0], east = cities[0], west = cities[0]
  for (const c of cities) {
    if (c.lat > north.lat) north = c
    if (c.lat < south.lat) south = c
    if (c.lng > east.lng) east = c
    if (c.lng < west.lng) west = c
  }

  return {
    cityCount: cities.length,
    cnCityCount,
    provinceCount: provinceSet.size,
    thisYearCount,
    tripCount: clusterIntoTrips(cities).length,
    cnProgressPct: (cnCityCount / TOTAL_CN_PREFECTURES) * 100,
    north, south, east, west,
    latSpanKm: haversine(north.lat, north.lng, south.lat, south.lng),
    lngSpanKm: haversine(east.lat, east.lng, west.lat, west.lng),
  }
}

function formatKm(km) {
  if (km < 1) return '<1 km'
  if (km < 10) return km.toFixed(1) + ' km'
  return Math.round(km).toLocaleString('en-US') + ' km'
}

module.exports = { computeStats, formatKm, TOTAL_CN_PREFECTURES }
