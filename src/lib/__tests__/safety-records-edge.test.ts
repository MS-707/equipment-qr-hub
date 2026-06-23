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
  createPreTaskPlan,
  createHeightPermit,
  createHotWorkPermit,
  createConfinedSpacePermit,
  createIncidentReport,
  createJobHazardAnalysis,
  isExpired,
  permitDisplayStatus,
  ptpDayLabel,
  getActivePermits,
  getPtpStatusForDate,
  getLatestPtp,
  pruneOldDrafts,
  exportSafetyToCsv,
} from '@/lib/safety-records'

const basePtpInput = {
  date: '2026-06-23',
  shift: 'Day' as const,
  scopeOfWork: 'Test work',
  hazards: [],
  ppeRequired: ['Hard Hat'],
  emergencyMusterPoint: 'Parking lot',
  nearestHospital: 'General Hospital',
  firstAidEyewashLocation: 'Break room',
  weatherNotes: 'Clear',
  windSpeed: '5 mph',
  heatIllnessPlan: { water: true, shade: true, restBreaks: true, highHeatProcedures: false },
  toolboxTalkTopic: 'Fall prevention',
  toolboxTalkNotes: '',
  crewSignatures: [],
  supervisorSignatureId: null,
  location: 'Site A',
  projectName: 'Test Project',
  createdBy: 'Alice',
  createdByEmail: 'alice@x.com',
}

