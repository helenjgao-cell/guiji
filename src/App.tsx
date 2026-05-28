import { useState, useEffect, useRef } from 'react'
import PhotoDropzone from './components/PhotoDropzone'
import CityMap from './components/CityMap'
import CityList from './components/CityList'
import Stats from './components/Stats'
import { getCities, addCity, clearCities, type City } from './lib/storage'
import { extractGPS } from './lib/exif'
import { reverseGeocode } from './lib/geocode'
import { processImage } from './lib/image'
import { savePhoto, getPhoto, clearAllPhotos } from './lib/photo-store'
import { buildBackup, restoreBackup, downloadBackup, type BackupData } from './lib/backup'

interface ProcessSummary {
  total: number
  added: number
  updated: number
  noGPS: number
  failed: number
  photoFailed: number
}

const RECENTLY_ADDED_DURATION_MS = 4000

export default function App() {
  const [cities, setCities] = useState<City[]>([])
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSummary, setLastSummary] = useState<ProcessSummary | null>(null)
  const [recentlyAddedName, setRecentlyAddedName] = useState<string | null>(null)
  const [focusCityName, setFocusCityName] = useState<string | null>(null)
  const [checkingIn, setCheckingIn] = useState(false)
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map())
  const photoUrlsRef = useRef(photoUrls)
  photoUrlsRef.current = photoUrls
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setCities(getCities())
  }, [])

  // 给当前 cities 中没有 photoUrl 的，从 IndexedDB 加载
  useEffect(() => {
    let cancelled = false
    const missing = cities.filter((c) => !photoUrlsRef.current.has(c.name))
    if (missing.length === 0) return

    Promise.all(
      missing.map(async (c) => {
        const record = await getPhoto(c.name).catch(() => null)
        if (!record) return null
        return [c.name, URL.createObjectURL(record.blob)] as const
      }),
    ).then((results) => {
      if (cancelled) return
      const newOnes = results.filter((r): r is readonly [string, string] => r !== null)
      if (newOnes.length === 0) return
      setPhotoUrls((prev) => {
        const next = new Map(prev)
        for (const [k, v] of newOnes) next.set(k, v)
        return next
      })
    })

    return () => {
      cancelled = true
    }
  }, [cities])

  useEffect(() => {
    return () => {
      for (const url of photoUrlsRef.current.values()) {
        URL.revokeObjectURL(url)
      }
    }
  }, [])

  async function handlePhotos(files: File[]) {
    setError(null)
    setProcessing(true)
    const summary: ProcessSummary = {
      total: files.length,
      added: 0,
      updated: 0,
      noGPS: 0,
      failed: 0,
      photoFailed: 0,
    }
    const beforeNames = new Set(getCities().map((c) => c.name))

    let latestList: City[] = getCities()
    let lastNewCityName: string | null = null
    const newPhotoUrls: Array<readonly [string, string]> = []

    for (const file of files) {
      try {
        const gps = await extractGPS(file)
        if (!gps) {
          summary.noGPS++
          continue
        }
        const result = await reverseGeocode(gps.lat, gps.lng)
        if (!result) {
          summary.failed++
          continue
        }
        const newCity: City = {
          name: result.city,
          province: result.province,
          parent: result.parent,
          adcode: result.adcode,
          lat: gps.lat,
          lng: gps.lng,
          date: gps.date,
          addedAt: Date.now(),
        }
        const wasExisting = beforeNames.has(newCity.name)
        latestList = addCity(newCity)
        if (wasExisting) {
          summary.updated++
        } else {
          summary.added++
          beforeNames.add(newCity.name)
          lastNewCityName = newCity.name
        }

        try {
          const processed = await processImage(file)
          await savePhoto(newCity.name, processed.blob, processed.width, processed.height)
          const oldUrl = photoUrlsRef.current.get(newCity.name)
          if (oldUrl) URL.revokeObjectURL(oldUrl)
          newPhotoUrls.push([newCity.name, URL.createObjectURL(processed.blob)] as const)
        } catch (e) {
          console.error('[photo] processing failed for', file.name, e)
          summary.photoFailed++
        }
      } catch (e) {
        console.error('Process file error:', file.name, e)
        summary.failed++
      }
    }

    setCities(latestList)
    if (newPhotoUrls.length > 0) {
      setPhotoUrls((prev) => {
        const next = new Map(prev)
        for (const [k, v] of newPhotoUrls) next.set(k, v)
        return next
      })
    }
    setLastSummary(summary)
    setProcessing(false)

    if (lastNewCityName) {
      setRecentlyAddedName(lastNewCityName)
      setTimeout(() => setRecentlyAddedName(null), RECENTLY_ADDED_DURATION_MS)
    }

    if (summary.added === 0 && summary.updated === 0) {
      if (summary.noGPS === summary.total) {
        setError('这些照片都没有 GPS 信息。试试用手机拍的原图（截图 / 微信传过的图会丢 GPS）。')
      } else if (summary.failed > 0) {
        setError('GPS 坐标超出城市表覆盖范围（>500km），可能是冷门地区。')
      }
    }
  }

  async function handleLiveCheckIn() {
    setError(null)
    if (!('geolocation' in navigator)) {
      setError('浏览器不支持定位。')
      return
    }
    setCheckingIn(true)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 30000,
        })
      })
      const { latitude: lat, longitude: lng } = pos.coords
      console.log('[checkin] got GPS:', lat, lng)
      const result = await reverseGeocode(lat, lng)
      if (!result) {
        setError('当前位置不在已知城市范围内（>500km），可能是海外或偏远地区。')
        return
      }
      const today = new Date().toISOString().slice(0, 10)
      const wasExisting = getCities().some((c) => c.name === result.city)
      const newCity: City = {
        name: result.city,
        province: result.province,
        parent: result.parent,
        adcode: result.adcode,
        lat,
        lng,
        date: today,
        addedAt: Date.now(),
      }
      const updated = addCity(newCity)
      setCities(updated)
      if (!wasExisting) {
        setRecentlyAddedName(newCity.name)
        setTimeout(() => setRecentlyAddedName(null), RECENTLY_ADDED_DURATION_MS)
      } else {
        // 已点亮，只跳到那个城市
        setFocusCityName(null)
        setTimeout(() => setFocusCityName(newCity.name), 0)
      }
    } catch (e) {
      console.error('[checkin] error', e)
      const msg =
        e instanceof GeolocationPositionError
          ? e.code === 1
            ? '需要授权浏览器定位才能现场打卡'
            : e.code === 2
              ? '定位失败，检查手机/电脑的 GPS 或网络'
              : '定位超时，再点一次试试'
          : e instanceof Error
            ? e.message
            : String(e)
      setError('现场打卡失败：' + msg)
    } finally {
      setCheckingIn(false)
    }
  }

  async function handleClear() {
    if (!confirm('确定清除所有城市？localStorage + IndexedDB 数据都会被删除。')) return
    clearCities()
    await clearAllPhotos().catch((e) => console.warn('clearAllPhotos failed', e))
    for (const url of photoUrlsRef.current.values()) URL.revokeObjectURL(url)
    setCities([])
    setPhotoUrls(new Map())
    setLastSummary(null)
    setRecentlyAddedName(null)
  }

  async function handleExport() {
    try {
      const data = await buildBackup()
      downloadBackup(data)
    } catch (e) {
      console.error('[backup] export failed', e)
      alert('导出失败：' + (e instanceof Error ? e.message : String(e)))
    }
  }

  function handleImportClick() {
    importInputRef.current?.click()
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const text = await file.text()
      const data = JSON.parse(text) as BackupData
      const merge = confirm(
        '点"确定"= 合并到当前数据（同名城市以备份为准）\n点"取消"= 替换全部当前数据',
      )
      const { citiesRestored, photosRestored } = await restoreBackup(data, { merge })
      for (const url of photoUrlsRef.current.values()) URL.revokeObjectURL(url)
      setPhotoUrls(new Map())
      setCities(getCities())
      alert(`导入成功！恢复 ${citiesRestored} 城市，${photosRestored} 张照片。`)
    } catch (err) {
      console.error('[backup] import failed', err)
      alert('导入失败：' + (err instanceof Error ? err.message : String(err)))
    }
  }

  function handleCityClick(cityName: string) {
    setFocusCityName(null)
    setTimeout(() => setFocusCityName(cityName), 0)
  }

  return (
    <div className="app">
      <header>
        <h1>素页</h1>
        <div className="subtitle">SUYEP</div>
      </header>
      <main>
        <Stats cities={cities} />
        {error && <div className="error-banner">{error}</div>}
        <CityMap
          cities={cities}
          recentlyAddedName={recentlyAddedName}
          photoUrls={photoUrls}
          focusCityName={focusCityName}
        />
        <PhotoDropzone onPhotos={handlePhotos} processing={processing} />
        <button
          className="checkin-btn"
          onClick={handleLiveCheckIn}
          disabled={checkingIn || processing}
        >
          {checkingIn ? '⏳ 正在定位...' : '📍 现场打卡（用浏览器定位）'}
        </button>
        {lastSummary && lastSummary.total > 0 && (
          <div className="dropzone-hint" style={{ textAlign: 'center' }}>
            上次处理 {lastSummary.total} 张照片：
            新增 {lastSummary.added} · 更新 {lastSummary.updated} · 无 GPS{' '}
            {lastSummary.noGPS} · 失败 {lastSummary.failed}
            {lastSummary.photoFailed > 0 && ` · 照片处理失败 ${lastSummary.photoFailed}`}
          </div>
        )}
        <CityList cities={cities} photoUrls={photoUrls} onCityClick={handleCityClick} />
        <div className="toolbar">
          <button onClick={handleExport} disabled={cities.length === 0}>
            导出备份
          </button>
          <button onClick={handleImportClick}>导入备份</button>
          {cities.length > 0 && (
            <button onClick={handleClear} className="danger">
              清除所有数据
            </button>
          )}
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>
      </main>
    </div>
  )
}
