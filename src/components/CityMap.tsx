import { useEffect, useRef, useState } from 'react'
import { loadAMap } from '../lib/amap'
import { fetchBoundary, extractPaths } from '../lib/boundary'
import { getCityEmoji } from '../lib/emoji'
import type { City } from '../lib/storage'

interface Props {
  cities: City[]
  /** 刚刚新增的城市名（用于触发点亮动画 + 自动聚焦） */
  recentlyAddedName: string | null
  /** 外部触发聚焦某座城市（用于列表点击跳转） */
  focusCityName: string | null
  /** 是否展示轨迹动画（按时间小人走一遍） */
  showJourney: boolean
}

const TRAIL_COLOR = '#FF6900'
const SEGMENT_MS = 1200

const POLY_FILL = '#FF6900'
const POLY_FILL_OPACITY = 0.22
const POLY_STROKE = '#FF6900'
const POLY_STROKE_OPACITY = 0.75

export default function CityMap({ cities, recentlyAddedName, focusCityName, showJourney }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const infoWindowRef = useRef<any>(null)
  const polylineRef = useRef<any>(null)
  const walkerRef = useRef<any>(null)
  const animRafRef = useRef<number | null>(null)
  const polygonsRef = useRef<Map<string, any[]>>(new Map())
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
        try {
          mapRef.current.addControl(new window.AMap.ToolBar({
            position: { top: '12px', right: '12px' },
          }))
        } catch {}
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

  // markers + 视野
  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    if (!map || !window.AMap) return

    markersRef.current.forEach((m) => map.remove(m))
    markersRef.current = []

    if (cities.length === 0) return

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

    // 视野调整：新加的城市优先聚焦它，否则 fitView 全部
    if (recentlyAddedName) {
      const newCity = cities.find((c) => c.name === recentlyAddedName)
      if (newCity) {
        map.setZoomAndCenter(8, [newCity.lng, newCity.lat], false, 600)
        setTimeout(() => openPopup(newCity), 700)
      }
    } else if (cities.length === 1) {
      map.setZoomAndCenter(8, [cities[0].lng, cities[0].lat])
    } else if (markersRef.current.length > 0) {
      map.setFitView(markersRef.current, false, [80, 80, 80, 80])
    }
  }, [cities, recentlyAddedName, mapReady])

  // 行政区 polygon 点亮（按 adcode 去重 + 增量 diff）
  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    if (!map || !window.AMap) return

    const wantedAdcodes = new Set(
      cities.map((c) => c.adcode).filter((a): a is string => !!a),
    )
    const currentAdcodes = new Set(polygonsRef.current.keys())

    // 删除：在地图上但已不属于任何已点亮城市
    for (const adcode of currentAdcodes) {
      if (!wantedAdcodes.has(adcode)) {
        const polys = polygonsRef.current.get(adcode) || []
        polys.forEach((p) => map.remove(p))
        polygonsRef.current.delete(adcode)
      }
    }

    // 新增：拉边界并画上去
    for (const adcode of wantedAdcodes) {
      if (currentAdcodes.has(adcode)) continue
      const isNewlyAdded = !!cities.find(
        (c) => c.adcode === adcode && c.name === recentlyAddedName,
      )
      renderPolygonForAdcode(map, adcode, isNewlyAdded).then((polys) => {
        if (polys.length > 0) polygonsRef.current.set(adcode, polys)
      })
    }
  }, [cities, recentlyAddedName, mapReady])

  // 外部聚焦：列表点城市 → 滚到那 + 弹卡
  useEffect(() => {
    if (!mapReady || !focusCityName) return
    const map = mapRef.current
    if (!map) return
    const target = cities.find((c) => c.name === focusCityName)
    if (!target) return
    map.setZoomAndCenter(8, [target.lng, target.lat], false, 600)
    setTimeout(() => openPopup(target), 700)
  }, [focusCityName, mapReady, cities])

  // 轨迹 + 小人动画
  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    if (!map || !window.AMap) return

    function cleanupTrail() {
      if (animRafRef.current) {
        cancelAnimationFrame(animRafRef.current)
        animRafRef.current = null
      }
      if (polylineRef.current) {
        map.remove(polylineRef.current)
        polylineRef.current = null
      }
      if (walkerRef.current) {
        map.remove(walkerRef.current)
        walkerRef.current = null
      }
    }

    cleanupTrail()

    if (!showJourney || cities.length < 2) return

    const sorted = [...cities].sort((a, b) => a.date.localeCompare(b.date))
    const path = sorted.map((c) => [c.lng, c.lat] as [number, number])

    const polyline = new window.AMap.Polyline({
      path,
      strokeColor: TRAIL_COLOR,
      strokeWeight: 3,
      strokeOpacity: 0.65,
      strokeStyle: 'dashed',
      lineJoin: 'round',
      zIndex: 150,
    })
    map.add(polyline)
    polylineRef.current = polyline

    const walker = new window.AMap.Marker({
      position: path[0],
      anchor: 'center',
      zIndex: 300,
      content: `<div class="journey-car"><svg viewBox="0 0 48 24" width="48" height="24"><rect x="2" y="6" width="44" height="14" rx="7" fill="#1a1a1a"/><rect x="6" y="2" width="28" height="12" rx="4" fill="#2c2c2c"/><circle cx="12" cy="20" r="4" fill="#444"/><circle cx="36" cy="20" r="4" fill="#444"/><circle cx="12" cy="20" r="2" fill="#666"/><circle cx="36" cy="20" r="2" fill="#666"/><text x="18" y="11" font-size="7" font-weight="bold" fill="#FF6900" font-family="sans-serif">SU7</text></svg></div>`,
    })
    map.add(walker)
    walkerRef.current = walker

    map.setFitView([polyline], false, [80, 80, 80, 80])

    let segIdx = 0
    let segStart = performance.now()
    const tick = (now: number) => {
      const a = path[segIdx]
      const b = path[segIdx + 1]
      const t = Math.min(1, (now - segStart) / SEGMENT_MS)
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      const lng = a[0] + (b[0] - a[0]) * eased
      const lat = a[1] + (b[1] - a[1]) * eased
      walker.setPosition([lng, lat])
      if (t >= 1) {
        segIdx++
        if (segIdx >= path.length - 1) {
          animRafRef.current = null
          return
        }
        segStart = now
      }
      animRafRef.current = requestAnimationFrame(tick)
    }
    animRafRef.current = requestAnimationFrame(tick)

    return cleanupTrail
  }, [showJourney, cities, mapReady])

  function openPopup(c: City) {
    const map = mapRef.current
    const iw = infoWindowRef.current
    if (!map || !iw) return
    const subtitle = c.parent ? `${c.parent} · ${c.province}` : c.province
    const emoji = getCityEmoji(c.name)
    iw.setContent(`
      <div class="city-popup">
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
      fillColor: POLY_FILL,
      fillOpacity: 0,
      strokeColor: POLY_STROKE,
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
    const eased = 1 - Math.pow(1 - t, 3)
    for (const p of polygons) {
      p.setOptions({
        fillOpacity: eased * POLY_FILL_OPACITY,
        strokeOpacity: eased * POLY_STROKE_OPACITY,
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
