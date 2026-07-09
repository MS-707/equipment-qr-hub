/**
 * Inspection data access layer — THE SWAP POINT.
 *
 * Currently backed by localStorage. To migrate to Notion,
 * replace the internal read/write helpers and keep the public API unchanged.
 */

import { InspectionRecord, InspectionItemResult, ChecklistType, Shift } from '@/lib/types'
import { getAllItems } from '@/data/inspection-checklists'
import { createWorkOrder } from '@/lib/work-orders'
import { updateEquipmentStatus, getEquipmentById } from '@/lib/equipment'
import { cryptoRandomId } from '@/lib/safety-records'

const STORAGE_KEY = 'eqr-inspections'
const STORAGE_KEY_BACKUP = 'eqr-inspections-backup'
const COUNTER_KEY = 'eqr-ins-counter'
const INSPECTOR_KEY = 'eqr-last-inspector'
const LAST_EQUIPMENT_KEY = 'eqr-last-equipment'

// ── IndexedDB photo storage ──────────────────────────

const PHOTO_DB = 'eqr-photo-store'
const PHOTO_STORE = 'photos'

function openPhotoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PHOTO_DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(PHOTO_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function savePhotos(recordId: string, items: InspectionItemResult[]): Promise<void> {
  const photos = items.filter((i) => i.photo)
  if (photos.length === 0) return
  const db = await openPhotoDB()
  const tx = db.transaction(PHOTO_STORE, 'readwrite')
  const store = tx.objectStore(PHOTO_STORE)
  for (const item of photos) {
    store.put(item.photo, `${recordId}:${item.id}`)
  }
  // Await transaction commit — the record stores photo: null, so IndexedDB is
  // the ONLY copy of defect evidence. A quota abort must reject to the caller,
  // not vanish while the puts are still in flight.
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
  db.close()
}

const SIGNATURE_SLOT = '__signature__'

/** Persist the operator's touch signature next to the record's photos.
 *  Awaits the transaction — the signature is the auditable proof of sign-on
 *  and must not vanish silently. */
export async function saveSignature(recordId: string, dataUrl: string): Promise<void> {
  const db = await openPhotoDB()
  const tx = db.transaction(PHOTO_STORE, 'readwrite')
  tx.objectStore(PHOTO_STORE).put(dataUrl, `${recordId}:${SIGNATURE_SLOT}`)
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
  db.close()
}

export async function getSignature(recordId: string): Promise<string | null> {
  const result = await getPhotos(recordId, [SIGNATURE_SLOT])
  return result[SIGNATURE_SLOT] ?? null
}

export async function getPhotos(recordId: string, itemIds: string[]): Promise<Record<string, string>> {
  const db = await openPhotoDB()
  const tx = db.transaction(PHOTO_STORE, 'readonly')
  const store = tx.objectStore(PHOTO_STORE)
  const result: Record<string, string> = {}
  await Promise.all(itemIds.map((id) => new Promise<void>((resolve) => {
    const req = store.get(`${recordId}:${id}`)
    req.onsuccess = () => { if (req.result) result[id] = req.result; resolve() }
    req.onerror = () => resolve()
  })))
  db.close()
  return result
}

// ── Internal helpers ─────────────────────────────────

/** Parse a raw store payload; null means corrupt/unusable (vs a valid empty array). */
function safeParseInspections(raw: string): InspectionRecord[] | null {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    // Light shape filter — records must at least be objects with a string id
    // so downstream .filter/.map callers can't crash on garbage entries.
    return parsed.filter(
      (r): r is InspectionRecord =>
        typeof r === 'object' && r !== null && typeof (r as { id?: unknown }).id === 'string'
    )
  } catch {
    return null
  }
}

function readAll(): InspectionRecord[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  const records = safeParseInspections(raw)
  if (records !== null) return records
  console.error('[inspections] Primary store corrupt — attempting backup restore.')
  const backup = localStorage.getItem(STORAGE_KEY_BACKUP)
  if (backup) {
    const recovered = safeParseInspections(backup)
    if (recovered !== null) {
      console.warn(`[inspections] Restored ${recovered.length} record(s) from backup.`)
      try { localStorage.setItem(STORAGE_KEY, backup) } catch { /* quota — leave as-is */ }
      return recovered
    }
    console.error('[inspections] Backup also corrupt. Returning empty store.')
  }
  try {
    window.dispatchEvent(new CustomEvent('eqr:storage-corruption', { detail: { key: STORAGE_KEY } }))
  } catch { /* SSR guard */ }
  return []
}

