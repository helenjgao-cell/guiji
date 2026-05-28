/**
 * 中国全境地级市边界（灰色基底层）
 * 拉 31 个省的 _full.json，提取所有地级市/自治州/盟/地区的多边形
 * 一次加载到内存，session 内复用
 */

const PROVINCE_ADCODES = [
  '110000', // 北京
  '120000', // 天津
  '130000', // 河北
  '140000', // 山西
  '150000', // 内蒙古
  '210000', // 辽宁
  '220000', // 吉林
  '230000', // 黑龙江
  '310000', // 上海
  '320000', // 江苏
  '330000', // 浙江
  '340000', // 安徽
  '350000', // 福建
  '360000', // 江西
  '370000', // 山东
  '410000', // 河南
  '420000', // 湖北
  '430000', // 湖南
  '440000', // 广东
  '450000', // 广西
  '460000', // 海南
  '500000', // 重庆
  '510000', // 四川
  '520000', // 贵州
  '530000', // 云南
  '540000', // 西藏
  '610000', // 陕西
  '620000', // 甘肃
  '630000', // 青海
  '640000', // 宁夏
  '650000', // 新疆
]

export interface PrefectureBoundary {
  adcode: string
  name: string
  /** 一个地级市可能由多块多边形组成（如沿海岛屿）*/
  paths: number[][][]
}

let cache: PrefectureBoundary[] | null = null
let inflight: Promise<PrefectureBoundary[]> | null = null

export async function loadAllPrefectures(): Promise<PrefectureBoundary[]> {
  if (cache) return cache
  if (inflight) return inflight

  inflight = (async () => {
    console.log('[baseline] fetching all 31 provinces in parallel...')
    const t0 = performance.now()
    const arrays = await Promise.all(
      PROVINCE_ADCODES.map(async (code) => {
        try {
          const url = `https://geo.datav.aliyun.com/areas_v3/bound/${code}_full.json`
          const res = await fetch(url)
          if (!res.ok) return [] as PrefectureBoundary[]
          const data = await res.json()
          return extractPrefectures(data)
        } catch (e) {
          console.warn('[baseline] failed for', code, e)
          return [] as PrefectureBoundary[]
        }
      }),
    )
    const all = arrays.flat()
    cache = all
    inflight = null
    const dt = (performance.now() - t0).toFixed(0)
    console.log(`[baseline] loaded ${all.length} prefectures in ${dt}ms`)
    return all
  })()

  return inflight
}

function extractPrefectures(data: any): PrefectureBoundary[] {
  if (!data?.features) return []
  const out: PrefectureBoundary[] = []
  for (const feature of data.features) {
    const props = feature?.properties ?? {}
    const adcode = String(props.adcode ?? '')
    const name = String(props.name ?? '')

    // 只要地级（XXXX00 + 不是 XXX0000 即省级）
    // 跳过省级 (XXXX0000) 和县区级 (XXXX01-99)
    if (!adcode.endsWith('00')) continue
    if (adcode.endsWith('0000')) continue

    const paths = extractPaths(feature.geometry)
    if (paths.length > 0) out.push({ adcode, name, paths })
  }
  return out
}

function extractPaths(geom: any): number[][][] {
  if (!geom) return []
  const out: number[][][] = []
  if (geom.type === 'Polygon') {
    out.push(geom.coordinates[0])
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) {
      out.push(poly[0])
    }
  }
  return out
}
