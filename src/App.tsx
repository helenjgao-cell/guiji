import { useState, useEffect } from 'react'
import CityMap from './components/CityMap'
import CityList from './components/CityList'
import CitySearch from './components/CitySearch'
import Stats from './components/Stats'
import { getCities, addCity, saveCities, clearCities, type City } from './lib/storage'
import type { CityEntry } from './data/cities'

const RECENTLY_ADDED_DURATION_MS = 2500

export default function App() {
  const [cities, setCities] = useState<City[]>([])
  const [recentlyAddedName, setRecentlyAddedName] = useState<string | null>(null)
  const [focusCityName, setFocusCityName] = useState<string | null>(null)
  const [showJourney, setShowJourney] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    setCities(getCities())
  }, [])

  function handleAddCity(entry: CityEntry, date: string) {
    const newCity: City = {
      name: entry.name,
      province: entry.province,
      parent: entry.parent,
      adcode: entry.adcode,
      lat: entry.lat,
      lng: entry.lng,
      date: date || new Date().toISOString().slice(0, 10),
      addedAt: Date.now(),
    }
    const updated = addCity(newCity)
    setCities(updated)
    setRecentlyAddedName(newCity.name)
    setTimeout(() => setRecentlyAddedName(null), RECENTLY_ADDED_DURATION_MS)
  }

  function handleDeleteCity(name: string) {
    const next = cities.filter((c) => c.name !== name)
    saveCities(next)
    setCities(next)
  }

  function handleEditDate(name: string, date: string) {
    const next = cities.map((c) => (c.name === name ? { ...c, date } : c))
    saveCities(next)
    setCities(next)
  }

  function handleClear() {
    if (!confirm('确定清除所有城市？')) return
    clearCities()
    setCities([])
    setRecentlyAddedName(null)
  }

  function handleCityClick(cityName: string) {
    setFocusCityName(null)
    setTimeout(() => setFocusCityName(cityName), 0)
  }

  const existingNames = new Set(cities.map((c) => c.name))

  return (
    <div className="app">
      <header>
        <h1>驭迹</h1>
        <div className="subtitle">YUJI</div>
      </header>
      <main>
        <Stats cities={cities} />
        <div className="action-row">
          <button
            className="add-city-btn"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            📍 我要点亮城市
          </button>
          <label className="journey-toggle">
            <input
              type="checkbox"
              checked={showJourney}
              onChange={(e) => setShowJourney(e.target.checked)}
            />
            <svg className="car-badge-icon" viewBox="0 0 24 24" width="20" height="20">
              <rect x="2" y="8" width="20" height="10" rx="5" fill="#1a1a1a"/>
              <rect x="4" y="4" width="14" height="8" rx="3" fill="#333"/>
              <circle cx="7" cy="18" r="2.5" fill="#555"/>
              <circle cx="17" cy="18" r="2.5" fill="#555"/>
              <circle cx="7" cy="18" r="1.2" fill="#888"/>
              <circle cx="17" cy="18" r="1.2" fill="#888"/>
            </svg>
            <span>轨迹动画</span>
          </label>
        </div>
        <CitySearch
          existingNames={existingNames}
          onAdd={handleAddCity}
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
        />
        <CityMap
          cities={cities}
          recentlyAddedName={recentlyAddedName}
          focusCityName={focusCityName}
          showJourney={showJourney}
        />
        <CityList
          cities={cities}
          onCityClick={handleCityClick}
          onDelete={handleDeleteCity}
          onEditDate={handleEditDate}
        />
        {cities.length > 0 && (
          <div className="toolbar">
            <button onClick={handleClear} className="danger">
              清除所有数据
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
