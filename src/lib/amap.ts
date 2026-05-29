declare global {
  interface Window {
    AMap: any
    _AMapSecurityConfig?: { securityJsCode?: string }
  }
}

let amapPromise: Promise<void> | null = null

/**
 * 加载高德 JS SDK（仅用于地图渲染）
 * 逆地理编码已改为离线查表，不再依赖 AMap.Geocoder
 */
export function loadAMap(): Promise<void> {
  if (amapPromise) return amapPromise

  const key = import.meta.env.VITE_AMAP_KEY as string | undefined
  const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE as string | undefined

  if (!key) {
    return Promise.reject(new Error('VITE_AMAP_KEY 未在 .env.local 中设置'))
  }

  if (securityCode) {
    window._AMapSecurityConfig = { securityJsCode: securityCode }
  }

  amapPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-amap]')
    if (existing) {
      if (window.AMap) {
        resolve()
      } else {
        existing.addEventListener('load', () => resolve())
        existing.addEventListener('error', () => reject(new Error('AMap 加载失败')))
      }
      return
    }
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.ToolBar`
    script.async = true
    script.dataset.amap = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('AMap 加载失败（检查网络或 Key）'))
    document.head.appendChild(script)
  })

  return amapPromise
}
