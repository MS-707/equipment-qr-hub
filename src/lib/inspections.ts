/**
 * Inspection data access layer — THE SWAP POINT.
 *
 * Currently backed by localStorage. To migrate to Notion,
 * replace the internal read/write helpers and keep the public API unchanged.
 */

import { InspectionRecord, InspectionItemResult, ChecklistType, Shift } from '@/lib/types'
import { getAllItems } from '@/data/inspection-checklists'
import { createWorkOrder } from '@/lib/work-orders'
import { updateEquipmentStatus } from '@/lib/equipment'

const STORAGE_KEY = 'eqr-inspections'
const COUNTER_KEY = 'eqr-ins-counter'
const INSPECTOR_KEY = 'eqr-last-inspector'

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
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

    const wo = createWorkOrder({
      equipmentId: data.equipmentId,
      pmType: 'Daily',
      tasks: `Pre-trip inspection defects: ${failSummary}`,
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

  const record: InspectionRecord = {
    id: nextId(),
    equipmentId: data.equipmentId,
    inspectorName: data.inspectorName,
    shift: data.shift,
    hourMeterReading: data.hourMeterReading,
    checklistType: data.checklistType,
    items: data.items,
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
  return record
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
      r.id, r.equipmentId, `"${r.inspectorName}"`, r.shift,
      r.hourMeterReading ?? '', r.checklistType, r.result,
      r.hasCriticalFail ? 'YES' : 'NO',
      `"${failedItems}"`, r.workOrderId ?? '', r.createdAt, r.syncStatus,
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