function writeAll(records: InspectionRecord[]): void {
  if (typeof window === 'undefined') return
  const serialized = JSON.stringify(records)
  try {
    // Write backup first so the last known-good copy is never newer than primary.
    // Ignore quota errors on the backup — it is best-effort.
    try { localStorage.setItem(STORAGE_KEY_BACKUP, serialized) } catch { /* non-fatal */ }
    localStorage.setItem(STORAGE_KEY, serialized)
  } catch (e) {
    // Re-throw so submitInspection's caller can surface the failure instead
    // of showing a success screen for a record that was never persisted.
    const isQuota =
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    console.error('Failed to save inspections:', e)
    if (isQuota) {
      throw new Error(
        'Device storage is full. Free up space or export your inspections before continuing.'
      )
    }
    throw e
  }
}

function nextId(): string {
  if (typeof window === 'undefined') return 'INS-0000-0001'
  const year = new Date().getFullYear()
  let stored: { year: number; count: number } = { year, count: 0 }
  try {
    const raw = localStorage.getItem(COUNTER_KEY)
    if (raw) stored = JSON.parse(raw)
  } catch { /* start fresh */ }
  if (stored.year !== year) {
    stored = { year, count: 0 }
  }
  stored.count += 1
  try {
    localStorage.setItem(COUNTER_KEY, JSON.stringify(stored))
  } catch { /* quota — the random suffix below still guarantees uniqueness */ }
  // ALWAYS suffix: the counter read-increment-write is not atomic across
  // tabs; a shared sequential ID would map two inspections onto one server
  // record. Sequential part stays human-readable.
  return `INS-${year}-${String(stored.count).padStart(4, '0')}-${cryptoRandomId().slice(0, 4)}`
}

// ── Change notification (pub/sub) ────────────────────

const listeners = new Set<() => void>()

export function onInspectionChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function notify() {
  listeners.forEach((fn) => fn())
}

// ── Inspector name persistence ───────────────────────

export function getLastInspector(): string {
  if (typeof window === 'undefined') return ''
  try { return localStorage.getItem(INSPECTOR_KEY) || '' } catch { return '' }
}

export function setLastInspector(name: string): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(INSPECTOR_KEY, name) } catch { /* non-fatal */ }
}

// ── Last-used equipment persistence ──────────────────

export function getLastEquipmentId(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LAST_EQUIPMENT_KEY)
    if (!raw) return null
    const id = parseInt(raw, 10)
    return Number.isNaN(id) ? null : id
  } catch { return null }
}

export function setLastEquipmentId(id: number): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LAST_EQUIPMENT_KEY, String(id)) } catch { /* non-fatal */ }
}

// ── Blank checklist builder ──────────────────────────

export function buildBlankItems(checklistType: ChecklistType): InspectionItemResult[] {
  return getAllItems(checklistType).map((item) => ({
    id: item.id,
    label: item.label,
    category: item.category,
    critical: item.critical,
    result: null,
    notes: '',
    photo: null,
    naReasonCode: null,
    naJustification: '',
  }))
}

// ── Public API ───────────────────────────────────────

