'use client'

import { useEffect, useState } from 'react'
import type { PermitStatus } from '@/lib/safety-types'

interface PermitTimerProps {
  validUntil: string
  status: PermitStatus
}

function remainingLabel(validUntil: string): { text: string; expired: boolean } {
  const ms = new Date(validUntil).getTime() - Date.now()
  if (ms <= 0) return { text: 'EXPIRED — close out', expired: true }
  const mins = Math.floor(ms / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return { text: h > 0 ? `Expires in ${h}h ${m}m` : `Expires in ${m}m`, expired: false }
}

export default function PermitTimer({ validUntil, status }: PermitTimerProps) {
  const [, tick] = useState(0)

  useEffect(() => {
    if (status !== 'active') return
    const id = setInterval(() => tick((n) => n + 1), 30000)
    return () => clearInterval(id)
  }, [status])

  if (status === 'closed') return <span className="text-xs text-fg-3">Closed</span>
  if (status === 'revoked') return <span className="text-xs text-danger">Revoked</span>

  const { text, expired } = remainingLabel(validUntil)
  return <span className={`text-xs font-medium ${expired ? 'text-expired' : 'text-fg-2'}`}>{text}</span>
}
