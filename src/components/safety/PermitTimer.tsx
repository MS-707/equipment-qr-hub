'use client'

import { useEffect, useState } from 'react'
import type { PermitStatus } from '@/lib/safety-types'
import { useT } from '@/lib/i18n'
import type { TFunction } from '@/lib/i18n-core'

interface PermitTimerProps {
  validUntil: string
  status: PermitStatus
}

function remainingLabel(validUntil: string, t: TFunction): { text: string; expired: boolean; urgent: boolean } {
  const ms = new Date(validUntil).getTime() - Date.now()
  if (ms <= 0) return { text: t('permits.timerExpired', undefined, 'EXPIRED — close out permit'), expired: true, urgent: false }
  const mins = Math.floor(ms / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const urgent = mins <= 30
  const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`
  return {
    text: urgent ? t('permits.timerLeftSoon', { time: timeStr }) : t('permits.timerExpiresIn', { time: timeStr }),
    expired: false,
    urgent,
  }
}

export default function PermitTimer({ validUntil, status }: PermitTimerProps) {
  const t = useT()
  const [, tick] = useState(0)

  useEffect(() => {
    if (status !== 'active') return
    const id = setInterval(() => tick((n) => n + 1), 30000)
    return () => clearInterval(id)
  }, [status])

  if (status === 'closed') return <span className="text-xs text-fg-3">{t('permits.status.closed', undefined, 'Closed')}</span>
  if (status === 'revoked') return <span className="text-xs text-danger">{t('permits.status.revoked', undefined, 'Revoked')}</span>

  const { text, expired, urgent } = remainingLabel(validUntil, t)
  return <span className={`text-xs font-medium tabular-nums ${expired ? 'text-expired' : urgent ? 'text-warn' : 'text-fg-2'}`}>{text}</span>
}
