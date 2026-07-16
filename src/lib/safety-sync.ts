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
import { getStoredT } from '@/lib/i18n-core'

let syncDisabledUntil = 0

export function isSyncAvailable(): boolean {
  return Date.now() >= syncDisabledUntil
}

/** Epoch ms when sync becomes available again (0 = available now). Lets the
 *  queue panel show "retrying in Nm" instead of vanishing during backoff. */
export function getSyncAvailableAt(): number {
  return syncDisabledUntil
}

async function attemptSync(id: string): Promise<'ok' | 'not-configured' | 'fail'> {
  const record = getSafetyRecordById(id)
  if (!record) return 'fail'
  // NOTE: a record can be pending WITH a notionPageId — that means it was
  // mutated after its last sync (closed/revoked/review outcome). Always POST;
  // the server dedups by ID and UPDATES the existing page instead of creating
  // a duplicate, so this is retry-safe in both directions.
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
  if (Date.now() < syncDisabledUntil) return false
  if (!getSafetyRecordById(id)) return false
  if (inFlight.has(id)) return false
  inFlight.add(id)
  const delays = [1000, 2000, 4000]
  try {
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        const result = await attemptSync(id)
        if (result === 'ok') {
          if (notify) notifySyncResult({ tone: 'ok', message: getStoredT()('sync.syncedToCloud', undefined, 'Synced to cloud') })
          return true
        }
        if (result === 'not-configured') {
          syncDisabledUntil = Date.now() + 5 * 60 * 1000
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
        notifySyncResult({ tone: 'warn', message: getStoredT()('sync.savedOffline', undefined, 'Saved offline — will sync when back online') })
      } else {
        notifySyncResult({ tone: 'danger', message: getStoredT()('sync.syncFailed', undefined, 'Sync failed — will retry') })
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
    notifySyncResult({ tone: 'ok', message: getStoredT()('sync.recordsSynced', { count: synced }) })
  }
}

export async function retrySyncRecord(recordId: string): Promise<boolean> {
  return trySyncRecord(recordId, true)
}

export async function retryAllPending(): Promise<void> {
  return syncAllPending({ notify: true })
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
