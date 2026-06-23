import { describe, it, expect, vi, beforeEach } from 'vitest'

const storage: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => { storage[k] = v },
  removeItem: (k: string) => { delete storage[k] },
  clear: () => { for (const k in storage) delete storage[k] },
  get length() { return Object.keys(storage).length },
  key: (_i: number) => null as string | null,
})
vi.stubGlobal('window', globalThis)

beforeEach(() => {
  for (const k in storage) delete storage[k]
})

import {
  getAllWorkOrders,
  getWorkOrderById,
  createWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
  getWorkOrdersByStatus,
  getWorkOrdersByEquipment,
  getOpenCount,
  isOverdue,
  exportToCsv,
  getPmField,
  onWorkOrderChange,
} from '@/lib/work-orders'

describe('work-orders', () => {
  it('returns empty list initially', () => {
    expect(getAllWorkOrders()).toEqual([])
  })

  it('creates a work order with auto-generated ID', () => {
    const wo = createWorkOrder({
      equipmentId: 101,
      pmType: 'Daily',
      tasks: 'Check oil level',
    })
    expect(wo.id).toMatch(/^WO-\d{4}-\d{4}$/)
    expect(wo.status).toBe('Not Started')
    expect(wo.equipmentId).toBe(101)
    expect(wo.tasks).toBe('Check oil level')
  })

  it('retrieves work order by ID', () => {
    const wo = createWorkOrder({ equipmentId: 101, pmType: 'Daily', tasks: 'Task A' })
    const found = getWorkOrderById(wo.id)
    expect(found).toBeDefined()
    expect(found!.id).toBe(wo.id)
  })

  it('returns undefined for non-existent ID', () => {
    expect(getWorkOrderById('WO-0000-9999')).toBeUndefined()
  })

  it('updates a work order', () => {
    const wo = createWorkOrder({ equipmentId: 101, pmType: 'Daily', tasks: 'Task A' })
    const updated = updateWorkOrder(wo.id, { status: 'In Progress' })
    expect(updated).toBeDefined()
    expect(updated!.status).toBe('In Progress')
  })

  it('auto-sets completedDate when completing', () => {
    const wo = createWorkOrder({ equipmentId: 101, pmType: 'Daily', tasks: 'Task A' })
    const updated = updateWorkOrder(wo.id, { status: 'Complete' })
    expect(updated!.completedDate).toBeTruthy()
  })

  it('clears completedDate when moving back from Complete', () => {
    const wo = createWorkOrder({ equipmentId: 101, pmType: 'Daily', tasks: 'Task A' })
    updateWorkOrder(wo.id, { status: 'Complete' })
    const updated = updateWorkOrder(wo.id, { status: 'In Progress' })
    expect(updated!.completedDate).toBeNull()
  })

  it('returns undefined for updating non-existent ID', () => {
    expect(updateWorkOrder('WO-0000-9999', { status: 'Complete' })).toBeUndefined()
  })

  it('deletes a work order', () => {
    const wo = createWorkOrder({ equipmentId: 101, pmType: 'Daily', tasks: 'Task A' })
    expect(deleteWorkOrder(wo.id)).toBe(true)
    expect(getWorkOrderById(wo.id)).toBeUndefined()
  })

  it('returns false when deleting non-existent', () => {
    expect(deleteWorkOrder('WO-0000-9999')).toBe(false)
  })

  it('filters by status', () => {
    createWorkOrder({ equipmentId: 101, pmType: 'Daily', tasks: 'A' })
    const wo2 = createWorkOrder({ equipmentId: 101, pmType: 'Weekly', tasks: 'B' })
    updateWorkOrder(wo2.id, { status: 'Complete' })
    expect(getWorkOrdersByStatus('Not Started').length).toBe(1)
    expect(getWorkOrdersByStatus('Complete').length).toBe(1)
  })

  it('filters by equipment', () => {
    createWorkOrder({ equipmentId: 101, pmType: 'Daily', tasks: 'A' })
    createWorkOrder({ equipmentId: 202, pmType: 'Daily', tasks: 'B' })
    expect(getWorkOrdersByEquipment(101).length).toBe(1)
    expect(getWorkOrdersByEquipment(999).length).toBe(0)
  })

  it('counts open work orders', () => {
    createWorkOrder({ equipmentId: 101, pmType: 'Daily', tasks: 'A' })
    const wo2 = createWorkOrder({ equipmentId: 101, pmType: 'Weekly', tasks: 'B' })
    updateWorkOrder(wo2.id, { status: 'Complete' })
    expect(getOpenCount()).toBe(1)
  })

  it('detects overdue work orders', () => {
    const wo = createWorkOrder({ equipmentId: 101, pmType: 'Daily', tasks: 'A', dueDate: '2020-01-01' })
    expect(isOverdue(wo)).toBe(true)
  })

  it('not overdue if complete', () => {
    const wo = createWorkOrder({ equipmentId: 101, pmType: 'Daily', tasks: 'A', dueDate: '2020-01-01' })
    const updated = updateWorkOrder(wo.id, { status: 'Complete' })!
    expect(isOverdue(updated)).toBe(false)
  })

  it('not overdue if no due date', () => {
    const wo = createWorkOrder({ equipmentId: 101, pmType: 'Daily', tasks: 'A' })
    expect(isOverdue(wo)).toBe(false)
  })

  it('notifies listeners on change', () => {
    const listener = vi.fn()
    const unsub = onWorkOrderChange(listener)
    createWorkOrder({ equipmentId: 101, pmType: 'Daily', tasks: 'A' })
    expect(listener).toHaveBeenCalled()
    unsub()
    createWorkOrder({ equipmentId: 101, pmType: 'Daily', tasks: 'B' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('exports to CSV with correct headers', () => {
    const wo = createWorkOrder({ equipmentId: 101, pmType: 'Daily', tasks: 'Check oil' })
    const csv = exportToCsv([wo])
    const lines = csv.split('\n')
    expect(lines[0]).toContain('WO_Number')
    expect(lines[0]).toContain('PM_Type')
    expect(lines[1]).toContain(wo.id)
    expect(lines[1]).toContain('Daily')
  })

  it('CSV escapes formula injection characters', () => {
    const wo = createWorkOrder({ equipmentId: 101, pmType: 'Daily', tasks: '=SUM(A1)' })
    const csv = exportToCsv([wo])
    expect(csv).toContain("\"'=SUM(A1)\"")
  })

  it('getPmField returns the correct PM string', () => {
    const equip = {
      pmDaily: 'Check oil',
      pmWeekly: 'Grease fittings',
      pmMonthly: 'Change filter',
      pmQuarterly: 'Full service',
      pmSemiAnnual: 'Overhaul',
      pmAnnual: 'Recertify',
    }
    expect(getPmField(equip, 'Daily')).toBe('Check oil')
    expect(getPmField(equip, 'Annual')).toBe('Recertify')
  })

  it('increments counter across multiple creates', () => {
    const wo1 = createWorkOrder({ equipmentId: 101, pmType: 'Daily', tasks: 'A' })
    const wo2 = createWorkOrder({ equipmentId: 101, pmType: 'Daily', tasks: 'B' })
    const num1 = parseInt(wo1.id.split('-').pop()!)
    const num2 = parseInt(wo2.id.split('-').pop()!)
    expect(num2).toBe(num1 + 1)
  })
})
