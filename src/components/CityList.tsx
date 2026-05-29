import { useState, useEffect } from 'react'
import type { City } from '../lib/storage'
import { generateStampSVG } from '../lib/stamp'
import { getCityEmoji } from '../lib/emoji'
import TripList from './TripList'

interface Props {
  cities: City[]
  photoUrls: Map<string, string>
  onCityClick: (cityName: string) => void
}

type ViewMode = 'list' | 'grid' | 'trips'

const LIST_PAGE_SIZE = 8
const GRID_PAGE_SIZE = 12

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
        <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
          ≡ 列表
        </button>
        <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>
          ▦ 集邮册
        </button>
        <button className={view === 'trips' ? 'active' : ''} onClick={() => setView('trips')}>
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
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(cities.length / LIST_PAGE_SIZE))

  // 数据变了重置回第一页
  useEffect(() => {
    setPage(0)
  }, [cities.length])

  const safePage = Math.min(page, totalPages - 1)
  const visible = cities.slice(safePage * LIST_PAGE_SIZE, (safePage + 1) * LIST_PAGE_SIZE)

  return (
    <div>
      <div className="city-list">
        {visible.map((c) => {
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
      {totalPages > 1 && (
        <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
      )}
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
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(cities.length / GRID_PAGE_SIZE))

  useEffect(() => {
    setPage(0)
  }, [cities.length])

  const safePage = Math.min(page, totalPages - 1)
  const visible = cities.slice(safePage * GRID_PAGE_SIZE, (safePage + 1) * GRID_PAGE_SIZE)

  return (
    <div>
      <div className="stamp-grid">
        {visible.map((c) => (
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
      {totalPages > 1 && (
        <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
      )}
    </div>
  )
}

/** 分页控件：← 第 X / Y 页 → */
export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (next: number) => void
}) {
  return (
    <div className="pagination">
      <button
        type="button"
        className="page-arrow"
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
      >
        ← 上一页
      </button>
      <span className="page-info">
        {page + 1} / {totalPages}
      </span>
      <button
        type="button"
        className="page-arrow"
        onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
        disabled={page === totalPages - 1}
      >
        下一页 →
      </button>
    </div>
  )
}
