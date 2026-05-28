import { computeStats, formatKm, TOTAL_CN_PREFECTURES } from '../lib/stats'
import { getCityEmoji } from '../lib/emoji'
import type { City } from '../lib/storage'

interface Props {
  cities: City[]
}

export default function Stats({ cities }: Props) {
  const s = computeStats(cities)
  const showExtremes = cities.length >= 2 && s.north && s.south && s.east && s.west

  return (
    <div className="stats">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-num">{s.cityCount}</div>
          <div className="stat-label">城</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{s.provinceCount}</div>
          <div className="stat-label">省份/地区</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{s.tripCount}</div>
          <div className="stat-label">次旅行</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{s.thisYearCount}</div>
          <div className="stat-label">今年</div>
        </div>
      </div>

      <div className="progress-row">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${Math.min(100, s.cnProgressPct)}%` }}
          />
        </div>
        <div className="progress-text">
          中国地级市 {s.cnCityCount} / {TOTAL_CN_PREFECTURES} ·{' '}
          {s.cnProgressPct.toFixed(1)}%
        </div>
      </div>

      {showExtremes && (
        <div className="extremes">
          <div className="extreme">
            <span className="extreme-dir">↑ 最北</span>
            <span className="extreme-emoji">{getCityEmoji(s.north!.name)}</span>
            <span className="extreme-name">{s.north!.name}</span>
          </div>
          <div className="extreme">
            <span className="extreme-dir">↓ 最南</span>
            <span className="extreme-emoji">{getCityEmoji(s.south!.name)}</span>
            <span className="extreme-name">{s.south!.name}</span>
          </div>
          <div className="extreme">
            <span className="extreme-dir">→ 最东</span>
            <span className="extreme-emoji">{getCityEmoji(s.east!.name)}</span>
            <span className="extreme-name">{s.east!.name}</span>
          </div>
          <div className="extreme">
            <span className="extreme-dir">← 最西</span>
            <span className="extreme-emoji">{getCityEmoji(s.west!.name)}</span>
            <span className="extreme-name">{s.west!.name}</span>
          </div>
          {(s.latSpanKm > 0 || s.lngSpanKm > 0) && (
            <div className="span-summary">
              南北跨度 {formatKm(s.latSpanKm)} · 东西跨度 {formatKm(s.lngSpanKm)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
