'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ClipboardList,
  ListChecks,
  ArrowUpFromLine,
  Flame,
  PackageOpen,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { getAllSafetyRecords, onSafetyChange } from '@/lib/safety-records'
import { retrySyncRecord, retryAllPending } from '@/lib/safety-sync'
import { SAFETY_TYPE_LABELS } from '@/lib/safety-types'
import type { SafetyRecord, SafetyRecordType } from '@/lib/safety-types'

const TYPE_ICON: Record<SafetyRecordType, typeof ClipboardList> = {
  'ptp': ClipboardList,
  'jha': ListChecks,
  'height-permit': ArrowUpFromLine,
  'hot-work-permit': Flame,
  'confined-space-permit': PackageOpen,
  'incident-report': AlertTriangle,
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isPending(r: SafetyRecord): boolean {
  return r.syncStatus === 'pending' || r.syncStatus === 'offline' || r.syncStatus === 'failed'
}

export default function SyncQueuePanel() {
  const [expanded, setExpanded] = useState(false)
  const [pending, setPending] = useState<SafetyRecord[]>([])
  const [syncing, setSyncing] = useState<Set<string>>(new Set())
  const [syncingAll, setSyncingAll] = useState(false)
  const prevCountRef = useRef(0)

  const load = useCallback(() => {
    const records = getAllSafetyRecords().filter(isPending)
    setPending(records)
    if (prevCountRef.current > 0 && records.length === 0) {
      setExpanded(false)
    }
    prevCountRef.current = records.length
  }, [])

  useEffect(() => {
    load()
    const unsub = onSafetyChange(load)
    const interval = setInterval(load, 5000)
    return () => {
      unsub()
      clearInterval(interval)
    }
  }, [load])

  if (pending.length === 0) return null

  const handleRetry = async (id: string) => {
    setSyncing((prev) => new Set(prev).add(id))
    try {
      await retrySyncRecord(id)
    } finally {
      setSyncing((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleRetryAll = async () => {
    setSyncingAll(true)
    setSyncing(new Set(pending.map((r) => r.id)))
    try {
      await retryAllPending()
    } finally {
      setSyncingAll(false)
      setSyncing(new Set())
    }
  }

  return (
    <div className="bg-mytra-card border border-mytra-border rounded-lg shadow-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full px-4 py-2.5 min-h-[44px] text-left"
      >
        <RefreshCw className="w-4 h-4 text-warn shrink-0" />
        <p className="text-xs text-warn flex-1">
          {pending.length} record{pending.length !== 1 ? 's' : ''} pending sync
        </p>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-fg-3 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-fg-3 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-mytra-border">
          <ul className="divide-y divide-mytra-border">
            {pending.map((r) => {
              const Icon = TYPE_ICON[r.type]
              const isSyncing = syncing.has(r.id)
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="shrink-0 w-8 h-8 rounded-lg bg-mytra-bg border border-mytra-border flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 text-mytra-purple" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-fg-2 truncate">{SAFETY_TYPE_LABELS[r.type]}</span>
                      <span className="text-[10px] font-mono text-fg-4 truncate">{r.id}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-fg-4">{relativeTime(r.createdAt)}</span>
                      {r.syncStatus === 'failed' ? (
                        <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-danger/10 text-danger">
                          Failed
                        </span>
                      ) : isSyncing ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          Syncing
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-warn/10 text-warn">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => handleRetry(r.id)}
                    className="shrink-0 text-xs font-medium text-mytra-purple hover:text-mytra-purple-hover
                               disabled:opacity-40 disabled:cursor-not-allowed px-2 py-1.5 min-h-[36px] min-w-[44px]
                               rounded-md hover:bg-mytra-purple/10 transition-colors"
                  >
                    Retry
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="px-4 py-3 border-t border-mytra-border">
            <button
              type="button"
              disabled={syncingAll}
              onClick={handleRetryAll}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium
                         bg-mytra-purple text-white hover:bg-mytra-purple-hover disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              {syncingAll ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Sync All
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
