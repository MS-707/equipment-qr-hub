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

const STORAGE_KEY = 'eqr-inspections'
const COUNTER_KEY = 'eqr-ins-counter'
const INSPECTOR_KEY = 'eqr-last-inspector'

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
  db.close()
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

function readAll(): InspectionRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeAll(records: InspectionRecord[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch (e) {
    console.error('Failed to save inspections:', e)
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
  localStorage.setItem(COUNTER_KEY, JSON.stringify(stored))
  return `INS-${year}-${String(stored.count).padStart(4, '0')}`
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
  return localStorage.getItem(INSPECTOR_KEY) || ''
}

export function setLastInspector(name: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(INSPECTOR_KEY, name)
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

export function submitInspection(data: {
  equipmentId: number
  inspectorName: string
  shift: Shift
  hourMeterReading: number | null
  checklistType: ChecklistType
  items: InspectionItemResult[]
}): InspectionRecord {
  const hasCriticalFail = data.items.some(
    (item) => item.critical && item.result === 'fail'
  )
  const hasAnyFail = data.items.some((item) => item.result === 'fail')

  let workOrderId: string | null = null

  // Auto-create work order if any item failed
  if (hasAnyFail) {
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
  }

  // Save inspector name for next time
  setLastInspector(data.inspectorName)

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
    workOrderId,
    createdAt: new Date().toISOString(),
    syncStatus: 'pending',
    notionPageId: null,
  }

  const all = readAll()
  all.push(record)
  writeAll(all)
  notify()

  // Save photos to IndexedDB (fire-and-forget)
  savePhotos(recordId, data.items).catch((e) =>
    console.error('Failed to save photos to IndexedDB:', e)
  )

  // Return record with original photos still in memory for result screen
  return { ...record, items: data.items }
}

// ── Export helpers ────────────────────────────────────

export function exportInspectionsToCsv(records: InspectionRecord[]): string {
  const headers = [
    'Inspection_ID', 'Equipment_ID', 'Inspector', 'Shift',
    'Hour_Meter', 'Checklist_Type', 'Result', 'Critical_Fail',
    'Failed_Items', 'Work_Order_ID', 'Date', 'Sync_Status',
  ]
  const rows = records.map((r) => {
    const failedItems = r.items
      .filter((i) => i.result === 'fail')
      .map((i) => i.label)
      .join('; ')
    return [
      r.id, r.equipmentId, `"${r.inspectorName.replace(/"/g, '""')}"`, r.shift,
      r.hourMeterReading ?? '', r.checklistType, r.result,
      r.hasCriticalFail ? 'YES' : 'NO',
      `"${failedItems.replace(/"/g, '""')}"`, r.workOrderId ?? '', r.createdAt, r.syncStatus,
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
  console.log('[Notion sync stub] Would sync inspection:', record.id)
  return false
}
