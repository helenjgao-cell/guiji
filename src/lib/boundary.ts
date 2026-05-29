/**
 * 行政区边界获取
 * 数据源：阿里 DataV.GeoAtlas
 * CDN：geo.datav.aliyun.com（国内 CDN 快、CORS 通畅、免费）
 */

interface Feature {
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: any
  } | null
}

interface FeatureCollection {
  features?: Feature[]
}

const cache = new Map<string, FeatureCollection | null>()
const inflight = new Map<string, Promise<FeatureCollection | null>>()

export async function fetchBoundary(adcode: string): Promise<FeatureCollection | null> {
  if (cache.has(adcode)) return cache.get(adcode) ?? null
  if (inflight.has(adcode)) return inflight.get(adcode)!

  const promise = (async () => {
    try {
      const url = `https://geo.datav.aliyun.com/areas_v3/bound/${adcode}.json`
      const res = await fetch(url)
      if (!res.ok) {
        cache.set(adcode, null)
        return null
      }
      const data = (await res.json()) as FeatureCollection
      cache.set(adcode, data)
      return data
    } catch {
      cache.set(adcode, null)
      return null
    } finally {
      inflight.delete(adcode)
    }
  })()

  inflight.set(adcode, promise)
  return promise
}

/** 从 GeoJSON 提取所有 Polygon 外环路径，返回 [[[lng, lat], ...], ...] */
export function extractPaths(geojson: FeatureCollection | null): number[][][] {
  if (!geojson?.features) return []
  const paths: number[][][] = []
  for (const feature of geojson.features) {
    const geom = feature.geometry
    if (!geom) continue
    if (geom.type === 'Polygon') {
      paths.push(geom.coordinates[0])
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        paths.push(poly[0])
      }
    }
  }
  return paths
}
