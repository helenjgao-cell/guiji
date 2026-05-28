import { useState } from 'react'
import type { City } from '../lib/storage'
import { clusterIntoTrips, formatDateRange, type Trip } from '../lib/trips'
import { getCityEmoji } from '../lib/emoji'
import TripDetail from './TripDetail'

interface Props {
  cities: City[]
  photoUrls: Map<string, string>
  onCityClick: (cityName: string) => void
}

export default function TripList({ cities, photoUrls, onCityClick }: Props) {
  const trips = clusterIntoTrips(cities)
  const [openTripId, setOpenTripId] = useState<string | null>(null)
  const cityByName = new Map(cities.map((c) => [c.name, c]))

  if (trips.length === 0) {
    return <div className="empty">还没有旅行，上传一组照片自动归类</div>
  }

  const openTrip = trips.find((t) => t.id === openTripId) ?? null

  return (
    <>
      <div className="trip-list">
        {trips.map((trip) => (
          <TripCard
            key={trip.id}
            trip={trip}
            photoUrls={photoUrls}
            onClick={() => setOpenTripId(trip.id)}
          />
        ))}
      </div>
      {openTrip && (
        <TripDetail
          trip={openTrip}
          cityByName={cityByName}
          photoUrls={photoUrls}
          onClose={() => setOpenTripId(null)}
          onCityClick={(n) => {
            setOpenTripId(null)
            onCityClick(n)
          }}
        />
      )}
    </>
  )
}

function TripCard({
  trip,
  photoUrls,
  onClick,
}: {
  trip: Trip
  photoUrls: Map<string, string>
  onClick: () => void
}) {
  // 找一张可用的封面图（trip 中第一张有照片的城市）
  const coverUrl = trip.cityNames
    .map((n) => photoUrls.get(n))
    .find((u): u is string => !!u)

  return (
    <button type="button" className="trip-card" onClick={onClick}>
      <div className="trip-card-cover">
        {coverUrl ? (
          <img src={coverUrl} alt={trip.title} />
        ) : (
          <div className="trip-card-cover-empty">📖</div>
        )}
      </div>
      <div className="trip-card-body">
        <div className="trip-title">{trip.title}</div>
        <div className="trip-meta">
          {formatDateRange(trip.startDate, trip.endDate)} · {trip.dayCount} 天 ·{' '}
          {trip.cityNames.length} 城
        </div>
        <div className="trip-emojis">
          {trip.cityNames.slice(0, 8).map((name) => (
            <span key={name} className="trip-emoji" title={name}>
              {getCityEmoji(name)}
            </span>
          ))}
          {trip.cityNames.length > 8 && (
            <span className="trip-emoji-more">+{trip.cityNames.length - 8}</span>
          )}
        </div>
      </div>
    </button>
  )
}

