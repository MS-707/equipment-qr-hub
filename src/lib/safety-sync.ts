/**
 * Client-side sync orchestration for safety records → Notion.
 *
 * Fire-and-forget. Never blocks the UI. When Notion isn't configured the server
 * returns 503 and we simply leave the record `pending` (not `failed`) so it
 * retries later. Image blobs (signatures/photos) are NOT uploaded in v1 — see
 * the route + spec §12 for the documented limitation.
 */

import { getSafetyRecordById, getAllSafetyRecords, markSynced, markSyncFailed } from '@/lib/safety-records'

export async function trySyncRecord(id: string): Promise<boolean> {
  const record = getSafetyRecordById(id)
  if (!record) return false
  try {
    const res = await fetch('/api/safety/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    })
    if (res.status === 503) {
      // Notion not configured — leave pending, don't alarm the user.
      return false
    }
    if (!res.ok) {
      markSyncFailed(id)
      return false
    }
    const data = await res.json()
    if (data?.ok && data?.notionPageId) {
      markSynced(id, data.notionPageId)
      return true
    }
    return false
  } catch {
    // network/offline — keep it pending for the next attempt
    return false
  }
}

export async function syncAllPending(): Promise<void> {
  const pending = getAllSafetyRecords().filter(
    (r) => r.syncStatus === 'pending' || r.syncStatus === 'offline' || r.syncStatus === 'failed'
  )
  for (const r of pending) {
    // sequential to be gentle; overall call is fire-and-forget
    // eslint-disable-next-line no-await-in-loop
    await trySyncRecord(r.id)
  }
}

/** Wire background sync: run once now, and again whenever the device reconnects. */
export function installSyncListeners(): () => void {
  if (typeof window === 'undefined') return () => {}
  const run = () => {
    void syncAllPending()
  }
  run()
  window.addEventListener('online', run)
  return () => window.removeEventListener('online', run)
}
