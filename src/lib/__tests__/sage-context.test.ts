import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../safety-records', () => ({
  getPtpForDate: vi.fn(() => null),
  getActivePermits: vi.fn(() => []),
  getAllSafetyRecords: vi.fn(() => []),
}))
vi.mock('../datetime', () => ({
  localToday: vi.fn(() => '2026-06-23'),
}))

import { getPtpForDate, getActivePermits, getAllSafetyRecords } from '../safety-records'

beforeEach(() => {
  vi.mocked(getPtpForDate).mockReturnValue(undefined)
  vi.mocked(getActivePermits).mockReturnValue([])
  vi.mocked(getAllSafetyRecords).mockReturnValue([])
})

describe('buildSageContext', () => {
  it('returns basic context without PTP', async () => {
    const { buildSageContext } = await import('../sage-context')
    const ctx = buildSageContext('/safety/ptp', 'Alice')
    expect(ctx.pageUrl).toBe('/safety/ptp')
    expect(ctx.userName).toBe('Alice')
    expect(ctx.ptpSummary).toBeNull()
    expect(ctx.permitSummary).toBeNull()
    expect(ctx.recentIncidentCount).toBe(0)
  })

  it('includes PTP summary when PTP exists', async () => {
    vi.mocked(getPtpForDate).mockReturnValue({
      id: 'PTP-2026-0001',
      type: 'ptp',
      date: '2026-06-23',
      scopeOfWork: 'Install HVAC',
      location: 'Bldg A',
      projectName: 'HVAC Project',
      hazards: [{ description: 'Electrical', riskLevel: 'high', controlMeasure: 'LOTO' }],
      ppeRequired: ['hard-hat', 'safety-glasses'],
      emergencyMusterPoint: 'Lot B',
      crewSignatures: [],
      createdBy: 'Alice',
      createdByEmail: 'alice@x.com',
      createdAt: '2026-06-23T06:00:00Z',
      syncStatus: 'pending',
      notionPageId: null,
      events: [],
      shift: 'day',
      weatherNotes: 'Clear',
      windSpeed: '5mph',
      validFrom: '2026-06-23T06:00:00Z',
      validUntil: '2026-06-23T18:00:00Z',
    } as never)
    const { buildSageContext } = await import('../sage-context')
    const ctx = buildSageContext('/', 'Alice')
    expect(ctx.ptpSummary).toContain('PTP-2026-0001')
    expect(ctx.ptpSummary).toContain('Install HVAC')
    expect(ctx.ptpSummary).toContain('Electrical')
  })

  it('flags PTP gaps', async () => {
    vi.mocked(getPtpForDate).mockReturnValue({
      id: 'PTP-002',
      type: 'ptp',
      date: '2026-06-23',
      scopeOfWork: '',
      location: '',
      projectName: '',
      hazards: [],
      ppeRequired: [],
      emergencyMusterPoint: '',
      crewSignatures: [],
      createdBy: 'Bob',
      createdByEmail: 'bob@x.com',
      createdAt: '2026-06-23T06:00:00Z',
      syncStatus: 'pending',
      notionPageId: null,
      events: [],
      shift: 'day',
      validFrom: '2026-06-23T06:00:00Z',
      validUntil: '2026-06-23T18:00:00Z',
    } as never)
    const { buildSageContext } = await import('../sage-context')
    const ctx = buildSageContext('/', 'Bob')
    expect(ctx.ptpSummary).toContain('NONE IDENTIFIED')
    expect(ctx.ptpSummary).toContain('NOT SPECIFIED')
    expect(ctx.ptpSummary).toContain('NOT SET')
  })

  it('counts recent incidents', async () => {
    vi.mocked(getAllSafetyRecords).mockReturnValue([
      { type: 'incident-report', createdAt: new Date().toISOString() },
      { type: 'incident-report', createdAt: new Date().toISOString() },
      { type: 'ptp', createdAt: new Date().toISOString() },
    ] as never)
    const { buildSageContext } = await import('../sage-context')
    const ctx = buildSageContext('/', 'Alice')
    expect(ctx.recentIncidentCount).toBe(2)
  })
})

describe('contextToPrompt', () => {
  it('builds a text prompt from context', async () => {
    const { contextToPrompt } = await import('../sage-context')
    const text = contextToPrompt({
      pageUrl: '/safety/ptp',
      userName: 'Alice',
      timeOfDay: 'morning',
      ptpSummary: 'PTP summary here',
      permitSummary: null,
      recentIncidentCount: 0,
    })
    expect(text).toContain('Current page: /safety/ptp')
    expect(text).toContain('Worker: Alice')
    expect(text).toContain('Time: morning')
    expect(text).toContain('PTP summary here')
  })

  it('shows "Not started" when no PTP', async () => {
    const { contextToPrompt } = await import('../sage-context')
    const text = contextToPrompt({
      pageUrl: '/',
      userName: null,
      timeOfDay: 'afternoon',
      ptpSummary: null,
      permitSummary: null,
      recentIncidentCount: 0,
    })
    expect(text).toContain('Not started')
    expect(text).not.toContain('Worker:')
  })

  it('includes incident count when non-zero', async () => {
    const { contextToPrompt } = await import('../sage-context')
    const text = contextToPrompt({
      pageUrl: '/',
      userName: 'Bob',
      timeOfDay: 'evening',
      ptpSummary: null,
      permitSummary: 'ACTIVE PERMITS: HP-001',
      recentIncidentCount: 3,
    })
    expect(text).toContain('Recent incidents (7 days): 3')
    expect(text).toContain('ACTIVE PERMITS: HP-001')
  })
})
