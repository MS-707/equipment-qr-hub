/**
 * Work Order data access layer — THE SWAP POINT.
 *
 * Currently backed by localStorage. To migrate to Notion/Supabase,
 * replace the internal read/write helpers and keep the public API unchanged.
 * Components never touch storage directly — they only call these functions.
 */

import { WorkOrder, PmType, WorkOrderStatus } from '@/lib/types'

const STORAGE_KEY = 'eqr-work-orders'
const COUNTER_KEY = 'eqr-wo-counter'

// ── Internal helpers ─────────────────────────────────────

function readAll(): WorkOrder[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeAll(orders: WorkOrder[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
}

function nextNumber(): string {
  if (typeof window === 'undefined') return 'WO-0000-0001'
  const year = new Date().getFullYear()
  let stored: { year: number; count: number } = { year, count: 0 }
  try {
    const raw = localStorage.getItem(COUNTER_KEY)
    if (raw) stored = JSON.parse(raw)
  } catch { /* start fresh */ }
  // Reset counter when the year rolls over
  if (stored.year !== year) {
    stored = { year, count: 0 }
  }
  stored.count += 1
  localStorage.setItem(COUNTER_KEY, JSON.stringify(stored))
  return `WO-${year}-${String(stored.count).padStart(4, '0')}`
}

// ── Change notification (pub/sub) ────────────────────────

const listeners = new Set<() => void>()

export function onWorkOrderChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function notify() {
  listeners.forEach((fn) => fn())
}

// ── Public API ───────────────────────────────────────────

export function getAllWorkOrders(): WorkOrder[] {
  return readAll().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function getWorkOrderById(id: string): WorkOrder | undefined {
  return readAll().find((wo) => wo.id === id)
}

export function getWorkOrdersByEquipment(equipmentId: number): WorkOrder[] {
  return readAll()
    .filter((wo) => wo.equipmentId === equipmentId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function getWorkOrdersByStatus(status: WorkOrderStatus): WorkOrder[] {
  return readAll()
    .filter((wo) => wo.status === status)
    .sort((a, b) => {
      // Sort by due date ascending (soonest first), nulls last
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return 0
    })
}

export function getOverdueWorkOrders(): WorkOrder[] {
  const today = new Date().toISOString().split('T')[0]
  return readAll().filter(
    (wo) => wo.status !== 'Complete' && wo.dueDate !== null && wo.dueDate < today
  )
}

export function getOpenCount(): number {
  return readAll().filter((wo) => wo.status !== 'Complete').length
}

export function createWorkOrder(
  data: Pick<WorkOrder, 'equipmentId' | 'pmType' | 'tasks'> & {
    dueDate?: string | null
    assignedTo?: string | null
  }
): WorkOrder {
  const wo: WorkOrder = {
    id: nextNumber(),
    equipmentId: data.equipmentId,
    pmType: data.pmType,
    tasks: data.tasks,
    status: 'Not Started',
    dueDate: data.dueDate ?? null,
    completedDate: null,
    assignedTo: data.assignedTo ?? null,
    completionNotes: '',
    linearIssueId: null,
    gmailDraftId: null,
    createdAt: new Date().toISOString(),
  }

  const all = readAll()
  all.push(wo)
  writeAll(all)
  notify()
  return wo
}

export function updateWorkOrder(
  id: string,
  updates: Partial<Omit<WorkOrder, 'id' | 'createdAt'>>
): WorkOrder | undefined {
  const all = readAll()
  const idx = all.findIndex((wo) => wo.id === id)
  if (idx === -1) return undefined

  // Auto-set completedDate when status changes to Complete
  if (updates.status === 'Complete' && !updates.completedDate) {
    updates.completedDate = new Date().toISOString().split('T')[0]
  }
  // Clear completedDate if moving back from Complete
  if (updates.status && updates.status !== 'Complete') {
    updates.completedDate = null
  }

  all[idx] = { ...all[idx], ...updates }
  writeAll(all)
  notify()
  return all[idx]
}

export function deleteWorkOrder(id: string): boolean {
  const all = readAll()
  const filtered = all.filter((wo) => wo.id !== id)
  if (filtered.length === all.length) return false
  writeAll(filtered)
  notify()
  return true
}

export function isOverdue(wo: WorkOrder): boolean {
  if (wo.status === 'Complete' || !wo.dueDate) return false
  return wo.dueDate < new Date().toISOString().split('T')[0]
}

// ── Export helpers ────────────────────────────────────────

export function exportToCsv(orders: WorkOrder[]): string {
  const headers = [
    'WO_Number', 'Equipment_ID', 'PM_Type', 'Tasks', 'Status',
    'Due_Date', 'Completed_Date', 'Assigned_To', 'Completion_Notes',
    'Linear_Issue_ID', 'Gmail_Draft_ID', 'Created_At',
  ]
  const rows = orders.map((wo) =>
    [
      wo.id, wo.equipmentId, wo.pmType,
      `"${wo.tasks.replace(/"/g, '""')}"`,
      wo.status, wo.dueDate || '', wo.completedDate || '',
      `"${(wo.assignedTo || '').replace(/"/g, '""')}"`,
      `"${wo.completionNotes.replace(/"/g, '""')}"`,
      wo.linearIssueId || '', wo.gmailDraftId || '', wo.createdAt,
    ].join(',')
  )
  return [headers.join(','), ...rows].join('\n')
}

// ── PM type helper ───────────────────────────────────────

export function getPmField(
  equipment: { pmDaily: string; pmWeekly: string; pmMonthly: string; pmQuarterly: string; pmSemiAnnual: string; pmAnnual: string },
  pmType: PmType
): string {
  const map: Record<PmType, string> = {
    'Daily': equipment.pmDaily,
    'Weekly': equipment.pmWeekly,
    'Monthly': equipment.pmMonthly,
    'Quarterly': equipment.pmQuarterly,
    'Semi-Annual': equipment.pmSemiAnnual,
    'Annual': equipment.pmAnnual,
  }
  return map[pmType] || ''
}
