import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Schema-drift quarantine (queue item A3): a record that fails validation
 * must NEVER be silently deleted. Reads park it in the quarantine key; the
 * write-back of the filtered array is then safe. Unknown audit actions no
 * longer invalidate records at all.
 */

let store: Record<string, string> = {}
const dispatched: Event[] = []

vi.stubGlobal('window', {
  ...globalThis,
  addEventListener: vi.fn(),
  dispatchEvent: vi.fn((e: Event) => { dispatched.push(e); return true }),
})
vi.stubGlobal('localStorage', {
  getItem: vi.fn((k: string) => store[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { store[k] = v }),
  removeItem: vi.fn((k: string) => { delete store[k] }),
  get length() { return Object.keys(store).length },
  key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
})
vi.stubGlobal('navigator', { onLine: true })

vi.mock('@/lib/identity', () => ({
  getCurrentIdentity: vi.fn(() => ({ name: 'Test User', email: 'test@example.com', image: null, verifiedAt: '2026-06-23T00:00:00Z' })),
}))

import { partitionSafetyRecords } from '@/lib/schemas'
import { getAllSafetyRecords, getQuarantinedRecords } from '@/lib/safety-records'

const PRIMARY = 'eqr-safety-records'

const validPtp = {
  id: 'PTP-2026-0001',
  type: 'ptp',
  createdBy: 'Tester',
  createdByEmail: 'test@example.com',
  createdAt: '2026-07-01T08:00:00Z',
  location: 'Yard',
  projectName: 'Project X',
  syncStatus: 'pending',
  notionPageId: null,
  events: [{ action: 'created', by: 'Tester', byEmail: 'test@example.com', at: '2026-07-01T08:00:00Z' }],
  date: '2026-07-01',
  shift: 'Day',
  scopeOfWork: 'General work',
  hazards: [],
  ppeRequired: [],
  emergencyMusterPoint: 'Front gate',
  nearestHospital: 'General',
  firstAidEyewashLocation: 'Shop wall',
  weatherNotes: '',
  windSpeed: '',
  heatIllnessPlan: { water: true, shade: true, restBreaks: true, highHeatProcedures: false },
  toolboxTalkTopic: '',
  toolboxTalkNotes: '',
  crewSignatures: [],
  supervisorSignatureId: null,
}

beforeEach(() => {
  store = {}
  dispatched.length = 0
})

describe('AuditEvent.action drift tolerance', () => {
  it('accepts audit actions unknown to this app version', () => {
    const drifted = {
      ...validPtp,
      events: [
        ...validPtp.events,
        { action: 'rolled-back-v2-action', by: 'Future App', byEmail: null, at: '2026-07-01T09:00:00Z' },
      ],
    }
    const p = partitionSafetyRecords(JSON.stringify([drifted]))
    expect(p).not.toBeNull()
    expect(p!.valid).toHaveLength(1)
    expect(p!.invalid).toHaveLength(0)
  })
})

describe('quarantine instead of deletion', () => {
  const broken = { ...validPtp, id: 'PTP-2026-0002', createdAt: undefined } // missing required field

  it('parks unreadable records in quarantine and returns the readable ones', () => {
    store[PRIMARY] = JSON.stringify([validPtp, broken])
    const records = getAllSafetyRecords()
    expect(records.map((r) => r.id)).toEqual(['PTP-2026-0001'])
    const q = getQuarantinedRecords()
    expect(q).toHaveLength(1)
    expect(q[0].id).toBe('PTP-2026-0002')
    expect(q[0].issues.length).toBeGreaterThan(0)
    expect((q[0].record as { id: string }).id).toBe('PTP-2026-0002')
  })

  it('survives a filtered write-back cycle (the original deletion vector)', () => {
    store[PRIMARY] = JSON.stringify([validPtp, broken])
    const filtered = getAllSafetyRecords()
    // Simulate what any subsequent mutation does: persist the filtered array
    store[PRIMARY] = JSON.stringify(filtered)
    store['eqr-safety-records-backup'] = JSON.stringify(filtered)
    // The unreadable record is gone from primary AND backup — but not lost
    const q = getQuarantinedRecords()
    expect(q).toHaveLength(1)
    expect(q[0].id).toBe('PTP-2026-0002')
  })

  it('does not duplicate quarantine entries across repeated reads', () => {
    store[PRIMARY] = JSON.stringify([validPtp, broken])
    getAllSafetyRecords()
    getAllSafetyRecords()
    getAllSafetyRecords()
    expect(getQuarantinedRecords()).toHaveLength(1)
  })

  it('dispatches eqr:records-quarantined only when NEW records are added', () => {
    store[PRIMARY] = JSON.stringify([validPtp, broken])
    getAllSafetyRecords()
    const first = dispatched.filter((e) => e.type === 'eqr:records-quarantined')
    expect(first).toHaveLength(1)
    expect((first[0] as CustomEvent).detail.ids).toEqual(['PTP-2026-0002'])
    getAllSafetyRecords()
    expect(dispatched.filter((e) => e.type === 'eqr:records-quarantined')).toHaveLength(1)
  })

  it('quarantines records without an id using a stable fingerprint (no re-adds)', () => {
    const noId = { type: 'ptp', garbage: true }
    store[PRIMARY] = JSON.stringify([validPtp, noId])
    getAllSafetyRecords()
    getAllSafetyRecords()
    const q = getQuarantinedRecords()
    expect(q).toHaveLength(1)
    expect(q[0].id).toMatch(/^unknown-/)
  })

  it('caps the quarantine at 50 entries', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ id: `BAD-${i}`, type: 'ptp' }))
    store[PRIMARY] = JSON.stringify([validPtp, ...many])
    getAllSafetyRecords()
    expect(getQuarantinedRecords().length).toBeLessThanOrEqual(50)
  })

  it('a legitimately empty store neither quarantines nor alarms', () => {
    store[PRIMARY] = JSON.stringify([])
    const records = getAllSafetyRecords()
    expect(records).toHaveLength(0)
    expect(getQuarantinedRecords()).toHaveLength(0)
    expect(dispatched.find((e) => e.type === 'eqr:storage-corruption')).toBeUndefined()
  })
})
