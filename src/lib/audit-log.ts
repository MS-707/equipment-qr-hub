/**
 * Persistent audit trail of privileged actions (beta decisions, EHS review
 * decisions) in a capped KV list. Append is FAIL-OPEN: auditing must never
 * block or fail the privileged action itself — a KV outage is reported to
 * Sentry and the action proceeds.
 */

import { kv } from '@/lib/kv'
import { reportServerError } from '@/lib/report-error'

const KEY = 'audit:log'
const MAX_ENTRIES = 1000

export type AuditEntry = {
  actor: string
  action: string
  target: string
  at: string
}

export async function appendAudit(entry: Omit<AuditEntry, 'at'>): Promise<void> {
  const full: AuditEntry = { ...entry, at: new Date().toISOString() }
  try {
    await kv.lpush(KEY, JSON.stringify(full))
    await kv.ltrim(KEY, 0, MAX_ENTRIES - 1)
  } catch (err) {
    reportServerError('lib/audit-log', err)
  }
}

export async function recentAudit(limit = 100): Promise<AuditEntry[]> {
  const raw = await kv.lrange<string | AuditEntry>(KEY, 0, Math.max(0, limit - 1))
  return raw
    .map((r) => {
      try {
        return typeof r === 'string' ? (JSON.parse(r) as AuditEntry) : r
      } catch {
        return null
      }
    })
    .filter((e): e is AuditEntry => !!e && typeof e.actor === 'string')
}
