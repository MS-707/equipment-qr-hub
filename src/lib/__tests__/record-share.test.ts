import { describe, it, expect } from 'vitest'
import { buildRecordSubject, buildRecordText } from '../record-share'
import type { PreTaskPlan, IncidentReport } from '@/lib/safety-types'

const basePtp: PreTaskPlan = {
  id: 'PTP-2026-0001',
  type: 'ptp',
  projectName: 'Bridge Repair',
  location: 'Site A',
  createdBy: 'Alice',
  createdByEmail: 'alice@example.com',
  createdAt: '2026-06-23T08:00:00Z',
  syncStatus: 'synced',
  notionPageId: null,
  events: [],
  date: '2026-06-23',
  shift: 'Day',
  scopeOfWork: 'Repair bridge deck',
  weatherNotes: 'Clear skies',
  windSpeed: '5 mph',
  emergencyMusterPoint: 'Parking lot B',
  nearestHospital: 'General Hospital',
  firstAidEyewashLocation: 'Tool shed',
  toolboxTalkTopic: 'Fall protection review',
  toolboxTalkNotes: 'All crew reminded to inspect harnesses',
  hazards: [
    { id: 'HAZ-1', description: 'Fall from height', riskLevel: 'high', controlMeasure: 'Full harness + lanyard', addedBy: 'Alice' },
  ],
  ppeRequired: ['hard-hat', 'safety-glasses'],
  crewSignatures: [
    { id: 'SIG-1', name: 'Alice', email: 'alice@example.com', role: 'Supervisor', hasSignature: true, signedAt: '2026-06-23T08:05:00Z' },
    { id: 'SIG-2', name: 'Bob', email: 'bob@example.com', role: 'Worker', hasSignature: true, signedAt: '2026-06-23T08:06:00Z' },
  ],
  heatIllnessPlan: { water: true, shade: true, restBreaks: true, highHeatProcedures: false },
  supervisorSignatureId: 'SIG-1',
}

const baseIncident: IncidentReport = {
  id: 'INC-2026-0001',
  type: 'incident-report',
  projectName: 'Warehouse Build',
  location: 'Bay 3',
  createdBy: 'Charlie',
  createdByEmail: 'charlie@example.com',
  createdAt: '2026-06-23T14:00:00Z',
  syncStatus: 'pending',
  notionPageId: null,
  events: [],
  occurredAt: '2026-06-23T13:45:00Z',
  incidentType: 'near-miss',
  severity: 'minor',
  description: 'Load shifted during crane lift',
  immediateActions: 'Stopped lift, re-rigged load',
  witnesses: ['Dave', 'Eve'],
  rootCause: 'Improper rigging',
  correctiveActions: 'Re-train crew on rigging procedures',
  reportedToCalOsha: false,
  photoSlots: [],
  reporterSignatureId: null,
}

describe('buildRecordSubject', () => {
  it('builds PTP subject with project and date', () => {
    const subject = buildRecordSubject(basePtp)
    expect(subject).toContain('Pre-Task Plan')
    expect(subject).toContain('Bridge Repair')
    expect(subject).toContain('PTP-2026-0001')
  })

  it('builds incident subject without date', () => {
    const subject = buildRecordSubject(baseIncident)
    expect(subject).toContain('Incident / Near-Miss')
    expect(subject).toContain('Warehouse Build')
    expect(subject).toContain('INC-2026-0001')
  })

  it('handles record without project name', () => {
    const noProjPtp = { ...basePtp, projectName: '' }
    const subject = buildRecordSubject(noProjPtp)
    expect(subject).toContain('Pre-Task Plan')
    expect(subject).not.toContain(' — ')
  })
})

describe('buildRecordText', () => {
  it('builds PTP text with all sections', () => {
    const text = buildRecordText(basePtp)
    expect(text).toContain('Pre-Task Plan')
    expect(text).toContain('Ref: PTP-2026-0001')
    expect(text).toContain('Bridge Repair')
    expect(text).toContain('SCOPE OF WORK')
    expect(text).toContain('Repair bridge deck')
    expect(text).toContain('HAZARDS & CONTROLS')
    expect(text).toContain('Fall from height')
    expect(text).toContain('Full harness + lanyard')
    expect(text).toContain('PPE REQUIRED')
    expect(text).toContain('CREW SIGN-ON')
    expect(text).toContain('Alice')
    expect(text).toContain('TOOLBOX TALK')
    expect(text).toContain('Fall protection review')
    expect(text).toContain('SITE CONDITIONS')
    expect(text).toContain('Clear skies')
  })

  it('builds incident text with all sections', () => {
    const text = buildRecordText(baseIncident)
    expect(text).toContain('Incident / Near-Miss')
    expect(text).toContain('near-miss')
    expect(text).toContain('DESCRIPTION')
    expect(text).toContain('Load shifted')
    expect(text).toContain('IMMEDIATE ACTIONS')
    expect(text).toContain('WITNESSES')
    expect(text).toContain('Dave')
    expect(text).toContain('ROOT CAUSE')
    expect(text).toContain('CORRECTIVE ACTIONS')
  })

  it('handles PTP with no hazards', () => {
    const noHazards = { ...basePtp, hazards: [] }
    const text = buildRecordText(noHazards)
    expect(text).toContain('(none recorded)')
  })

  it('handles PTP with no crew signatures', () => {
    const noCrew = { ...basePtp, crewSignatures: [] }
    const text = buildRecordText(noCrew)
    expect(text).toContain('CREW SIGN-ON (0)')
    expect(text).toContain('(none)')
  })

  it('includes review status when present', () => {
    const reviewed = { ...basePtp, reviewStatus: 'approved' as const }
    const text = buildRecordText(reviewed)
    expect(text).toContain('EHS review: approved')
  })

  it('includes footer', () => {
    const text = buildRecordText(basePtp)
    expect(text).toContain('Generated by Sage EHS')
  })
})
