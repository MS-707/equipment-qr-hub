'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, X, FlaskConical, Plus } from 'lucide-react'
import type { GhsPictogramCode } from '@/lib/sds-types'
import {
  getAllSdsRecords,
  getSdsFavorites,
  searchSds,
  toggleFavorite,
  onSdsChange,
  seedSdsIfNeeded,
} from '@/lib/sds-records'
import type { SdsRecord } from '@/lib/sds-types'
import { SkeletonCard } from '@/components/Skeleton'
import SdsCard from './SdsCard'
import SdsFavorites from './SdsFavorites'
import GhsFilterChips from './GhsFilterChips'

export default function SdsLibrary() {
  const [records, setRecords] = useState<SdsRecord[]>([])
  const [favorites, setFavorites] = useState<SdsRecord[]>([])
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [ghsFilter, setGhsFilter] = useState<Set<GhsPictogramCode>>(new Set())

  const load = useCallback(() => {
    const all = query ? searchSds(query) : getAllSdsRecords()
    setRecords(all)
    setFavorites(getSdsFavorites())
    setLoaded(true)
  }, [query])

  useEffect(() => {
    seedSdsIfNeeded().then(() => load())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
    const unsub = onSdsChange(load)
    const onStorage = () => load()
    window.addEventListener('storage', onStorage)
    return () => {
      unsub()
      window.removeEventListener('storage', onStorage)
    }
  }, [load])

  const handleToggleFavorite = useCallback((id: string) => {
    toggleFavorite(id)
  }, [])

  const handleToggleGhs = useCallback((code: GhsPictogramCode) => {
    setGhsFilter((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }, [])

  const ghsCounts = useMemo(() => {
    const counts = {} as Record<GhsPictogramCode, number>
    const codes: GhsPictogramCode[] = [
      'GHS01', 'GHS02', 'GHS03', 'GHS04', 'GHS05',
      'GHS06', 'GHS07', 'GHS08', 'GHS09',
    ]
    codes.forEach((c) => { counts[c] = 0 })
    records.forEach((r) => {
      r.pictograms.forEach((p) => { counts[p] = (counts[p] || 0) + 1 })
    })
    return counts
  }, [records])

  const filtered = useMemo(() => {
    if (ghsFilter.size === 0) return records
    return records.filter((r) =>
      r.pictograms.some((p) => ghsFilter.has(p))
    )
  }, [records, ghsFilter])

  const showFavorites = !query && ghsFilter.size === 0 && favorites.length > 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between animate-blurIn">
        <div>
          <h1 className="text-xl font-bold text-fg">Safety Data Sheets</h1>
          <p className="text-xs text-fg-3 mt-0.5">
            {loaded ? `${records.length} chemical${records.length !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
        <button
          type="button"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center
                     bg-mytra-purple text-white rounded-xl shadow-card
                     hover:bg-mytra-purple-hover hover:shadow-raised
                     transition-colors duration-200 press-scale"
          aria-label="Add SDS"
          title="Add new Safety Data Sheet"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-3" />
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search chemicals"
          placeholder="Search by name, manufacturer, or CAS…"
          className="w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 pl-9 pr-9
                     text-sm text-fg placeholder:text-fg-4
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-4 hover:text-fg
                       transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* GHS Filter Chips */}
      <GhsFilterChips
        selected={ghsFilter}
        onToggle={handleToggleGhs}
        counts={ghsCounts}
      />

      {/* Favorites Row */}
      {showFavorites && <SdsFavorites favorites={favorites} />}

      {/* Card List */}
      {!loaded ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-mytra-card border border-mytra-border rounded-card p-8 shadow-card text-center animate-fadeInUp">
          <FlaskConical className="w-8 h-8 text-mytra-purple mx-auto mb-3" />
          <p className="text-sm font-medium text-fg mb-1">
            {query || ghsFilter.size > 0 ? 'No matches found' : 'No chemicals yet'}
          </p>
          <p className="text-xs text-fg-3">
            {query || ghsFilter.size > 0
              ? 'Try adjusting your search or filters.'
              : 'Add your first Safety Data Sheet to get started.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((record, i) => (
            <SdsCard
              key={record.id}
              record={record}
              onToggleFavorite={handleToggleFavorite}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  )
}
