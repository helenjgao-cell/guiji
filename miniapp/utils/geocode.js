// 离线逆地理编码：找最接近的城市
// 端口自 src/lib/geocode.ts
const { CITIES } = require('./cities.js')

function reverseGeocode(lat, lng) {
  let best = null
  let bestDist = Infinity
  for (const c of CITIES) {
    const d = haversine(lat, lng, c.lat, c.lng)
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  if (!best || bestDist > 500) {
    return null
  }
  return {
    city: best.name,
    province: best.province,
    parent: best.parent,
    adcode: best.adcode,
    distanceKm: bestDist,
  }
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

module.exports = { reverseGeocode, haversine }
