import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Post-sync mutation integrity (queue item A4): closing/revoking a permit or
 * deciding a review must re-queue the record for sync, and the retention
 * archiver must never delete a record whose latest mutation never reached the
 * server — the local copy is the only place that mutation exists.
 */

let store: Record<string, string> = {}

vi.stubGlobal('window', {
  ...globalThis,
  addEventListener: vi.fn(),
  dispatchEvent: vi.fn(() => true),
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

import {
  closePermit,
  revokePermit,
  markSubmittedForReview,
  markSynced,
  hasUnsyncedMutations,
  archiveOldSyncedRecords,
  getSafetyRecordById,
  createIncidentReport,
  getAllSafetyRecords,
  _resetReadCacheForTests,
} from '@/lib/safety-records'
import type { SafetyRecord } from '@/lib/safety-types'

const PRIMARY = 'eqr-safety-records'

// Well past the 90-day retention window relative to any 2026 "now"
const OLD_CREATED = '2025-09-01T08:00:00.000Z'
const OLD_SYNCED = '2025-09-01T09:00:00.000Z'

function syncedPermit(id = 'WAH-2026-0001'): Record<string, unknown> {
  return {
    id,
    type: 'height-permit',
    createdBy: 'Tester',
    createdByEmail: 'test@example.com',
    createdAt: OLD_CREATED,
    location: 'Roof',
    projectName: 'Project X',
    syncStatus: 'synced',
    notionPageId: '9c911f57-0000-4000-8000-000000000000',
    events: [
      { action: 'created', by: 'Tester', byEmail: 'test@example.com', at: OLD_CREATED },
      { action: 'synced', by: 'system', byEmail: null, at: OLD_SYNCED },
    ],
    status: 'active',
    workDescription: 'Roof work',
    workingHeight: '20 ft',
    accessMethod: [],
    fallProtection: [],
    anchorPoints: '',
    rescuePlan: '',
    checklist: [],
    validFrom: OLD_CREATED,
    validUntil: OLD_CREATED,
    workers: [],
    issuerSignatureId: null,
    closedAt: null,
    closedBy: null,
  }
}

function seed(...records: Record<string, unknown>[]) {
  store[PRIMARY] = JSON.stringify(records)
}

beforeEach(() => {
  store = {}
  _resetReadCacheForTests()
})

describe('mutations re-queue for sync', () => {
  it('closePermit flips a synced record back to pending', () => {
    seed(syncedPermit())
    const rec = closePermit('WAH-2026-0001', { name: 'Closer', email: 'c@x.com' })
    expect(rec?.syncStatus).toBe('pending')
    const persisted = JSON.parse(store[PRIMARY]) as SafetyRecord[]
    expect(persisted[0].syncStatus).toBe('pending')
    expect((persisted[0] as { status: string }).status).toBe('closed')
  })

  it('revokePermit flips a synced record back to pending', () => {
    seed(syncedPermit())
    const rec = revokePermit('WAH-2026-0001', { name: 'Revoker', email: null }, 'unsafe conditions')
    expect(rec?.syncStatus).toBe('pending')
  })

  it('markSubmittedForReview flips a synced record back to pending', () => {
    seed(syncedPermit())
    const rec = markSubmittedForReview('WAH-2026-0001', { name: 'Submitter', email: null })
    expect(rec?.syncStatus).toBe('pending')
  })

  it('does not touch offline/failed statuses (they already re-queue)', () => {
    seed({ ...syncedPermit(), syncStatus: 'offline' })
    const rec = closePermit('WAH-2026-0001', { name: 'Closer', email: null })
    expect(rec?.syncStatus).toBe('offline')
  })

  it('a re-sync after mutation returns the record to synced and archivable', () => {
    seed(syncedPermit())
    closePermit('WAH-2026-0001', { name: 'Closer', email: null })
    markSynced('WAH-2026-0001', '9c911f57-0000-4000-8000-000000000000')
    const rec = getSafetyRecordById('WAH-2026-0001')
    expect(rec?.syncStatus).toBe('synced')
    expect(hasUnsyncedMutations(rec!)).toBe(false)
  })
})

describe('hasUnsyncedMutations', () => {
  it('is false for a cleanly synced record', () => {
    seed(syncedPermit())
    const rec = getSafetyRecordById('WAH-2026-0001')!
    expect(hasUnsyncedMutations(rec)).toBe(false)
  })

  it('is true when a mutation event postdates the last sync (legacy data shape)', () => {
    const legacy = syncedPermit()
    ;(legacy.events as unknown[]).push({
      action: 'closed', by: 'Closer', byEmail: null, at: '2025-10-01T08:00:00.000Z',
    })
    legacy.status = 'closed'
    // Legacy bug: syncStatus stayed 'synced' even though the closure never synced
    seed(legacy)
    const rec = getSafetyRecordById('WAH-2026-0001')!
    expect(rec.syncStatus).toBe('synced')
    expect(hasUnsyncedMutations(rec)).toBe(true)
  })
})

describe('archiveOldSyncedRecords guard', () => {
  it('archives old, cleanly synced records', () => {
    seed(syncedPermit())
    expect(archiveOldSyncedRecords()).toBe(1)
    expect(JSON.parse(store[PRIMARY])).toHaveLength(0)
  })

  it('NEVER archives a record whose mutation postdates its last sync', () => {
    const legacy = syncedPermit()
    ;(legacy.events as unknown[]).push({
      action: 'closed', by: 'Closer', byEmail: null, at: '2025-10-01T08:00:00.000Z',
    })
    legacy.status = 'closed'
    legacy.closedAt = '2025-10-01T08:00:00.000Z'
    legacy.closedBy = 'Closer'
    seed(legacy)
    expect(archiveOldSyncedRecords()).toBe(0)
    expect(JSON.parse(store[PRIMARY])).toHaveLength(1)
  })

  it('never archives pending records regardless of age', () => {
    seed({ ...syncedPermit(), syncStatus: 'pending' })
    expect(archiveOldSyncedRecords()).toBe(0)
  })

  it('archives a mutated record only after the mutation itself has synced', () => {
    const healed = syncedPermit()
    ;(healed.events as unknown[]).push(
      { action: 'closed', by: 'Closer', byEmail: null, at: '2025-10-01T08:00:00.000Z' },
      { action: 'synced', by: 'system', byEmail: null, at: '2025-10-01T08:05:00.000Z' },
    )
    healed.status = 'closed'
    seed(healed)
    expect(archiveOldSyncedRecords()).toBe(1)
  })
})

describe('readAll cache (F2)', () => {
  it('copy-on-read: callers mutating results cannot corrupt the cache', () => {
    seed(syncedPermit())
    const list = getAllSafetyRecords()
    list.pop()
    expect(getAllSafetyRecords()).toHaveLength(1)
  })

  it('reflects direct store changes (cache keyed on the raw string)', () => {
    seed(syncedPermit('WAH-2026-0001'))
    expect(getAllSafetyRecords()).toHaveLength(1)
    seed(syncedPermit('WAH-2026-0001'), syncedPermit('WAH-2026-0002'))
    expect(getAllSafetyRecords()).toHaveLength(2)
  })

  it('reflects API writes immediately (writeAll invalidation)', () => {
    seed(syncedPermit())
    closePermit('WAH-2026-0001', { name: 'Closer', email: null })
    const rec = getSafetyRecordById('WAH-2026-0001')
    expect((rec as { status?: string })?.status).toBe('closed')
  })
})

describe('ID collision-proofing (C2)', () => {
  const incidentInput = {
    location: 'Yard',
    projectName: 'Project X',
    incidentType: 'near-miss' as const,
    severity: 'minor' as const,
    occurredAt: '2026-07-02T08:00:00.000Z',
    description: 'Test',
    immediateActions: '',
    witnesses: [],
    rootCause: '',
    correctiveActions: '',
    reportedToCalOsha: false,
    photoSlots: [],
    reporterSignatureId: null,
  }

  it('always suffixes IDs so same-counter tabs cannot collide', () => {
    const a = createIncidentReport(incidentInput)
    // Simulate a second tab whose counter read predates the increment
    delete store['eqr-safety-counters']
    const b = createIncidentReport(incidentInput)
    expect(a.id).toMatch(/^INC-\d{4}-\d{4}-[a-z0-9]{4}$/i)
    expect(a.id.slice(0, 13)).toBe(b.id.slice(0, 13)) // same sequential part
    expect(a.id).not.toBe(b.id) // never the same record
  })
})
