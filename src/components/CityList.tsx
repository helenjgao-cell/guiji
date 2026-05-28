import { useState } from 'react'
import type { City } from '../lib/storage'
import { generateStampSVG } from '../lib/stamp'
import { getCityEmoji } from '../lib/emoji'
import TripList from './TripList'

interface Props {
  cities: City[]
  /** cityName → blob URL；列表里显示缩略图，集邮册里显示印章 */
  photoUrls: Map<string, string>
  /** 点章 / 点条目 → 让 CityMap 滚到该城市 */
  onCityClick: (cityName: string) => void
}

type ViewMode = 'list' | 'grid' | 'trips'

export default function CityList({ cities, photoUrls, onCityClick }: Props) {
  const [view, setView] = useState<ViewMode>('list')

  if (cities.length === 0) {
    return (
      <div className="city-collection">
        <div className="empty">还没有点亮任何城市，拖一张旅行照片试试 ↑</div>
      </div>
    )
  }

  const sorted = [...cities].sort((a, b) => b.addedAt - a.addedAt)

  return (
    <div className="city-collection">
      <div className="view-toggle">
        <button
          className={view === 'list' ? 'active' : ''}
          onClick={() => setView('list')}
        >
          ≡ 列表
        </button>
        <button
          className={view === 'grid' ? 'active' : ''}
          onClick={() => setView('grid')}
        >
          ▦ 集邮册
        </button>
        <button
          className={view === 'trips' ? 'active' : ''}
          onClick={() => setView('trips')}
        >
          📖 旅行
        </button>
      </div>

      {view === 'list' && (
        <ListView cities={sorted} photoUrls={photoUrls} onCityClick={onCityClick} />
      )}
      {view === 'grid' && <GridView cities={sorted} onCityClick={onCityClick} />}
      {view === 'trips' && (
        <TripList cities={cities} photoUrls={photoUrls} onCityClick={onCityClick} />
      )}
    </div>
  )
}

function ListView({
  cities,
  photoUrls,
  onCityClick,
}: {
  cities: City[]
  photoUrls: Map<string, string>
  onCityClick: (n: string) => void
}) {
  return (
    <div className="city-list">
      {cities.map((c) => {
        const photoUrl = photoUrls.get(c.name)
        return (
          <button
            key={c.name}
            type="button"
            className="city-item"
            onClick={() => onCityClick(c.name)}
          >
            {photoUrl ? (
              <img className="city-thumb" src={photoUrl} alt={c.name} />
            ) : (
              <span className="city-emoji">{getCityEmoji(c.name)}</span>
            )}
            <div className="city-name-wrap">
              <div className="city-name">{c.name}</div>
              <div className="city-sub">
                {c.parent ? `${c.parent} · ${c.province}` : c.province}
              </div>
            </div>
            <span className="city-date">{c.date}</span>
          </button>
        )
      })}
    </div>
  )
}

function GridView({
  cities,
  onCityClick,
}: {
  cities: City[]
  onCityClick: (n: string) => void
}) {
  return (
    <div className="stamp-grid">
      {cities.map((c) => (
        <button
          key={c.name}
          type="button"
          className="stamp-cell"
          onClick={() => onCityClick(c.name)}
        >
          <div
            className="stamp-large"
            dangerouslySetInnerHTML={{ __html: generateStampSVG(c.name, 84) }}
          />
          <div className="stamp-cell-name">{c.name}</div>
          <div className="stamp-cell-date">{c.date}</div>
        </button>
      ))}
    </div>
  )
}
