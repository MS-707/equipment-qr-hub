'use client'

import Link from 'next/link'
import { ClipboardList, ListChecks, ArrowUpFromLine, Flame, PackageOpen, AlertTriangle, RefreshCw, AlertCircle } from 'lucide-react'
import type { SafetyRecord, SafetyRecordType, AnyPermit } from '@/lib/safety-types'
import { SAFETY_TYPE_LABELS, isPermit, isPTP, isJHA, isIncident } from '@/lib/safety-types'
import PermitStatusBadge from './PermitStatusBadge'
import ReviewStatusBadge from './ReviewStatusBadge'
import { isSyncAvailable } from '@/lib/safety-sync'

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

function title(r: SafetyRecord): string {
  if (isPTP(r)) return r.scopeOfWork || 'Pre-Task Plan'
  if (isJHA(r)) return r.jobTitle || 'Job Hazard Analysis'
  if (isPermit(r)) {
    const p = r as AnyPermit
    if ('workDescription' in p) return p.workDescription || SAFETY_TYPE_LABELS[r.type]
    return p.spaceDescription || SAFETY_TYPE_LABELS[r.type]
  }
  if (isIncident(r)) return r.description || 'Incident report'
  return 'Safety record'
}

export default function SafetyRecordCard({ record }: { record: SafetyRecord }) {
  const Icon = TYPE_ICON[record.type]
  return (
    <Link
      href={`/safety/record/${record.id}`}
      className="block bg-mytra-card border border-mytra-border rounded-lg px-3 py-3 shadow-card
                 hover:bg-mytra-card-hover hover:-translate-y-0.5 hover:shadow-lg hover:shadow-mytra-purple/5
                 active:translate-y-0 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] press-scale"
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-9 h-9 rounded-lg bg-mytra-bg border border-mytra-border flex items-center justify-center">
          <Icon className="w-4 h-4 text-mytra-purple" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-fg-3">{record.id}</span>
            <span className="text-xs text-fg-4">· {SAFETY_TYPE_LABELS[record.type]}</span>
          </div>
          <p className="text-sm text-fg truncate">{title(record)}</p>
          <p className="text-xs text-fg-3 truncate">
            {record.location ? `${record.location} · ` : ''}
            {record.createdBy} · {relativeTime(record.createdAt)}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {isSyncAvailable() && (
            record.syncStatus === 'failed' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-danger/10 text-danger">
                <AlertCircle className="w-3 h-3" />
                Failed
              </span>
            ) : record.syncStatus === 'pending' || record.syncStatus === 'offline' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-warn/10 text-warn">
                <RefreshCw className="w-3 h-3" />
                Pending
              </span>
            ) : record.syncStatus === 'synced' ? (
              <span
                className="w-1.5 h-1.5 rounded-full bg-ok"
                title="Synced"
              />
            ) : null
          )}
          {isPermit(record) && <PermitStatusBadge permit={record as AnyPermit} />}
          <ReviewStatusBadge record={record} />
        </div>
      </div>
    </Link>
  )
}
