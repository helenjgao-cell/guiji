/**
 * 行政区边界获取
 * 数据源：阿里 DataV.GeoAtlas (https://datav.aliyun.com/portal/school/atlas/area_selector)
 * CDN：geo.datav.aliyun.com，国内访问快、CORS 通畅、免费
 *
 * URL 格式：
 *   https://geo.datav.aliyun.com/areas_v3/bound/{adcode}.json        // 仅自身边界
 *   https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json   // 含下级行政区
 */

const cache = new Map<string, GeoJSON.FeatureCollection | null>()
const inflight = new Map<string, Promise<GeoJSON.FeatureCollection | null>>()

export async function fetchBoundary(adcode: string): Promise<GeoJSON.FeatureCollection | null> {
  if (cache.has(adcode)) return cache.get(adcode) ?? null
  if (inflight.has(adcode)) return inflight.get(adcode)!

  const promise = (async () => {
    try {
      const url = `https://geo.datav.aliyun.com/areas_v3/bound/${adcode}.json`
      const res = await fetch(url)
      if (!res.ok) {
        console.warn('[boundary] HTTP', res.status, 'for adcode', adcode)
        cache.set(adcode, null)
        return null
      }
      const data = (await res.json()) as GeoJSON.FeatureCollection
      console.log('[boundary] loaded', adcode, '(', data.features?.length ?? 0, 'features)')
      cache.set(adcode, data)
      return data
    } catch (e) {
      console.warn('[boundary] failed for', adcode, e)
      cache.set(adcode, null)
      return null
    } finally {
      inflight.delete(adcode)
    }
  })()

  inflight.set(adcode, promise)
  return promise
}

/**
 * 从 GeoJSON FeatureCollection 提取所有 Polygon 路径
 * 一个城市可能由多个 Polygon 组成（如沿海有岛屿），都需要画
 * 返回 [[[lng, lat], ...], ...] 多组路径
 */
export function extractPaths(geojson: GeoJSON.FeatureCollection | null): number[][][] {
  if (!geojson?.features) return []
  const paths: number[][][] = []
  for (const feature of geojson.features) {
    const geom = feature.geometry
    if (!geom) continue
    if (geom.type === 'Polygon') {
      // Polygon: coordinates = [outer ring, hole1, hole2, ...]
      // 只用外环
      paths.push(geom.coordinates[0])
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        paths.push(poly[0])
      }
    }
  }
  return paths
}
