import { useEffect, useRef, useState } from 'react'
import { loadAMap } from '../lib/amap'
import { fetchBoundary, extractPaths } from '../lib/boundary'
import { loadAllPrefectures } from '../lib/baseline'
import { getCityEmoji } from '../lib/emoji'
import type { City } from '../lib/storage'

interface Props {
  cities: City[]
  /** 刚刚新增的城市名（用于触发点亮动画 + 自动聚焦） */
  recentlyAddedName: string | null
  /** cityName → blob URL，弹卡里展示用户上传的照片 */
  photoUrls: Map<string, string>
  /** 外部触发聚焦某座城市（用于集邮册视图点击跳转） */
  focusCityName: string | null
}

const POLYGON_FILL = '#d97757'
const POLYGON_FILL_OPACITY = 0.22
const POLYGON_STROKE = '#d97757'
const POLYGON_STROKE_OPACITY = 0.75

const BASELINE_FILL = '#b8a78f'
const BASELINE_FILL_OPACITY = 0.06
const BASELINE_STROKE = '#a89a85'
const BASELINE_STROKE_OPACITY = 0.18

export default function CityMap({
  cities,
  recentlyAddedName,
  photoUrls,
  focusCityName,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const polygonsRef = useRef<Map<string, any[]>>(new Map())
  const baselinePolygonsRef = useRef<any[]>([])
  const infoWindowRef = useRef<any>(null)
  const photoUrlsRef = useRef(photoUrls)
  photoUrlsRef.current = photoUrls
  /** AMap 加载完触发 → 让渲染 effect 重新跑 */
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadAMap()
      .then(() => {
        if (cancelled || !containerRef.current) return
        mapRef.current = new window.AMap.Map(containerRef.current, {
          zoom: 4,
          center: [104.1954, 35.8617],
          mapStyle: 'amap://styles/whitesmoke',
          viewMode: '2D',
        })
        infoWindowRef.current = new window.AMap.InfoWindow({
          isCustom: false,
          autoMove: true,
          offset: new window.AMap.Pixel(0, -22),
        })
        setMapReady(true)
      })
      .catch((err) => console.error(err))

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.destroy()
        mapRef.current = null
      }
    }
  }, [])

  // 加载灰色基底层（中国全部 337 地级市）
  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    if (!map) return

    let cancelled = false
    loadAllPrefectures().then((prefectures) => {
      if (cancelled) return
      for (const pref of prefectures) {
        for (const path of pref.paths) {
          const polygon = new window.AMap.Polygon({
            path,
            fillColor: BASELINE_FILL,
            fillOpacity: BASELINE_FILL_OPACITY,
            strokeColor: BASELINE_STROKE,
            strokeOpacity: BASELINE_STROKE_OPACITY,
            strokeWeight: 0.5,
            zIndex: 50,
            bubble: true,
          })
          map.add(polygon)
          baselinePolygonsRef.current.push(polygon)
        }
      }
    })

    return () => {
      cancelled = true
    }
  }, [mapReady])

  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    if (!map || !window.AMap) return

    // 清空旧 markers
    markersRef.current.forEach((m) => map.remove(m))
    markersRef.current = []

    if (cities.length === 0) {
      // 也清掉 polygons
      polygonsRef.current.forEach((polys) => polys.forEach((p) => map.remove(p)))
      polygonsRef.current.clear()
      return
    }

    // 1. 渲染 markers（emoji 圆形徽章）
    cities.forEach((c) => {
      const isNew = c.name === recentlyAddedName
      const emoji = getCityEmoji(c.name)
      const marker = new window.AMap.Marker({
        position: [c.lng, c.lat],
        title: c.name,
        anchor: 'center',
        zIndex: 200,
        content: `<div class="city-marker ${isNew ? 'new' : ''}"><div class="badge">${emoji}</div></div>`,
      })
      marker.on('click', () => openPopup(c))
      map.add(marker)
      markersRef.current.push(marker)
    })

    // 2. 渲染 polygons：按 adcode 去重
    const wantedAdcodes = new Set(cities.map((c) => c.adcode).filter((a): a is string => !!a))
    const currentAdcodes = new Set(polygonsRef.current.keys())

    for (const adcode of currentAdcodes) {
      if (!wantedAdcodes.has(adcode)) {
        const polys = polygonsRef.current.get(adcode) || []
        polys.forEach((p) => map.remove(p))
        polygonsRef.current.delete(adcode)
      }
    }

    for (const adcode of wantedAdcodes) {
      if (currentAdcodes.has(adcode)) continue
      const newCityRendered = cities.find((c) => c.adcode === adcode && c.name === recentlyAddedName)
      const isNewlyAdded = !!newCityRendered
      renderPolygonForAdcode(map, adcode, isNewlyAdded).then((polys) => {
        polygonsRef.current.set(adcode, polys)
      })
    }

    // 3. 视野/聚焦
    if (recentlyAddedName) {
      const newCity = cities.find((c) => c.name === recentlyAddedName)
      if (newCity) {
        map.setZoomAndCenter(8, [newCity.lng, newCity.lat], false, 800)
        setTimeout(() => openPopup(newCity), 900)
      }
    } else if (cities.length === 1) {
      map.setZoomAndCenter(8, [cities[0].lng, cities[0].lat])
    } else if (markersRef.current.length > 0) {
      map.setFitView(markersRef.current, false, [80, 80, 80, 80])
    }
  }, [cities, recentlyAddedName, mapReady])

  // 外部聚焦：从集邮册点一个章 → 滚到那个城市并弹卡
  useEffect(() => {
    if (!mapReady || !focusCityName) return
    const map = mapRef.current
    if (!map) return
    const target = cities.find((c) => c.name === focusCityName)
    if (!target) return
    map.setZoomAndCenter(8, [target.lng, target.lat], false, 600)
    setTimeout(() => openPopup(target), 700)
  }, [focusCityName, mapReady, cities])

  function openPopup(c: City) {
    const map = mapRef.current
    const iw = infoWindowRef.current
    if (!map || !iw) return
    const subtitle = c.parent ? `${c.parent} · ${c.province}` : c.province
    const photoUrl = photoUrlsRef.current.get(c.name)
    const photoHtml = photoUrl
      ? `<img class="popup-photo" src="${escapeHtml(photoUrl)}" alt="${escapeHtml(c.name)}" />`
      : ''
    const emoji = getCityEmoji(c.name)
    iw.setContent(`
      <div class="city-popup ${photoUrl ? 'with-photo' : ''}">
        ${photoHtml}
        <div class="popup-body">
          <span class="emoji">${emoji}</span>
          <div class="name">${escapeHtml(c.name)}</div>
          <div class="meta">${escapeHtml(subtitle)}</div>
          <div class="date">${escapeHtml(c.date)}</div>
        </div>
      </div>
    `)
    iw.open(map, [c.lng, c.lat])
  }

  return <div id="map" ref={containerRef} />
}

async function renderPolygonForAdcode(
  map: any,
  adcode: string,
  isNew: boolean,
): Promise<any[]> {
  const geojson = await fetchBoundary(adcode)
  const paths = extractPaths(geojson)
  if (paths.length === 0) return []

  const polygons: any[] = []
  for (const path of paths) {
    const polygon = new window.AMap.Polygon({
      path,
      fillColor: POLYGON_FILL,
      fillOpacity: 0,
      strokeColor: POLYGON_STROKE,
      strokeOpacity: 0,
      strokeWeight: 1.5,
      zIndex: 100,
      bubble: true,
    })
    map.add(polygon)
    polygons.push(polygon)
  }

  animateFadeIn(polygons, isNew ? 1200 : 600)

  return polygons
}

function animateFadeIn(polygons: any[], duration: number): void {
  const start = performance.now()
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
    for (const p of polygons) {
      p.setOptions({
        fillOpacity: eased * POLYGON_FILL_OPACITY,
        strokeOpacity: eased * POLYGON_STROKE_OPACITY,
      })
    }
    if (t < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
