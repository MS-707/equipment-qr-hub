'use client'

import type { AnyPermit } from '@/lib/safety-types'
import { PERMIT_STATUS_COLORS } from '@/lib/safety-types'
import { permitDisplayStatus } from '@/lib/safety-records'
import { useT } from '@/lib/i18n'
import type { MessageKey } from '@/lib/i18n-keys'

const LABELS: Record<string, { key: MessageKey; en: string }> = {
  active: { key: 'permits.status.active', en: 'Active' },
  closed: { key: 'permits.status.closed', en: 'Closed' },
  revoked: { key: 'permits.status.revoked', en: 'Revoked' },
  expired: { key: 'permits.status.expired', en: 'Expired' },
}

export default function PermitStatusBadge({ permit }: { permit: AnyPermit }) {
  const t = useT()
  const status = permitDisplayStatus(permit)
  const color = PERMIT_STATUS_COLORS[status]
  const label = LABELS[status]
  return (
    <span
      className="inline-flex items-center text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 25%, transparent)` }}
    >
      {label ? t(label.key, undefined, label.en) : status}
    </span>
  )
}
