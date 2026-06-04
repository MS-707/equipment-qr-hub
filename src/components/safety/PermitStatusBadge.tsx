'use client'

import type { AnyPermit } from '@/lib/safety-types'
import { PERMIT_STATUS_COLORS } from '@/lib/safety-types'
import { permitDisplayStatus } from '@/lib/safety-records'

const LABELS: Record<string, string> = {
  active: 'Active',
  closed: 'Closed',
  revoked: 'Revoked',
  expired: 'Expired',
}

export default function PermitStatusBadge({ permit }: { permit: AnyPermit }) {
  const status = permitDisplayStatus(permit)
  const color = PERMIT_STATUS_COLORS[status]
  return (
    <span
      className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
    >
      {LABELS[status]}
    </span>
  )
}
