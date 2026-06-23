/**
 * Client-side sync orchestration for SDS records → Notion.
 *
 * Mirrors safety-sync.ts: fire-and-forget, exponential backoff, in-flight
 * dedup. When Notion isn't configured the server returns 503 and we leave
 * the record `pending` so it retries later.
 */

import { getSdsById, getAllSdsRecords, markSdsSynced, markSdsSyncFailed, createSdsRecord } from '@/lib/sds-records'
import { SdsRecordSchema } from '@/lib/sds-schemas'
import { notifySyncResult } from '@/components/SyncToast'

let syncDisabledUntil = 0

export function isSdsSyncAvailable(): boolean {
  return Date.now() >= syncDisabledUntil
}


async function attemptSdsSync(id: string): Promise<'ok' | 'not-configured' | 'fail'> {
  const record = getSdsById(id)
  if (!record) return 'fail'
  const res = await fetch('/api/sds/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  })
  if (res.status === 503) return 'not-configured'
  if (!res.ok) return 'fail'
  const data = await res.json()
  if (data?.ok && data?.notionPageId) {
    markSdsSynced(id, data.notionPageId)
    return 'ok'
  }
  return 'fail'
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const inFlight = new Set<string>()

export async function trySyncSds(id: string, notify = true): Promise<boolean> {
  if (Date.now() < syncDisabledUntil) return false
  if (!getSdsById(id)) return false
  if (inFlight.has(id)) return false
  inFlight.add(id)
  const delays = [1000, 2000, 4000]
  try {
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        const result = await attemptSdsSync(id)
        if (result === 'ok') {
          if (notify) notifySyncResult({ tone: 'ok', message: 'SDS synced to cloud' })
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
    markSdsSyncFailed(id)
    if (notify) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        notifySyncResult({ tone: 'warn', message: 'SDS saved offline — will sync when back online' })
      } else {
        notifySyncResult({ tone: 'danger', message: 'SDS sync failed — will retry' })
      }
    }
    return false
  } finally {
    inFlight.delete(id)
  }
}

export async function syncAllPendingSds({ notify = false }: { notify?: boolean } = {}): Promise<void> {
  const pending = getAllSdsRecords().filter(
    (r) => r.syncStatus === 'pending' || r.syncStatus === 'offline' || r.syncStatus === 'failed'
  )
  if (pending.length === 0) return
  let synced = 0
  for (const r of pending) {
    const ok = await trySyncSds(r.id, false)
    if (ok) synced++
  }
  if (notify && synced > 0) {
    notifySyncResult({ tone: 'ok', message: `${synced} SDS record${synced === 1 ? '' : 's'} synced` })
  }
}

export async function checkWebhookQueue(): Promise<number> {
  try {
    const res = await fetch('/api/sds/webhook-queue')
    if (!res.ok) return 0
    const { records } = await res.json()
    if (!Array.isArray(records) || records.length === 0) return 0
    const existing = getAllSdsRecords()
    const existingIds = new Set(existing.map((r) => r.id))
    let added = 0
    for (const stub of records) {
      if (!stub?.id || existingIds.has(stub.id)) continue
      const validated = SdsRecordSchema.safeParse(stub)
      if (!validated.success) {
        console.warn('[sds-sync] Dropping invalid webhook queue record:', stub.id)
        continue
      }
      try {
        createSdsRecord(validated.data)
        added++
      } catch {
        console.warn('[sds-sync] Failed to create record from queue:', stub.id)
      }
    }
    return added
  } catch {
    return 0
  }
}

export function installSdsSyncListeners(): () => void {
  if (typeof window === 'undefined') return () => {}
  void syncAllPendingSds()
  void checkWebhookQueue()
  const onReconnect = () => {
    void syncAllPendingSds({ notify: true })
    void checkWebhookQueue()
  }
  window.addEventListener('online', onReconnect)
  return () => window.removeEventListener('online', onReconnect)
}