export function getInspectionsByEquipment(equipmentId: number): InspectionRecord[] {
  return readAll()
    .filter((r) => r.equipmentId === equipmentId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function getAllInspections(): InspectionRecord[] {
  return readAll().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function submitInspection(
  data: {
    equipmentId: number
    inspectorName: string
    shift: Shift
    hourMeterReading: number | null
    checklistType: ChecklistType
    items: InspectionItemResult[]
    /** Operator's touch signature (PNG data URL). Stored in IndexedDB like
     *  photos; the record only carries hasSignature. */
    signatureDataUrl?: string | null
  },
  hooks?: {
    /** Photo/signature persistence is async and best-effort; this fires if
     *  the evidence could NOT be written to IndexedDB so the UI can tell the
     *  operator it didn't save. */
    onPhotoSaveError?: (e: unknown) => void
  }
): InspectionRecord {
  const hasCriticalFail = data.items.some(
    (item) => item.critical && item.result === 'fail'
  )
  const hasAnyFail = data.items.some((item) => item.result === 'fail')
  const criticalNaCount = data.items.filter(
    (item) => item.critical && item.result === 'na'
  ).length

  // Persist the inspection FIRST. writeAll throws on quota — when it does,
  // no side effects (work order, out-of-service flip) have happened yet, so
  // the caller can show a save-error with nothing to unwind.
  const recordId = nextId()

  const record: InspectionRecord = {
    id: recordId,
    equipmentId: data.equipmentId,
    inspectorName: data.inspectorName,
    shift: data.shift,
    hourMeterReading: data.hourMeterReading,
    checklistType: data.checklistType,
    items: data.items.map((i) => ({ ...i, photo: null })),
    result: hasAnyFail ? 'fail' : 'pass',
    hasCriticalFail,
    criticalNaCount,
    workOrderId: null,
    createdAt: new Date().toISOString(),
    syncStatus: 'pending',
    notionPageId: null,
    hasSignature: !!data.signatureDataUrl,
  }

  const all = readAll()
  all.push(record)
  writeAll(all)

  // Record is durable — derived artifacts from here are best-effort.
  let workOrderId: string | null = null
  if (hasAnyFail) {
    try {
      const failedItems = data.items.filter((item) => item.result === 'fail')
      const failSummary = failedItems
        .map((item) => `${item.label}${item.notes ? ': ' + item.notes : ''}`)
        .join('; ')

      const equipment = getEquipmentById(data.equipmentId)
      const eqName = equipment?.name ?? `Equipment #${data.equipmentId}`

      const wo = createWorkOrder({
        equipmentId: data.equipmentId,
        pmType: 'Daily',
        tasks: `[${eqName}] Pre-trip defects: ${failSummary}`,
        assignedTo: null,
      })
      workOrderId = wo.id

      // Auto-set equipment to Out of Service if critical fail
      if (hasCriticalFail) {
        updateEquipmentStatus(data.equipmentId, 'Out of Service')
      }
    } catch (e) {
      // The inspection itself is saved; a missing work order is recoverable
      // from the record's failed items.
      console.error('Failed to create work order for inspection:', e)
    }
  }

  if (workOrderId) {
    record.workOrderId = workOrderId
    try {
      const stored = readAll()
      const idx = stored.findIndex((r) => r.id === recordId)
      if (idx !== -1) {
        stored[idx] = { ...stored[idx], workOrderId }
        writeAll(stored)
      }
    } catch (e) {
      // Link write failed — inspection and work order both exist independently.
      console.error('Failed to link work order to inspection:', e)
    }
  }

  // Save inspector name and equipment for next time
  setLastInspector(data.inspectorName)
  setLastEquipmentId(data.equipmentId)

  notify()

  // Save photos + signature to IndexedDB (async; failures surface via the hook)
  savePhotos(recordId, data.items).catch((e) => {
    console.error('Failed to save photos to IndexedDB:', e)
    hooks?.onPhotoSaveError?.(e)
  })
  if (data.signatureDataUrl) {
    saveSignature(recordId, data.signatureDataUrl).catch((e) => {
      console.error('Failed to save signature to IndexedDB:', e)
      hooks?.onPhotoSaveError?.(e)
    })
  }

  // Return record with original photos still in memory for result screen
  return { ...record, items: data.items }
}

// ── EHS notify queue (offline resilience) ─────────────
// The notify email is fire-once from the result screen; if the device is
// offline or the server hiccups, the payload queues here and flushes on the
// 'online' event / next app load — mirroring the safety-sync listener
// pattern. Without this, offline inspections never reached the EHS inbox.

const NOTIFY_QUEUE_KEY = 'eqr-notify-queue'
const NOTIFY_QUEUE_CAP = 50
const NOTIFY_MAX_ATTEMPTS = 3

interface QueuedNotify {
  payload: unknown
  attempts: number
  queuedAt: string
}

function readNotifyQueue(): QueuedNotify[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(NOTIFY_QUEUE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeNotifyQueue(queue: QueuedNotify[]): boolean {
  if (typeof window === 'undefined') return false
  try {
    localStorage.setItem(NOTIFY_QUEUE_KEY, JSON.stringify(queue))
    return true
  } catch (e) {
    console.error('Failed to persist notify queue:', e)
    return false
  }
}

/** Returns true when the payload is durably queued. */
export function queueNotifyPayload(payload: unknown): boolean {
  const queue = readNotifyQueue()
  queue.push({ payload, attempts: 0, queuedAt: new Date().toISOString() })
  while (queue.length > NOTIFY_QUEUE_CAP) queue.shift()
  return writeNotifyQueue(queue)
}

export function getNotifyQueueLength(): number {
  return readNotifyQueue().length
}

let notifyFlushing = false

export async function flushNotifyQueue(): Promise<void> {
  if (typeof window === 'undefined' || notifyFlushing) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  const queue = readNotifyQueue()
  if (queue.length === 0) return
  notifyFlushing = true
  try {
    const remaining: QueuedNotify[] = []
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i]
      try {
        const res = await fetch('/api/inspections/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload),
        })

        // 401 = signed out. Auth is a whole-session state, so every remaining
        // item would 401 too. Keep the entire queue INTACT without burning an
        // attempt and stop — a later flush (after sign-in) delivers it. This
        // is why a queued inspection e-mail survives a signed-out session
        // instead of being silently destroyed after three page loads.
        if (res.status === 401) {
          remaining.push(...queue.slice(i))
          break
        }

        if (res.ok) {
          // A 2xx alone is NOT proof of delivery: the route returns 200 with
          // {emailed:false, outcome:'failed'} when the e-mail provider itself
          // rejects/times out. Only dequeue when the send actually succeeded
          // (emailed) or can never succeed here (no provider configured);
          // a provider-side failure is transient and worth retrying.
          let delivered = true
          try {
            const body = (await res.json()) as { emailed?: boolean; reason?: string }
            if (body.emailed === false && body.reason !== 'not-configured') delivered = false
          } catch {
            // No/!JSON body on a 2xx — treat as delivered rather than loop.
          }
          if (delivered) continue
          item.attempts += 1
          if (item.attempts < NOTIFY_MAX_ATTEMPTS) remaining.push(item)
          continue
        }

        // 400 → permanently invalid payload; drop it rather than poison the
        // queue with something that can never succeed.
        if (res.status === 400) continue

        // 429 / 5xx → retryable.
        item.attempts += 1
        if (item.attempts < NOTIFY_MAX_ATTEMPTS) remaining.push(item)
      } catch {
        // Network dropped mid-flush — keep this item and everything after it
        // untouched for the next 'online' event.
        item.attempts += 1
        if (item.attempts < NOTIFY_MAX_ATTEMPTS) remaining.push(item)
        remaining.push(...queue.slice(i + 1))
        break
      }
    }
    writeNotifyQueue(remaining)
  } finally {
    notifyFlushing = false
  }
}

/**
 * Wire background flushing: once at load, again on reconnect, and again each
 * time the tab returns to the foreground. The foreground trigger is what
 * delivers an inspection e-mail that queued while the user was signed out —
 * signing in and returning to the tab flushes it, no full reload required.
 */
export function installNotifyListeners(): () => void {
  if (typeof window === 'undefined') return () => {}
  void flushNotifyQueue()
  const onOnline = () => { void flushNotifyQueue() }
  const onVisible = () => { if (document.visibilityState === 'visible') void flushNotifyQueue() }
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
  }
}

// ── Export helpers ────────────────────────────────────

function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

export function exportInspectionsToCsv(records: InspectionRecord[]): string {
  const headers = [
    'Inspection_ID', 'Equipment_ID', 'Inspector', 'Signed', 'Shift',
    'Hour_Meter', 'Checklist_Type', 'Result', 'Critical_Fail',
    'Critical_NA', 'Failed_Items', 'NA_Critical_Items',
    'Work_Order_ID', 'Date', 'Sync_Status',
  ]
  const rows = records.map((r) => {
    const failedItems = r.items
      .filter((i) => i.result === 'fail')
      .map((i) => i.label)
      .join('; ')
    const naCriticalItems = r.items
      .filter((i) => i.critical && i.result === 'na')
      .map((i) => {
        const reason = i.naReasonCode || 'no reason'
        const detail = i.naJustification ? ` — ${i.naJustification}` : ''
        return `${i.label} (${reason}${detail})`
      })
      .join('; ')
    const critNaCount = r.criticalNaCount ?? r.items.filter((i) => i.critical && i.result === 'na').length
    return [
      csvCell(r.id), csvCell(r.equipmentId), csvCell(r.inspectorName),
      csvCell(r.hasSignature ? 'YES' : 'NO'), csvCell(r.shift),
      csvCell(r.hourMeterReading), csvCell(r.checklistType), csvCell(r.result),
      csvCell(r.hasCriticalFail ? 'YES' : 'NO'),
      csvCell(critNaCount > 0 ? `YES (${critNaCount})` : 'NO'),
      csvCell(failedItems), csvCell(naCriticalItems),
      csvCell(r.workOrderId), csvCell(r.createdAt), csvCell(r.syncStatus),
    ].join(',')
  })
  return [headers.join(','), ...rows].join('\n')
}

// ── Notion sync stub ─────────────────────────────────

export async function syncToNotion(record: InspectionRecord): Promise<boolean> {
  // TODO: Implement when Notion API key is available
  // POST to /api/sync-inspection with the record
  // On success, update record.syncStatus = 'synced' and record.notionPageId
  // On failure, update record.syncStatus = 'failed'
  void record
  return false
}
