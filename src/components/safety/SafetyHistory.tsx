'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Search } from 'lucide-react'
import type { SafetyRecord, SafetyRecordType } from '@/lib/safety-types'
import { getAllSafetyRecords, onSafetyChange, exportSafetyToCsv } from '@/lib/safety-records'
import SafetyRecordCard from './SafetyRecordCard'

const TYPE_FILTERS: { key: SafetyRecordType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ptp', label: 'PTP' },
  { key: 'height-permit', label: 'Height' },
  { key: 'hot-work-permit', label: 'Hot Work' },
  { key: 'confined-space-permit', label: 'Confined' },
  { key: 'incident-report', label: 'Incident' },
]

export default function SafetyHistory() {
  const [records, setRecords] = useState<SafetyRecord[]>([])
  const [filter, setFilter] = useState<SafetyRecordType | 'all'>('all')
  const [query, setQuery] = useState('')

  const load = useCallback(() => setRecords(getAllSafetyRecords()), [])

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
      return (
        r.id.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        r.projectName.toLowerCase().includes(q) ||
        r.createdBy.toLowerCase().includes(q)
      )
    })
  }, [records, filter, query])

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
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/safety" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Safety Hub
        </Link>
        <button
          type="button"
          onClick={downloadCsv}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-1.5 text-xs text-gray-300 bg-mytra-card border border-mytra-border rounded-lg px-3 py-1.5 hover:bg-mytra-card-hover disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <h1 className="text-xl font-bold text-white">Safety records</h1>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search id, location, project, person…"
          className="w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-mytra-purple focus:border-transparent"
        />
      </div>

      {/* Type filter pills */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {TYPE_FILTERS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              filter === t.key
                ? 'bg-mytra-purple text-white border-mytra-purple'
                : 'bg-mytra-bg text-gray-400 border-mytra-border hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-10">No records match.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <SafetyRecordCard key={r.id} record={r} />
          ))}
        </div>
      )}
    </div>
  )
}
