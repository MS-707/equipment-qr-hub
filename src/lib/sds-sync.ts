/**
 * Client-side sync orchestration for SDS records → Notion.
 *
 * Mirrors safety-sync.ts: fire-and-forget, exponential backoff, in-flight
 * dedup. When Notion isn't configured the server returns 503 and we leave
 * the record `pending` so it retries later.
 */

import { getSdsById, getAllSdsRecords, updateSdsRecord } from '@/lib/sds-records'
import { notifySyncResult } from '@/components/SyncToast'

let syncDisabledUntil = 0

export function isSdsSyncAvailable(): boolean {
  return Date.now() >= syncDisabledUntil
}

function markSdsSynced(id: string, notionPageId: string): void {
  updateSdsRecord(id, {} as never)
  const r = getSdsById(id)
  if (!r) return
  const all = JSON.parse(localStorage.getItem('eqr-sds-records') || '[]')
  const idx = all.findIndex((rec: { id: string }) => rec.id === id)
  if (idx !== -1) {
    all[idx] = { ...all[idx], syncStatus: 'synced', notionPageId }
    localStorage.setItem('eqr-sds-records', JSON.stringify(all))
    try { localStorage.setItem('eqr-sds-records-backup', JSON.stringify(all)) } catch { /* non-fatal */ }
  }
}

function markSdsSyncFailed(id: string): void {
  const all = JSON.parse(localStorage.getItem('eqr-sds-records') || '[]')
  const idx = all.findIndex((rec: { id: string }) => rec.id === id)
  if (idx !== -1) {
    all[idx] = { ...all[idx], syncStatus: 'failed' }
    localStorage.setItem('eqr-sds-records', JSON.stringify(all))
  }
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

export function installSdsSyncListeners(): () => void {
  if (typeof window === 'undefined') return () => {}
  void syncAllPendingSds()
  const onReconnect = () => { void syncAllPendingSds({ notify: true }) }
  window.addEventListener('online', onReconnect)
  return () => window.removeEventListener('online', onReconnect)
}
