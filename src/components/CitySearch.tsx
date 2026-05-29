import { useMemo, useRef, useState } from 'react'
import { CITIES, type CityEntry } from '../data/cities'
import { getCityEmoji } from '../lib/emoji'

interface Props {
  existingNames: Set<string>
  onAdd: (entry: CityEntry, date: string) => void
  open: boolean
  onClose: () => void
}

const MAX_SUGGESTIONS = 8

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function CitySearch({ existingNames, onAdd, open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [date, setDate] = useState(todayStr())
  const [focusedIdx, setFocusedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const out: CityEntry[] = []
    for (const c of CITIES) {
      if (existingNames.has(c.name)) continue
      const hay = (c.name + c.province + (c.parent ?? '')).toLowerCase()
      if (hay.includes(q)) {
        out.push(c)
        if (out.length >= MAX_SUGGESTIONS) break
      }
    }
    return out
  }, [query, existingNames])

  function pick(entry: CityEntry) {
    onAdd(entry, date)
    setQuery('')
    setFocusedIdx(0)
    inputRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      if (query) {
        setQuery('')
      } else {
        onClose()
      }
      return
    }
    if (suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIdx((i) => Math.min(suggestions.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(suggestions[focusedIdx] ?? suggestions[0])
    }
  }

  if (!open) return null

  return (
    <div className="search-panel">
      <div className="search-panel-header">
        <span>点亮新城市</span>
        <button type="button" className="search-panel-close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="search-row">
        <input
          ref={inputRef}
          className="search-input"
          type="text"
          placeholder="输入城市名搜索（如：北京、宜兴、东京）"
          value={query}
          autoFocus
          onChange={(e) => {
            setQuery(e.target.value)
            setFocusedIdx(0)
          }}
          onKeyDown={onKeyDown}
        />
        <input
          className="search-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          title="打卡日期（可不填）"
        />
      </div>
      {query.trim() && (
        <div className="search-suggestions">
          {suggestions.length === 0 ? (
            <div className="search-empty">无匹配城市</div>
          ) : (
            suggestions.map((c, i) => (
              <button
                type="button"
                key={c.name}
                className={`search-suggestion ${i === focusedIdx ? 'focused' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c)}
                onMouseEnter={() => setFocusedIdx(i)}
              >
                <span className="suggestion-emoji">{getCityEmoji(c.name)}</span>
                <span className="suggestion-name">{c.name}</span>
                <span className="suggestion-meta">
                  {c.parent ? `${c.parent} · ${c.province}` : c.province}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
