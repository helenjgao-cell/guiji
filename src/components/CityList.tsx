import { useState, useEffect } from 'react'
import type { City } from '../lib/storage'
import { getCityEmoji } from '../lib/emoji'

interface Props {
  cities: City[]
  onCityClick: (cityName: string) => void
  onDelete: (cityName: string) => void
  onEditDate: (cityName: string, date: string) => void
}

const PAGE_SIZE = 10

export default function CityList({ cities, onCityClick, onDelete, onEditDate }: Props) {
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<'date' | 'addedAt'>('date')

  useEffect(() => {
    setPage(0)
  }, [cities.length, sortKey])

  if (cities.length === 0) {
    return (
      <div className="city-collection">
        <div className="empty">还没有城市，从上面搜索框里加一个 ↑</div>
      </div>
    )
  }

  const sorted = [...cities].sort((a, b) => {
    if (sortKey === 'date') return b.date.localeCompare(a.date)
    return b.addedAt - a.addedAt
  })
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const visible = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  return (
    <div className="city-collection">
      <div className="list-toolbar">
        <span className="list-count">共 {cities.length} 城</span>
        <div className="sort-toggle">
          <button
            className={sortKey === 'date' ? 'active' : ''}
            onClick={() => setSortKey('date')}
          >
            按打卡日期
          </button>
          <button
            className={sortKey === 'addedAt' ? 'active' : ''}
            onClick={() => setSortKey('addedAt')}
          >
            按添加时间
          </button>
        </div>
      </div>
      <div className="city-list">
        {visible.map((c) => (
          <div key={c.name} className="city-item">
            <button
              type="button"
              className="city-item-main"
              onClick={() => onCityClick(c.name)}
            >
              <span className="city-emoji">{getCityEmoji(c.name)}</span>
              <div className="city-name-wrap">
                <div className="city-name">{c.name}</div>
                <div className="city-sub">
                  {c.parent ? `${c.parent} · ${c.province}` : c.province}
                </div>
              </div>
            </button>
            <input
              className="city-date-input"
              type="date"
              value={c.date}
              onChange={(e) => onEditDate(c.name, e.target.value)}
              title="打卡日期（可改）"
            />
            <button
              type="button"
              className="delete-btn"
              onClick={() => onDelete(c.name)}
              title="删除"
              aria-label={`删除 ${c.name}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
      )}
    </div>
  )
}

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
