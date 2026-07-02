import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Inspection store hardening (queue item A2): quota failures must throw to
 * the caller (never a success screen for an unsaved record), corrupt primary
 * storage must restore from backup, and ID minting must never repeat on a
 * full device.
 */

let store: Record<string, string> = {}
let throwQuotaOn: Set<string> = new Set()
const dispatched: Event[] = []

vi.stubGlobal('window', {
  ...globalThis,
  addEventListener: vi.fn(),
  dispatchEvent: vi.fn((e: Event) => { dispatched.push(e); return true }),
})
vi.stubGlobal('localStorage', {
  getItem: vi.fn((k: string) => store[k] ?? null),
  setItem: vi.fn((k: string, v: string) => {
    if (throwQuotaOn.has(k)) throw new DOMException('quota', 'QuotaExceededError')
    store[k] = v
  }),
  removeItem: vi.fn((k: string) => { delete store[k] }),
  get length() { return Object.keys(store).length },
  key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
})
vi.stubGlobal('navigator', { onLine: true })

vi.mock('@/lib/work-orders', () => ({
  createWorkOrder: vi.fn(() => ({ id: 'WO-TEST-0001' })),
}))
vi.mock('@/lib/equipment', () => ({
  updateEquipmentStatus: vi.fn(),
  getEquipmentById: vi.fn(() => ({ name: 'Test Forklift' })),
}))

import { submitInspection, getAllInspections } from '@/lib/inspections'
import { createWorkOrder, } from '@/lib/work-orders'
import type { InspectionItemResult } from '@/lib/types'

const PRIMARY = 'eqr-inspections'
const BACKUP = 'eqr-inspections-backup'

function items(result: 'pass' | 'fail' = 'pass'): InspectionItemResult[] {
  return [
    { id: 'it-1', label: 'Brakes', category: 'Checks', critical: true, result, notes: result === 'fail' ? 'soft pedal' : '', photo: null },
    { id: 'it-2', label: 'Horn', category: 'Checks', critical: false, result: 'pass', notes: '', photo: null },
  ]
}

function submit(result: 'pass' | 'fail' = 'pass') {
  return submitInspection({
    equipmentId: 17,
    inspectorName: 'Dana',
    shift: 'Day',
    hourMeterReading: 100,
    checklistType: 'electric-forklift',
    items: items(result),
  })
}

beforeEach(() => {
  store = {}
  throwQuotaOn = new Set()
  dispatched.length = 0
  vi.mocked(createWorkOrder).mockClear()
})

describe('submitInspection persistence', () => {
  it('persists the record and mirrors it to the backup key', () => {
    const rec = submit()
    expect(rec.id).toMatch(/^INS-\d{4}-\d{4}$/)
    expect(JSON.parse(store[PRIMARY])).toHaveLength(1)
    expect(store[BACKUP]).toBe(store[PRIMARY])
  })

  it('throws a human-readable error on quota and creates NO side effects', () => {
    throwQuotaOn = new Set([PRIMARY])
    expect(() => submit('fail')).toThrow(/storage is full/i)
    // Ordering guarantee: record write comes first, so the work order and
    // out-of-service flip never happened for an unsaved inspection.
    expect(createWorkOrder).not.toHaveBeenCalled()
    expect(store[PRIMARY]).toBeUndefined()
  })

  it('still links the work order on failing inspections (happy path)', () => {
    const rec = submit('fail')
    expect(createWorkOrder).toHaveBeenCalledOnce()
    expect(rec.workOrderId).toBe('WO-TEST-0001')
    const persisted = JSON.parse(store[PRIMARY])
    expect(persisted[0].workOrderId).toBe('WO-TEST-0001')
  })

  it('keeps the inspection when work-order creation throws', () => {
    vi.mocked(createWorkOrder).mockImplementationOnce(() => { throw new Error('WO store full') })
    const rec = submit('fail')
    expect(rec.workOrderId).toBeNull()
    expect(JSON.parse(store[PRIMARY])).toHaveLength(1)
  })
})

describe('readAll corruption recovery', () => {
  it('restores from backup when primary is corrupt JSON', () => {
    const good = submit()
    store[PRIMARY] = '{not json!!!'
    const all = getAllInspections()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(good.id)
    // Primary healed from backup
    expect(store[PRIMARY]).toBe(store[BACKUP])
  })

  it('treats non-array JSON as corrupt (no crash in filter callers)', () => {
    submit()
    store[PRIMARY] = '{"records":"nope"}'
    const all = getAllInspections()
    expect(all).toHaveLength(1) // from backup
  })

  it('filters garbage entries instead of crashing', () => {
    submit()
    const arr = JSON.parse(store[PRIMARY])
    arr.push('garbage-string', { noId: true }, null)
    store[PRIMARY] = JSON.stringify(arr)
    store[BACKUP] = store[PRIMARY]
    const all = getAllInspections()
    expect(all).toHaveLength(1)
  })

  it('dispatches eqr:storage-corruption when primary AND backup are corrupt', () => {
    store[PRIMARY] = '{corrupt'
    store[BACKUP] = '{also corrupt'
    const all = getAllInspections()
    expect(all).toHaveLength(0)
    const evt = dispatched.find((e) => e.type === 'eqr:storage-corruption') as CustomEvent
    expect(evt).toBeDefined()
    expect(evt.detail.key).toBe(PRIMARY)
  })

  it('does not fire corruption event for a legitimately empty store', () => {
    const all = getAllInspections()
    expect(all).toHaveLength(0)
    expect(dispatched.find((e) => e.type === 'eqr:storage-corruption')).toBeUndefined()
  })
})

describe('nextId under quota pressure', () => {
  it('appends a collision-proof suffix when the counter cannot persist', () => {
    throwQuotaOn = new Set(['eqr-ins-counter'])
    const a = submit()
    const b = submit()
    expect(a.id).toMatch(/^INS-\d{4}-\d{4}-[a-z0-9]{4}$/i)
    expect(b.id).toMatch(/^INS-\d{4}-\d{4}-[a-z0-9]{4}$/i)
    expect(a.id).not.toBe(b.id)
  })
})