describe('safety-records edge cases', () => {
  it('createJobHazardAnalysis generates JHA prefix ID', () => {
    const jha = createJobHazardAnalysis({
      jobTitle: 'Crane Lift',
      department: 'Rigging',
      steps: [],
      ppeRequired: ['Hard Hat', 'Safety Glasses'],
      approvedBy: null,
      location: 'Site A',
      projectName: 'Test',
      createdBy: 'Bob',
      createdByEmail: 'bob@x.com',
    })
    expect(jha.id).toMatch(/^JHA-/)
    expect(jha.type).toBe('jha')
    expect(jha.steps).toEqual([])
    expect(jha.ppeRequired).toContain('Hard Hat')
  })

  it('createHotWorkPermit has correct type', () => {
    const permit = createHotWorkPermit({
      permitNumber: 'HW-001',
      validFrom: '2026-06-23T06:00:00Z',
      validUntil: '2099-12-31T18:00:00Z',
      workDescription: 'Welding steel beams',
      hotWorkTypes: ['Welding'],
      fireWatchRequired: true,
      fireWatchName: 'Charlie',
      fireWatchPostDurationMin: 30,
      extinguisherLocation: 'Bay 2',
      extinguisherType: 'ABC',
      sprinklerStatus: 'Active',
      gasTestRequired: false,
      gasTestNotes: '',
      checklist: [],
      workers: [],
      issuerSignatureId: null,
      location: 'Site B',
      projectName: 'Test',
      createdBy: 'Alice',
      createdByEmail: 'alice@x.com',
    })
    expect(permit.type).toBe('hot-work-permit')
    expect(permit.status).toBe('active')
    expect(permit.hotWorkTypes).toContain('Welding')
  })

  it('createConfinedSpacePermit has atmospheric monitoring fields', () => {
    const permit = createConfinedSpacePermit({
      permitNumber: 'CS-001',
      validFrom: '2026-06-23T06:00:00Z',
      validUntil: '2099-12-31T18:00:00Z',
      spaceDescription: 'Tank 5 — storage tank',
      hazards: ['Low O2', 'H2S'],
      atmospheric: { oxygenPct: '20.9', lelPct: '0', coPpm: '0', h2sPpm: '0', testedBy: 'Dave', testedAt: '2026-06-23T06:00:00Z' },
      continuousMonitoring: true,
      ventilationInUse: true,
      rescuePlan: 'Call fire dept',
      checklist: [],
      entrySupervisorSignatureId: null,
      attendantName: 'Dave',
      entrants: [],
      location: 'Plant',
      projectName: 'Test',
      createdBy: 'Alice',
      createdByEmail: 'alice@x.com',
    })
    expect(permit.type).toBe('confined-space-permit')
    expect(permit.spaceDescription).toContain('Tank 5')
  })

  it('createIncidentReport has INC prefix and severity', () => {
    const incident = createIncidentReport({
      incidentType: 'near-miss',
      severity: 'minor',
      occurredAt: '2026-06-23T10:00:00Z',
      description: 'Tripped on wire',
      immediateActions: 'Taped down wire',
      witnesses: [],
      rootCause: 'Loose cable',
      correctiveActions: 'Taped down wire permanently',
      reportedToCalOsha: false,
      photoSlots: [],
      reporterSignatureId: null,
      location: 'Site A',
      projectName: 'Test',
      createdBy: 'Alice',
      createdByEmail: 'alice@x.com',
    })
    expect(incident.id).toMatch(/^INC-/)
    expect(incident.type).toBe('incident-report')
    expect(incident.severity).toBe('minor')
  })

  it('permitDisplayStatus returns expired for past permits', () => {
    const permit = createHeightPermit({
      permitNumber: 'HT-001',
      validFrom: '2020-01-01T06:00:00Z',
      validUntil: '2020-01-01T18:00:00Z',
      workDescription: 'Roof repair',
      workingHeight: '50 ft',
      accessMethod: ['Scaffold'],
      fallProtection: ['Harness'],
      anchorPoints: 'Roof beam',
      rescuePlan: 'Rescue team',
      checklist: [],
      workers: [],
      issuerSignatureId: null,
      location: 'Site A',
      projectName: 'Test',
      createdBy: 'Alice',
      createdByEmail: 'alice@x.com',
    })
    expect(isExpired(permit)).toBe(true)
    expect(permitDisplayStatus(permit)).toBe('expired')
  })

  it('getActivePermits returns only non-expired active permits', () => {
    const active = createHeightPermit({
      permitNumber: 'HT-FUTURE',
      validFrom: '2026-06-23T00:00:00Z',
      validUntil: '2099-12-31T23:59:59Z',
      workDescription: 'Roof repair',
      workingHeight: '50 ft',
      accessMethod: ['Scaffold'],
      fallProtection: ['Harness'],
      anchorPoints: 'Roof beam',
      rescuePlan: 'Rescue team',
      checklist: [],
      workers: [],
      issuerSignatureId: null,
      location: 'Site A',
      projectName: 'Test',
      createdBy: 'Alice',
      createdByEmail: 'alice@x.com',
    })
    const permits = getActivePermits()
    expect(permits.length).toBeGreaterThanOrEqual(1)
    expect(permits.some(p => p.id === active.id)).toBe(true)
  })

  it('getPtpStatusForDate returns correct statuses', () => {
    expect(getPtpStatusForDate('2026-06-23').status).toBe('none')

    createPreTaskPlan(basePtpInput)
    const status = getPtpStatusForDate('2026-06-23')
    expect(status.status).toBe('active')
    expect(status.ptp).toBeDefined()
  })

  it('getLatestPtp returns a PTP when records exist', () => {
    createPreTaskPlan(basePtpInput)
    const latest = getLatestPtp()
    expect(latest).toBeDefined()
    expect(latest!.type).toBe('ptp')
    expect(latest!.date).toBe('2026-06-23')
  })

  it('ptpDayLabel returns null for single-day PTP', () => {
    const ptp = createPreTaskPlan(basePtpInput)
    expect(ptpDayLabel(ptp, '2026-06-23')).toBeNull()
  })

  it('ptpDayLabel returns label for multi-day PTP', () => {
    const ptp = createPreTaskPlan({ ...basePtpInput, validUntil: '2026-06-25' })
    const label = ptpDayLabel(ptp, '2026-06-24')
    expect(label).toContain('Day 2')
  })

  it('exportSafetyToCsv handles CSV injection in project names', () => {
    const ptp = createPreTaskPlan({ ...basePtpInput, projectName: '=CMD()' })
    const csv = exportSafetyToCsv([ptp])
    expect(csv).toContain("\"'=CMD()\"")
  })

  it('pruneOldDrafts removes old pending-sync records', () => {
    const count = pruneOldDrafts()
    expect(typeof count).toBe('number')
  })
})
