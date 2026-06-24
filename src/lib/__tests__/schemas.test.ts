import { describe, it, expect } from 'vitest'
import { safeParseSafetyRecords, safeParseIdentity, IdentitySchema } from '../schemas'

const basePtp = {
  id: 'PTP-2026-0001',
  type: 'ptp' as const,
  createdBy: 'Alice',
  createdByEmail: 'alice@example.com',
  createdAt: '2026-06-23T00:00:00.000Z',
  location: 'Site A',
  projectName: 'Project X',
  syncStatus: 'pending' as const,
  notionPageId: null,
  events: [],
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

const baseIncident = {
  id: 'INC-2026-0001',
  type: 'incident-report' as const,
  createdBy: 'Bob',
  createdByEmail: 'bob@example.com',
  createdAt: '2026-06-23T10:00:00.000Z',
  location: 'Site B',
  projectName: 'Project Y',
  syncStatus: 'synced' as const,
  notionPageId: 'np-123',
  events: [{ action: 'created' as const, by: 'Bob', byEmail: 'bob@example.com', at: '2026-06-23T10:00:00.000Z' }],
  incidentType: 'near-miss' as const,
  severity: 'minor' as const,
  occurredAt: '2026-06-23T09:30:00.000Z',
  description: 'Scaffolding board shifted',
  immediateActions: 'Area secured',
  witnesses: ['Charlie'],
  rootCause: 'Improper installation',
  correctiveActions: 'Retrain crew',
  reportedToCalOsha: false,
  photoSlots: [],
  reporterSignatureId: null,
}

describe('safeParseSafetyRecords', () => {
  it('parses valid PTP records', () => {
    const result = safeParseSafetyRecords(JSON.stringify([basePtp]))
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('PTP-2026-0001')
    expect(result[0].type).toBe('ptp')
  })

  it('parses valid incident report', () => {
    const result = safeParseSafetyRecords(JSON.stringify([baseIncident]))
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('incident-report')
  })

  it('parses mixed record types', () => {
    const result = safeParseSafetyRecords(JSON.stringify([basePtp, baseIncident]))
    expect(result).toHaveLength(2)
  })

  it('drops records with invalid type discriminator', () => {
    const bad = { ...basePtp, type: 'unknown-type' }
    const result = safeParseSafetyRecords(JSON.stringify([basePtp, bad]))
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('PTP-2026-0001')
  })

  it('drops records missing required fields', () => {
    const { scopeOfWork, ...incomplete } = basePtp
    void scopeOfWork
    const result = safeParseSafetyRecords(JSON.stringify([incomplete]))
    expect(result).toHaveLength(0)
  })

  it('returns empty array for non-array JSON', () => {
    expect(safeParseSafetyRecords('{}')).toEqual([])
  })

  it('returns empty array for invalid JSON', () => {
    expect(safeParseSafetyRecords('not json')).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(safeParseSafetyRecords('')).toEqual([])
  })

  it('accepts records with extra fields via passthrough', () => {
    const extended = { ...basePtp, futureField: 42 }
    const result = safeParseSafetyRecords(JSON.stringify([extended]))
    expect(result).toHaveLength(1)
    expect((result[0] as unknown as Record<string, unknown>).futureField).toBe(42)
  })

  it('validates all syncStatus values', () => {
    for (const status of ['pending', 'synced', 'failed', 'offline'] as const) {
      const record = { ...basePtp, syncStatus: status }
      const result = safeParseSafetyRecords(JSON.stringify([record]))
      expect(result).toHaveLength(1)
    }
  })

  it('rejects invalid syncStatus', () => {
    const record = { ...basePtp, syncStatus: 'bad' }
    const result = safeParseSafetyRecords(JSON.stringify([record]))
    expect(result).toHaveLength(0)
  })

  it('validates shift enum', () => {
    for (const shift of ['Day', 'Swing', 'Night'] as const) {
      const record = { ...basePtp, shift }
      const result = safeParseSafetyRecords(JSON.stringify([record]))
      expect(result).toHaveLength(1)
    }
  })

  it('rejects invalid shift value', () => {
    const record = { ...basePtp, shift: 'Weekend' }
    const result = safeParseSafetyRecords(JSON.stringify([record]))
    expect(result).toHaveLength(0)
  })

  it('validates incident severity enum', () => {
    for (const severity of ['minor', 'moderate', 'serious', 'critical'] as const) {
      const record = { ...baseIncident, severity }
      const result = safeParseSafetyRecords(JSON.stringify([record]))
      expect(result).toHaveLength(1)
    }
  })

  it('validates audit events structure', () => {
    const withEvent = {
      ...basePtp,
      events: [{ action: 'created', by: 'Alice', byEmail: 'alice@ex.com', at: '2026-06-23T00:00:00Z' }],
    }
    const result = safeParseSafetyRecords(JSON.stringify([withEvent]))
    expect(result).toHaveLength(1)
  })
})

describe('safeParseIdentity', () => {
  it('parses valid identity', () => {
    const raw = JSON.stringify({ name: 'Alice', email: 'a@x.com', image: null, verifiedAt: '2026-06-23T00:00:00Z' })
    const id = safeParseIdentity(raw)
    expect(id?.name).toBe('Alice')
    expect(id?.email).toBe('a@x.com')
  })

  it('returns null for invalid JSON', () => {
    expect(safeParseIdentity('not json')).toBeNull()
  })

  it('returns null for schema-invalid data', () => {
    expect(safeParseIdentity(JSON.stringify({ wrong: 'shape' }))).toBeNull()
  })

  it('accepts extra fields via passthrough', () => {
    const raw = JSON.stringify({ name: 'Bob', email: null, image: null, verifiedAt: 'now', extra: true })
    const id = safeParseIdentity(raw)
    expect(id).not.toBeNull()
  })
})

describe('IdentitySchema', () => {
  it('requires name field', () => {
    const result = IdentitySchema.safeParse({ email: null, image: null, verifiedAt: 'now' })
    expect(result.success).toBe(false)
  })

  it('allows nullable email and image', () => {
    const result = IdentitySchema.safeParse({ name: 'Test', email: null, image: null, verifiedAt: 'now' })
    expect(result.success).toBe(true)
  })
})
