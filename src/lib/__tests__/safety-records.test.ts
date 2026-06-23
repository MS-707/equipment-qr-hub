import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let store: Record<string, string> = {}

vi.stubGlobal('window', {
  ...globalThis,
  addEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})
vi.stubGlobal('localStorage', {
  getItem: vi.fn((k: string) => store[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { store[k] = v }),
  removeItem: vi.fn((k: string) => { delete store[k] }),
  get length() { return Object.keys(store).length },
  key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
})
vi.stubGlobal('navigator', { onLine: true })
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' })

vi.mock('@/lib/identity', () => ({
  getCurrentIdentity: vi.fn(() => ({ name: 'Test User', email: 'test@example.com', image: null, verifiedAt: '2026-06-23T00:00:00Z' })),
}))

import {
  getAllSafetyRecords,
  getSafetyRecordById,
  getSafetyRecordsByType,
  getRecordsForDate,
  getPtpForDate,
  getActivePermits,
  createPreTaskPlan,
  createIncidentReport,
  createHeightPermit,
  closePermit,
  revokePermit,
  markSynced,
  markSyncFailed,
  markSubmittedForReview,
  markReviewApproved,
  markReviewRejected,
  markReviewRecalled,
  onSafetyChange,
  archiveOldSyncedRecords,
  cryptoRandomId,
  exportSafetyToCsv,
  newSignature,
  ptpDayLabel,
  isExpired,
  getOpenSafetyCount,
} from '../safety-records'
import type { PreTaskPlan, HeightPermit as HeightPermitT } from '@/lib/safety-types'

const ptpInput = {
  location: 'Site A',
  projectName: 'Project X',
  date: '2026-06-23',
  shift: 'Day' as const,
  scopeOfWork: 'Install rebar',
  hazards: [],
  ppeRequired: ['Hard hat'],
  emergencyMusterPoint: 'Parking lot',
  nearestHospital: 'County General',
  firstAidEyewashLocation: 'Trailer 1',
  weatherNotes: 'Clear',
  windSpeed: '5 mph',
  heatIllnessPlan: { water: true, shade: true, restBreaks: true, highHeatProcedures: false },
  toolboxTalkTopic: 'Fall protection',
  toolboxTalkNotes: '',
  crewSignatures: [],
  supervisorSignatureId: null,
}

const heightPermitInput = {
  location: 'Tower 3',
  projectName: 'Project Y',
  workDescription: 'Roof repair',
  workingHeight: '30 feet',
  accessMethod: ['Ladder'],
  fallProtection: ['Harness'],
  anchorPoints: 'Steel beam',
  rescuePlan: 'Call 911',
  checklist: [],
  validFrom: '2026-06-23T08:00:00Z',
  validUntil: '2026-06-23T16:00:00Z',
  workers: [],
  issuerSignatureId: null,
}

beforeEach(() => {
  store = {}
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-23T12:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createPreTaskPlan', () => {
  it('creates a PTP with auto-generated ID and metadata', () => {
    const ptp = createPreTaskPlan(ptpInput)
    expect(ptp.id).toMatch(/^PTP-2026-/)
    expect(ptp.type).toBe('ptp')
    expect(ptp.createdBy).toBe('Test User')
    expect(ptp.createdByEmail).toBe('test@example.com')
    expect(ptp.syncStatus).toBe('pending')
    expect(ptp.events).toHaveLength(1)
    expect(ptp.events[0].action).toBe('created')
  })

  it('stores PTP in localStorage', () => {
    createPreTaskPlan(ptpInput)
    const all = getAllSafetyRecords()
    expect(all).toHaveLength(1)
    expect(all[0].type).toBe('ptp')
  })
})

describe('createHeightPermit', () => {
  it('creates a permit with active status', () => {
    const permit = createHeightPermit(heightPermitInput)
    expect(permit.id).toMatch(/^WAH-2026-/)
    expect(permit.type).toBe('height-permit')
    expect(permit.status).toBe('active')
    expect(permit.closedAt).toBeNull()
    expect(permit.closedBy).toBeNull()
  })
})

describe('createIncidentReport', () => {
  it('creates incident with INC prefix', () => {
    const inc = createIncidentReport({
      location: 'Site B',
      projectName: 'Project Z',
      incidentType: 'near-miss',
      severity: 'minor',
      occurredAt: '2026-06-23T09:00:00Z',
      description: 'Scaffolding slipped',
      immediateActions: 'Area secured',
      witnesses: [],
      rootCause: 'Unknown',
      correctiveActions: 'Review setup',
      reportedToCalOsha: false,
      photoSlots: [],
      reporterSignatureId: null,
    })
    expect(inc.id).toMatch(/^INC-2026-/)
    expect(inc.type).toBe('incident-report')
  })
})

describe('getSafetyRecordById', () => {
  it('finds record by ID', () => {
    const ptp = createPreTaskPlan(ptpInput)
    const found = getSafetyRecordById(ptp.id)
    expect(found?.id).toBe(ptp.id)
  })

  it('returns undefined for non-existent ID', () => {
    expect(getSafetyRecordById('NOPE-0001')).toBeUndefined()
  })
})

describe('getSafetyRecordsByType', () => {
  it('filters by type', () => {
    createPreTaskPlan(ptpInput)
    createHeightPermit(heightPermitInput)
    expect(getSafetyRecordsByType('ptp')).toHaveLength(1)
    expect(getSafetyRecordsByType('height-permit')).toHaveLength(1)
    expect(getSafetyRecordsByType('incident-report')).toHaveLength(0)
  })
})

describe('getRecordsForDate', () => {
  it('returns records created on that date', () => {
    createPreTaskPlan(ptpInput)
    const records = getRecordsForDate('2026-06-23')
    expect(records).toHaveLength(1)
  })

  it('returns empty for other dates', () => {
    createPreTaskPlan(ptpInput)
    expect(getRecordsForDate('2026-06-24')).toHaveLength(0)
  })
})

describe('getPtpForDate', () => {
  it('finds PTP matching the date', () => {
    createPreTaskPlan(ptpInput)
    const found = getPtpForDate('2026-06-23')
    expect(found).toBeDefined()
    expect(found?.type).toBe('ptp')
  })

  it('finds PTP within multi-day validity', () => {
    createPreTaskPlan({ ...ptpInput, date: '2026-06-22', validUntil: '2026-06-25' })
    expect(getPtpForDate('2026-06-23')).toBeDefined()
    expect(getPtpForDate('2026-06-25')).toBeDefined()
    expect(getPtpForDate('2026-06-26')).toBeUndefined()
  })
})

describe('closePermit', () => {
  it('transitions permit to closed status', () => {
    const permit = createHeightPermit(heightPermitInput)
    const closed = closePermit(permit.id, { name: 'Closer', email: 'c@x.com' })
    expect((closed as HeightPermitT).status).toBe('closed')
    expect((closed as HeightPermitT).closedBy).toBe('Closer')
    expect((closed as HeightPermitT).closedAt).toBeTruthy()
  })

  it('appends closed event to audit trail', () => {
    const permit = createHeightPermit(heightPermitInput)
    const closed = closePermit(permit.id, { name: 'Closer', email: 'c@x.com' }, 'Work complete')
    expect(closed!.events).toHaveLength(2)
    expect(closed!.events[1].action).toBe('closed')
    expect(closed!.events[1].note).toBe('Work complete')
  })

  it('returns undefined for non-existent record', () => {
    expect(closePermit('NOPE', { name: 'X', email: null })).toBeUndefined()
  })
})

describe('revokePermit', () => {
  it('transitions permit to revoked status', () => {
    const permit = createHeightPermit(heightPermitInput)
    const revoked = revokePermit(permit.id, { name: 'Safety Mgr', email: 's@x.com' }, 'Unsafe conditions')
    expect((revoked as HeightPermitT).status).toBe('revoked')
    expect(revoked!.events[1].action).toBe('revoked')
    expect(revoked!.events[1].note).toBe('Unsafe conditions')
  })
})

describe('markSynced / markSyncFailed', () => {
  it('updates syncStatus to synced with notionPageId', () => {
    const ptp = createPreTaskPlan(ptpInput)
    markSynced(ptp.id, 'notion-page-123')
    const updated = getSafetyRecordById(ptp.id)
    expect(updated?.syncStatus).toBe('synced')
    expect(updated?.notionPageId).toBe('notion-page-123')
    expect(updated?.events.some((e) => e.action === 'synced')).toBe(true)
  })

  it('updates syncStatus to failed', () => {
    const ptp = createPreTaskPlan(ptpInput)
    markSyncFailed(ptp.id)
    const updated = getSafetyRecordById(ptp.id)
    expect(updated?.syncStatus).toBe('failed')
    expect(updated?.events.some((e) => e.action === 'sync-failed')).toBe(true)
  })
})

describe('review workflow', () => {
  it('submits for review', () => {
    const ptp = createPreTaskPlan(ptpInput)
    const submitted = markSubmittedForReview(ptp.id, { name: 'Alice', email: 'a@x.com' })
    expect(submitted?.reviewStatus).toBe('submitted')
  })

  it('approves a submitted record', () => {
    const ptp = createPreTaskPlan(ptpInput)
    markSubmittedForReview(ptp.id, { name: 'Alice', email: 'a@x.com' })
    const approved = markReviewApproved(ptp.id, { reviewerName: 'Bob', reviewerEmail: 'b@x.com', reviewNote: 'LGTM' })
    expect(approved?.reviewStatus).toBe('approved')
    expect(approved?.reviewerName).toBe('Bob')
  })

  it('rejects a submitted record', () => {
    const ptp = createPreTaskPlan(ptpInput)
    markSubmittedForReview(ptp.id, { name: 'Alice', email: 'a@x.com' })
    const rejected = markReviewRejected(ptp.id, { reviewerName: 'Bob', reviewerEmail: 'b@x.com', reviewNote: 'Missing hazards' })
    expect(rejected?.reviewStatus).toBe('rejected')
  })

  it('recalls a submitted record', () => {
    const ptp = createPreTaskPlan(ptpInput)
    markSubmittedForReview(ptp.id, { name: 'Alice', email: 'a@x.com' })
    const recalled = markReviewRecalled(ptp.id, { name: 'Alice', email: 'a@x.com' })
    expect(recalled?.reviewStatus).toBe('recalled')
  })

  it('prevents approving non-submitted record', () => {
    const ptp = createPreTaskPlan(ptpInput)
    const result = markReviewApproved(ptp.id, { reviewerName: 'Bob', reviewerEmail: null, reviewNote: null })
    expect(result?.reviewStatus).toBeUndefined()
  })

  it('prevents double-approval', () => {
    const ptp = createPreTaskPlan(ptpInput)
    markSubmittedForReview(ptp.id, { name: 'Alice', email: 'a@x.com' })
    markReviewApproved(ptp.id, { reviewerName: 'Bob', reviewerEmail: 'b@x.com', reviewNote: null })
    const second = markSubmittedForReview(ptp.id, { name: 'Alice', email: 'a@x.com' })
    expect(second?.reviewStatus).toBe('approved')
  })
})

describe('onSafetyChange', () => {
  it('fires listener on record creation', () => {
    const listener = vi.fn()
    const unsub = onSafetyChange(listener)
    createPreTaskPlan(ptpInput)
    expect(listener).toHaveBeenCalled()
    unsub()
  })

  it('stops firing after unsubscribe', () => {
    const listener = vi.fn()
    const unsub = onSafetyChange(listener)
    unsub()
    createPreTaskPlan(ptpInput)
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('archiveOldSyncedRecords', () => {
  it('removes synced records older than 90 days', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const ptp = createPreTaskPlan(ptpInput)
    markSynced(ptp.id, 'np-1')
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'))
    const removed = archiveOldSyncedRecords()
    expect(removed).toBe(1)
    expect(getAllSafetyRecords()).toHaveLength(0)
  })

  it('keeps recent synced records', () => {
    const ptp = createPreTaskPlan(ptpInput)
    markSynced(ptp.id, 'np-1')
    const removed = archiveOldSyncedRecords()
    expect(removed).toBe(0)
    expect(getAllSafetyRecords()).toHaveLength(1)
  })

  it('keeps pending records regardless of age', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    createPreTaskPlan(ptpInput)
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'))
    const removed = archiveOldSyncedRecords()
    expect(removed).toBe(0)
  })
})

describe('cryptoRandomId', () => {
  it('returns a UUID when crypto.randomUUID is available', () => {
    expect(cryptoRandomId()).toBe('test-uuid-1234')
  })
})

describe('newSignature', () => {
  it('creates a signature with defaults', () => {
    const sig = newSignature({ name: 'Worker', hasSignature: true })
    expect(sig.name).toBe('Worker')
    expect(sig.email).toBeNull()
    expect(sig.role).toBeNull()
    expect(sig.hasSignature).toBe(true)
    expect(sig.signedAt).toBeTruthy()
  })
})

describe('ptpDayLabel', () => {
  it('returns null for single-day PTP', () => {
    const ptp = createPreTaskPlan(ptpInput)
    expect(ptpDayLabel(ptp, '2026-06-23')).toBeNull()
  })

  it('returns day label for multi-day PTP', () => {
    const ptp = createPreTaskPlan({ ...ptpInput, validUntil: '2026-06-25' })
    expect(ptpDayLabel(ptp, '2026-06-23')).toBe('Day 1 of 3')
    expect(ptpDayLabel(ptp, '2026-06-24')).toBe('Day 2 of 3')
    expect(ptpDayLabel(ptp, '2026-06-25')).toBe('Day 3 of 3')
  })
})

describe('isExpired', () => {
  it('returns false for future validity', () => {
    const permit = createHeightPermit(heightPermitInput)
    expect(isExpired(permit)).toBe(false)
  })

  it('returns true for past validity', () => {
    const permit = createHeightPermit({
      ...heightPermitInput,
      validUntil: '2026-06-22T16:00:00Z',
    })
    expect(isExpired(permit)).toBe(true)
  })
})

describe('exportSafetyToCsv', () => {
  it('generates CSV with headers', () => {
    const ptp = createPreTaskPlan(ptpInput)
    const csv = exportSafetyToCsv([ptp])
    expect(csv).toContain('ID,Type,Project')
    expect(csv).toContain(ptp.id)
    expect(csv).toContain('"ptp"')
  })

  it('escapes CSV injection characters', () => {
    const ptp = createPreTaskPlan({ ...ptpInput, projectName: '=SUM(A1:A10)' })
    const csv = exportSafetyToCsv([ptp])
    expect(csv).toContain("\"'=SUM(A1:A10)\"")
  })
})

describe('getOpenSafetyCount', () => {
  it('counts active permits', () => {
    createHeightPermit(heightPermitInput)
    expect(getOpenSafetyCount()).toBe(1)
  })

  it('counts recent incidents within 7 days', () => {
    createIncidentReport({
      location: 'Site B',
      projectName: 'Project Z',
      incidentType: 'near-miss',
      severity: 'minor',
      occurredAt: '2026-06-23T09:00:00Z',
      description: 'Near miss',
      immediateActions: 'None',
      witnesses: [],
      rootCause: '',
      correctiveActions: '',
      reportedToCalOsha: false,
      photoSlots: [],
      reporterSignatureId: null,
    })
    expect(getOpenSafetyCount()).toBe(1)
  })
})
