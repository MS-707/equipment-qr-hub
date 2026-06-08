'use client'

import { Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import type { SafetyRecord } from '@/lib/safety-types'
import { REVIEW_STATUS_COLORS, REVIEW_STATUS_LABELS } from '@/lib/safety-types'

const ICONS: Record<string, typeof Clock> = {
  submitted: Clock,
  approved: CheckCircle2,
  rejected: AlertCircle,
}

export default function ReviewStatusBadge({ record }: { record: SafetyRecord }) {
  const status = record.reviewStatus
  if (!status || status === 'recalled') return null

  const color = REVIEW_STATUS_COLORS[status]
  const Icon = ICONS[status]

  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 25%, transparent)` }}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {REVIEW_STATUS_LABELS[status]}
    </span>
  )
}
