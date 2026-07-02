/**
 * Client-side EHS review submission — the single path all forms use.
 *
 * Returns the REAL outcome so success UIs never claim "submitted for review"
 * for a POST that died (offline, 401 expired session, 429 rate limit, 5xx).
 * The record is read fresh from the store at call time so retries carry the
 * latest notionPageId.
 */

import { getCurrentIdentity } from '@/lib/identity'
import { getSafetyRecordById, markSubmittedForReview, markSynced } from '@/lib/safety-records'

export type ReviewSubmitState = 'pending' | 'submitted' | 'failed'

export function isReviewEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EHS_REVIEW === '1'
}

export async function submitForReview(recordId: string): Promise<'submitted' | 'failed'> {
  try {
    const record = getSafetyRecordById(recordId)
    if (!record) return 'failed'

    const res = await fetch('/api/safety/review/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record, notionPageId: record.notionPageId }),
    })
    if (!res.ok) return 'failed'

    // Persist the Notion page id the server used/created, so later syncs and
    // review polling target the same page instead of creating duplicates.
    try {
      const data = await res.json()
      if (!record.notionPageId && typeof data?.notionPageId === 'string' && data.notionPageId) {
        markSynced(recordId, data.notionPageId)
      }
    } catch { /* body optional — submission itself succeeded */ }

    const identity = getCurrentIdentity()
    const by = { name: identity?.name ?? 'Unknown', email: identity?.email ?? null }
    try {
      markSubmittedForReview(recordId, by)
    } catch {
      // The server accepted the submission but the local status write failed
      // (quota) — report failed so the user retries rather than believing the
      // record tracks a review it doesn't know about. Retry is idempotent
      // server-side (dedup by record id).
      return 'failed'
    }
    return 'submitted'
  } catch {
    return 'failed'
  }
}
