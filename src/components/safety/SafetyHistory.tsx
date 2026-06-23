'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Search } from 'lucide-react'
import type { SafetyRecord, SafetyRecordType } from '@/lib/safety-types'
import { isPTP, isIncident } from '@/lib/safety-types'
import { getAllSafetyRecords, onSafetyChange, exportSafetyToCsv } from '@/lib/safety-records'
import SafetyRecordCard from './SafetyRecordCard'
import { RecordCardSkeleton } from '@/components/Skeleton'
import PullToRefresh from '@/components/PullToRefresh'

const TYPE_FILTERS: { key: SafetyRecordType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ptp', label: 'PTP' },
  { key: 'jha', label: 'JHA' },
  { key: 'height-permit', label: 'Height' },
  { key: 'hot-work-permit', label: 'Hot Work' },
  { key: 'confined-space-permit', label: 'Confined' },
  { key: 'incident-report', label: 'Incident' },
]

export default function SafetyHistory() {
  const [records, setRecords] = useState<SafetyRecord[]>([])
  const [filter, setFilter] = useState<SafetyRecordType | 'all'>('all')
  const [query, setQuery] = useState('')
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(() => {
    setRecords(getAllSafetyRecords())
    setLoaded(true)
  }, [])

  useEffect(() => {
    load()
    const unsub = onSafetyChange(load)
    const onStorage = () => load()
    window.addEventListener('storage', onStorage)
    return () => {
      unsub()
      window.removeEventListener('storage', onStorage)
    }
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return records.filter((r) => {
      if (filter !== 'all' && r.type !== filter) return false
      if (!q) return true
      const searchable = [r.id, r.location, r.projectName, r.createdBy]
      if (isPTP(r)) searchable.push(r.scopeOfWork)
      if ('workDescription' in r) searchable.push((r as { workDescription: string }).workDescription)
      if ('spaceDescription' in r) searchable.push((r as { spaceDescription: string }).spaceDescription)
      if ('jobTitle' in r) searchable.push((r as { jobTitle: string }).jobTitle)
      if (isIncident(r)) searchable.push(r.description)
      return searchable.some((s) => s != null && s.toLowerCase().includes(q))
    })
  }, [records, filter, query])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of records) {
      counts[r.type] = (counts[r.type] || 0) + 1
    }
    return counts
  }, [records])

  function downloadCsv() {
    const csv = exportSafetyToCsv(filtered)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `safety-records-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <PullToRefresh onRefresh={load}>
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/safety" aria-label="Back to safety dashboard" className="inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> Safety
        </Link>
        <button
          type="button"
          onClick={downloadCsv}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-1.5 text-xs text-fg-2 bg-mytra-card border border-mytra-border rounded-lg px-3 py-2.5 min-h-[44px] hover:bg-mytra-card-hover disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <h1 className="text-xl font-bold text-fg">Safety records</h1>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-3" />
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search safety records"
          placeholder="Search id, location, project, person, description…"
          className="w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 pl-9 pr-3 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple"
        />
      </div>

      {/* Type filter pills */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {TYPE_FILTERS.map((t) => {
          const count = t.key === 'all' ? records.length : (typeCounts[t.key] || 0)
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className={`shrink-0 text-xs font-medium px-3 py-2.5 rounded-full border transition-colors min-h-[44px] ${
                filter === t.key
                  ? 'bg-mytra-purple text-white border-mytra-purple'
                  : 'bg-mytra-bg text-fg-2 border-mytra-border hover:text-fg'
              }`}
            >
              {t.label}{count > 0 ? ` (${count})` : ''}
            </button>
          )
        })}
      </div>

      {!loaded ? (
        <div className="space-y-2">
          <RecordCardSkeleton />
          <RecordCardSkeleton />
          <RecordCardSkeleton />
          <RecordCardSkeleton />
          <RecordCardSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        records.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <p className="text-sm text-fg-3">No safety records yet.</p>
            <Link
              href="/safety/ptp"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-mytra-purple hover:text-mytra-purple-hover"
            >
              Create your first Pre-Task Plan &rarr;
            </Link>
          </div>
        ) : (
          <p className="text-sm text-fg-3 text-center py-10">No records match your search.</p>
        )
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <SafetyRecordCard key={r.id} record={r} />
          ))}
        </div>
      )}
    </div>
    </PullToRefresh>
  )
}
