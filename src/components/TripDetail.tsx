import { useEffect } from 'react'
import type { City } from '../lib/storage'
import { formatDateRange, type Trip } from '../lib/trips'
import { getCityEmoji } from '../lib/emoji'

interface Props {
  trip: Trip
  cityByName: Map<string, City>
  photoUrls: Map<string, string>
  onClose: () => void
  onCityClick: (cityName: string) => void
}

export default function TripDetail({
  trip,
  cityByName,
  photoUrls,
  onClose,
  onCityClick,
}: Props) {
  // ESC 关
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // 找有照片的封面（沿时间顺序第一张）
  const coverUrl = trip.cityNames
    .map((n) => photoUrls.get(n))
    .find((u): u is string => !!u)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="trip-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close trip-modal-close" onClick={onClose} aria-label="关闭">
          ×
        </button>

        {coverUrl && (
          <div className="trip-cover">
            <img src={coverUrl} alt={trip.title} />
            <div className="trip-cover-gradient" />
          </div>
        )}

        <div className="trip-detail-body">
          <h2 className="trip-detail-title">{trip.title}</h2>
          <div className="trip-detail-meta">
            {formatDateRange(trip.startDate, trip.endDate)} · {trip.dayCount} 天
            · {trip.cityNames.length} 城
          </div>

          {/* 印章时间线（按访问日期排）*/}
          <div className="trip-timeline">
            <div className="trip-section-title">途经</div>
            {trip.cityNames.map((name) => {
              const c = cityByName.get(name)
              if (!c) return null
              const photoUrl = photoUrls.get(name)
              return (
                <button
                  type="button"
                  key={name}
                  className="timeline-item"
                  onClick={() => onCityClick(name)}
                >
                  <span className="timeline-emoji">{getCityEmoji(name)}</span>
                  <div className="timeline-info">
                    <div className="timeline-name">{c.name}</div>
                    <div className="timeline-sub">
                      {c.parent ? `${c.parent} · ${c.province}` : c.province}
                      <span className="timeline-date"> · {c.date}</span>
                    </div>
                  </div>
                  {photoUrl && (
                    <img className="timeline-thumb" src={photoUrl} alt={name} />
                  )}
                </button>
              )
            })}
          </div>

          {/* 照片墙 */}
          {(() => {
            const photos = trip.cityNames
              .map((n) => ({ name: n, url: photoUrls.get(n) }))
              .filter((p): p is { name: string; url: string } => !!p.url)
            if (photos.length === 0) return null
            return (
              <div className="trip-photo-wall">
                <div className="trip-section-title">照片</div>
                <div className="photo-wall-grid">
                  {photos.map((p) => (
                    <img
                      key={p.name}
                      src={p.url}
                      alt={p.name}
                      title={p.name}
                      className="wall-photo"
                    />
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
