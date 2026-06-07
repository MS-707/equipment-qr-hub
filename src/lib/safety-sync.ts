/**
 * Client-side sync orchestration for safety records → Notion.
 *
 * Fire-and-forget. Never blocks the UI. When Notion isn't configured the server
 * returns 503 and we simply leave the record `pending` (not `failed`) so it
 * retries later. Image blobs (signatures/photos) are NOT uploaded in v1 — see
 * the route + spec §12 for the documented limitation.
 */

import { getSafetyRecordById, getAllSafetyRecords, markSynced, markSyncFailed } from '@/lib/safety-records'

async function attemptSync(id: string): Promise<'ok' | 'not-configured' | 'fail'> {
  const record = getSafetyRecordById(id)
  if (!record) return 'fail'
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

export async function trySyncRecord(id: string): Promise<boolean> {
  if (!getSafetyRecordById(id)) return false
  const delays = [1000, 2000, 4000]
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const result = await attemptSync(id)
      if (result === 'ok') return true
      if (result === 'not-configured') return false
    } catch {
      // network/offline — retry if attempts remain
    }
    if (attempt < delays.length) await wait(delays[attempt])
  }
  markSyncFailed(id)
  return false
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
