import { describe, it, expect, vi, beforeEach } from 'vitest'

const storage: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => { storage[k] = v },
  removeItem: (k: string) => { delete storage[k] },
  clear: () => { for (const k in storage) delete storage[k] },
  get length() { return Object.keys(storage).length },
  key: () => null as string | null,
})
vi.stubGlobal('window', globalThis)

beforeEach(() => {
  for (const k in storage) delete storage[k]
})

import {
  getLastInspector,
  setLastInspector,
  getLastEquipmentId,
  setLastEquipmentId,
  buildBlankItems,
  getInspectionsByEquipment,
  getAllInspections,
  submitInspection,
  onInspectionChange,
} from '@/lib/inspections'

describe('inspector name persistence', () => {
  it('returns empty string when no inspector stored', () => {
    expect(getLastInspector()).toBe('')
  })

  it('stores and retrieves inspector name', () => {
    setLastInspector('Jane Doe')
    expect(getLastInspector()).toBe('Jane Doe')
  })
})

describe('last equipment ID persistence', () => {
  it('returns null when no equipment stored', () => {
    expect(getLastEquipmentId()).toBeNull()
  })

  it('stores and retrieves equipment ID', () => {
    setLastEquipmentId(42)
    expect(getLastEquipmentId()).toBe(42)
  })

  it('returns null for corrupt value', () => {
    storage['eqr-last-equipment'] = 'not-a-number'
    expect(getLastEquipmentId()).toBeNull()
  })
})

describe('buildBlankItems', () => {
  it('returns array of items with null results', () => {
    const items = buildBlankItems('electric-forklift')
    expect(items.length).toBeGreaterThan(0)
    expect(items.every(i => i.result === null)).toBe(true)
    expect(items.every(i => i.notes === '')).toBe(true)
    expect(items.every(i => i.photo === null)).toBe(true)
  })

  it('includes critical flags', () => {
    const items = buildBlankItems('electric-forklift')
    const hasCritical = items.some(i => i.critical === true)
    expect(hasCritical).toBe(true)
  })
})

describe('submitInspection', () => {
  const passItems = [
    { id: 'brakes', label: 'Brakes', category: 'safety', critical: true, result: 'pass' as const, notes: '', photo: null },
    { id: 'lights', label: 'Lights', category: 'safety', critical: false, result: 'pass' as const, notes: '', photo: null },
  ]

  const failItems = [
    { id: 'brakes', label: 'Brakes', category: 'safety', critical: true, result: 'fail' as const, notes: 'Worn pads', photo: null },
    { id: 'lights', label: 'Lights', category: 'safety', critical: false, result: 'pass' as const, notes: '', photo: null },
  ]

  it('creates inspection with pass result', () => {
    const record = submitInspection({
      equipmentId: 101,
      inspectorName: 'Alice',
      shift: 'Day',
      hourMeterReading: 1500,
      checklistType: 'electric-forklift',
      items: passItems,
    })
    expect(record.id).toMatch(/^INS-/)
    expect(record.result).toBe('pass')
    expect(record.hasCriticalFail).toBe(false)
    expect(record.workOrderId).toBeNull()
  })

  it('creates inspection with fail result and work order', () => {
    const record = submitInspection({
      equipmentId: 101,
      inspectorName: 'Alice',
      shift: 'Day',
      hourMeterReading: 1500,
      checklistType: 'electric-forklift',
      items: failItems,
    })
    expect(record.result).toBe('fail')
    expect(record.hasCriticalFail).toBe(true)
    expect(record.workOrderId).toMatch(/^WO-/)
  })

  it('persists last inspector and equipment after submit', () => {
    submitInspection({
      equipmentId: 202,
      inspectorName: 'Bob',
      shift: 'Night',
      hourMeterReading: null,
      checklistType: 'electric-forklift',
      items: passItems,
    })
    expect(getLastInspector()).toBe('Bob')
    expect(getLastEquipmentId()).toBe(202)
  })

  it('increments ID counter across submissions', () => {
    const r1 = submitInspection({
      equipmentId: 101,
      inspectorName: 'Alice',
      shift: 'Day',
      hourMeterReading: null,
      checklistType: 'electric-forklift',
      items: passItems,
    })
    const r2 = submitInspection({
      equipmentId: 101,
      inspectorName: 'Alice',
      shift: 'Day',
      hourMeterReading: null,
      checklistType: 'electric-forklift',
      items: passItems,
    })
    expect(r1.id).not.toBe(r2.id)
  })
})

describe('getAllInspections', () => {
  it('returns empty array when no records', () => {
    expect(getAllInspections()).toEqual([])
  })

  it('returns records sorted by date descending', () => {
    submitInspection({
      equipmentId: 101,
      inspectorName: 'Alice',
      shift: 'Day',
      hourMeterReading: null,
      checklistType: 'electric-forklift',
      items: [{ id: 'a', label: 'A', category: 'x', critical: false, result: 'pass' as const, notes: '', photo: null }],
    })
    submitInspection({
      equipmentId: 102,
      inspectorName: 'Bob',
      shift: 'Night',
      hourMeterReading: null,
      checklistType: 'electric-forklift',
      items: [{ id: 'a', label: 'A', category: 'x', critical: false, result: 'pass' as const, notes: '', photo: null }],
    })
    const all = getAllInspections()
    expect(all.length).toBe(2)
    expect(new Date(all[0].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(all[1].createdAt).getTime())
  })
})

describe('getInspectionsByEquipment', () => {
  it('filters by equipment ID', () => {
    submitInspection({
      equipmentId: 101,
      inspectorName: 'Alice',
      shift: 'Day',
      hourMeterReading: null,
      checklistType: 'electric-forklift',
      items: [{ id: 'a', label: 'A', category: 'x', critical: false, result: 'pass' as const, notes: '', photo: null }],
    })
    submitInspection({
      equipmentId: 202,
      inspectorName: 'Bob',
      shift: 'Night',
      hourMeterReading: null,
      checklistType: 'electric-forklift',
      items: [{ id: 'a', label: 'A', category: 'x', critical: false, result: 'pass' as const, notes: '', photo: null }],
    })
    const eq101 = getInspectionsByEquipment(101)
    expect(eq101.length).toBe(1)
    expect(eq101[0].equipmentId).toBe(101)
  })
})

describe('onInspectionChange', () => {
  it('notifies listeners on submit', () => {
    const fn = vi.fn()
    const unsub = onInspectionChange(fn)
    submitInspection({
      equipmentId: 101,
      inspectorName: 'Alice',
      shift: 'Day',
      hourMeterReading: null,
      checklistType: 'electric-forklift',
      items: [{ id: 'a', label: 'A', category: 'x', critical: false, result: 'pass' as const, notes: '', photo: null }],
    })
    expect(fn).toHaveBeenCalled()
    unsub()
  })

  it('does not notify after unsubscribe', () => {
    const fn = vi.fn()
    const unsub = onInspectionChange(fn)
    unsub()
    submitInspection({
      equipmentId: 101,
      inspectorName: 'Alice',
      shift: 'Day',
      hourMeterReading: null,
      checklistType: 'electric-forklift',
      items: [{ id: 'a', label: 'A', category: 'x', critical: false, result: 'pass' as const, notes: '', photo: null }],
    })
    expect(fn).not.toHaveBeenCalled()
  })
})
