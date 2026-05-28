const STORAGE_KEY = 'suyep_cities_v1'

export interface City {
  name: string
  province: string
  /** 县级市/县的上级地级市，例如 宜兴市 → 无锡市 */
  parent?: string
  /** 中国行政区代码（6 位），用于拉取行政区 polygon。海外城市无此字段 */
  adcode?: string
  lat: number
  lng: number
  date: string // YYYY-MM-DD
  addedAt: number
}

export function getCities(): City[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as City[]) : []
  } catch {
    return []
  }
}

/** 批量覆盖 cities（导入备份用） */
export function saveCities(cities: City[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cities))
}

export function addCity(city: City): City[] {
  const cities = getCities()
  const existing = cities.find((c) => c.name === city.name)
  if (existing) {
    if (city.date > existing.date) {
      existing.date = city.date
    }
    saveCities(cities)
    return cities
  }
  cities.push(city)
  saveCities(cities)
  return cities
}

export function clearCities(): void {
  localStorage.removeItem(STORAGE_KEY)
}
