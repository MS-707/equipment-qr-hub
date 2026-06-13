/**
 * Client-side sync orchestration for safety records → Notion.
 *
 * Fire-and-forget. Never blocks the UI. When Notion isn't configured the server
 * returns 503 and we simply leave the record `pending` (not `failed`) so it
 * retries later. Image blobs (signatures/photos) are NOT uploaded in v1 — see
 * the route + spec §12 for the documented limitation.
 */

import { getSafetyRecordById, getAllSafetyRecords, markSynced, markSyncFailed } from '@/lib/safety-records'
import { notifySyncResult } from '@/components/SyncToast'

async function attemptSync(id: string): Promise<'ok' | 'not-configured' | 'fail'> {
  const record = getSafetyRecordById(id)
  if (!record) return 'fail'
  // If a previous markSynced call succeeded but the storage write failed, the
  // notionPageId acts as a tombstone — do not create a duplicate Notion page.
  if (record.notionPageId) {
    markSynced(id, record.notionPageId)
    return 'ok'
  }
  const res = await fetch('/api/safety/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  })
  if (res.status === 503) return 'not-configured'
  if (!res.ok) return 'fail'
  const data = await res.json()
  if (data?.ok && data?.notionPageId) {
    markSynced(id, data.notionPageId)
    return 'ok'
  }
  return 'fail'
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// Tracks records currently being synced to prevent concurrent duplicate POSTs
// when a page reload or 'online' event fires while a sync is in-flight.
const inFlight = new Set<string>()

/**
 * @param notify When true (default), surface a toast for the outcome. Bulk/
 *   background syncs pass `false` so each record doesn't fire its own toast —
 *   the caller aggregates into a single summary instead.
 */
export async function trySyncRecord(id: string, notify = true): Promise<boolean> {
  if (!getSafetyRecordById(id)) return false
  if (inFlight.has(id)) return false
  inFlight.add(id)
  const delays = [1000, 2000, 4000]
  try {
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        const result = await attemptSync(id)
        if (result === 'ok') {
          if (notify) notifySyncResult({ tone: 'ok', message: 'Synced to cloud' })
          return true
        }
        if (result === 'not-configured') {
          // Backend not set up — record stays pending. Not a field-worker-
          // actionable state, so no toast (it would falsely promise a later sync).
          return false
        }
      } catch {
        // network/offline — retry if attempts remain
      }
      if (attempt < delays.length) await wait(delays[attempt])
    }
    markSyncFailed(id)
    if (notify) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        notifySyncResult({ tone: 'warn', message: 'Saved offline — will sync when back online' })
      } else {
        notifySyncResult({ tone: 'danger', message: 'Sync failed — will retry', persist: true })
      }
    }
    return false
  } finally {
    inFlight.delete(id)
  }
}

/**
 * @param notify When true, emit a single aggregate toast summarizing the batch.
 *   Defaults false so the initial app-load sync is silent (no unsolicited toast).
 */
export async function syncAllPending({ notify = false }: { notify?: boolean } = {}): Promise<void> {
  const pending = getAllSafetyRecords().filter(
    (r) => r.syncStatus === 'pending' || r.syncStatus === 'offline' || r.syncStatus === 'failed'
  )
  if (pending.length === 0) return
  let synced = 0
  for (const r of pending) {
    // sequential to be gentle; each per-record sync stays silent
    // eslint-disable-next-line no-await-in-loop
    const ok = await trySyncRecord(r.id, false)
    if (ok) synced++
  }
  if (notify && synced > 0) {
    notifySyncResult({ tone: 'ok', message: `${synced} record${synced === 1 ? '' : 's'} synced` })
  }
}

/** Wire background sync: run once now (silent), and again — with a summary
 *  toast — whenever the device reconnects. */
export function installSyncListeners(): () => void {
  if (typeof window === 'undefined') return () => {}
  void syncAllPending()
  const onReconnect = () => { void syncAllPending({ notify: true }) }
  window.addEventListener('online', onReconnect)
  return () => window.removeEventListener('online', onReconnect)
}
