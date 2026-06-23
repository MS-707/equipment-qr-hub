import { describe, it, expect } from 'vitest'
import { SdsRecordSchema, safeParseSdsRecords } from '../sds-schemas'

const validRecord = {
  id: 'SDS-2026-0001',
  productName: 'Portland Cement',
  manufacturer: 'Quikrete',
  casNumbers: ['65997-15-1'],
  signalWord: 'Danger',
  pictograms: ['GHS07', 'GHS08'],
  hazardStatements: ['H315: Causes skin irritation'],
  precautionaryStatements: ['P264: Wash hands after handling'],
  firstAid: { inhalation: 'Move to fresh air', skin: 'Wash with soap', eyes: 'Flush with water', ingestion: 'Rinse mouth' },
  ppeRequired: ['Safety glasses', 'Gloves'],
  fireExtinguishing: 'Not combustible',
  spillProcedure: 'Sweep up',
  storageHandling: 'Keep dry',
  emergencyPhone: '1-800-555-0100',
  sections: [{ number: 1, title: 'Identification', content: 'Portland Cement' }],
  isFavorite: false,
  createdAt: '2026-06-23T00:00:00.000Z',
  updatedAt: '2026-06-23T00:00:00.000Z',
  syncStatus: 'pending' as const,
  _searchIndex: 'portland cement quikrete 65997-15-1',
}

describe('SdsRecordSchema', () => {
  it('accepts a valid SDS record', () => {
    const result = SdsRecordSchema.safeParse(validRecord)
    expect(result.success).toBe(true)
  })

  it('rejects record with missing productName', () => {
    const invalid = { ...validRecord } as Record<string, unknown>
    delete invalid.productName
    const result = SdsRecordSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects invalid signalWord', () => {
    const result = SdsRecordSchema.safeParse({ ...validRecord, signalWord: 'Critical' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid pictogram code', () => {
    const result = SdsRecordSchema.safeParse({ ...validRecord, pictograms: ['GHS99'] })
    expect(result.success).toBe(false)
  })

  it('rejects invalid syncStatus', () => {
    const result = SdsRecordSchema.safeParse({ ...validRecord, syncStatus: 'unknown' })
    expect(result.success).toBe(false)
  })

  it('accepts notionPageId as optional string', () => {
    const result = SdsRecordSchema.safeParse({ ...validRecord, notionPageId: 'np-123' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.notionPageId).toBe('np-123')
  })

  it('accepts notionPageId as null', () => {
    const result = SdsRecordSchema.safeParse({ ...validRecord, notionPageId: null })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.notionPageId).toBeNull()
  })

  it('accepts record without notionPageId', () => {
    const result = SdsRecordSchema.safeParse(validRecord)
    expect(result.success).toBe(true)
  })

  it('allows extra fields via passthrough', () => {
    const result = SdsRecordSchema.safeParse({ ...validRecord, futureField: true })
    expect(result.success).toBe(true)
    if (result.success) {
      expect((result.data as Record<string, unknown>).futureField).toBe(true)
    }
  })
})

describe('safeParseSdsRecords', () => {
  it('parses valid JSON array', () => {
    const result = safeParseSdsRecords(JSON.stringify([validRecord]))
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('SDS-2026-0001')
  })

  it('drops invalid records and keeps valid ones', () => {
    const invalid = { id: 'bad', productName: 123 }
    const result = safeParseSdsRecords(JSON.stringify([validRecord, invalid]))
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('SDS-2026-0001')
  })

  it('returns empty array for non-array JSON', () => {
    expect(safeParseSdsRecords('{}')).toEqual([])
  })

  it('returns empty array for invalid JSON', () => {
    expect(safeParseSdsRecords('not json')).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(safeParseSdsRecords('')).toEqual([])
  })

  it('returns empty array for empty array', () => {
    expect(safeParseSdsRecords('[]')).toEqual([])
  })
})
