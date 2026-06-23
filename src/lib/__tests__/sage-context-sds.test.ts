import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { SdsRecord } from '../sds-types'

// ── Mocks ──────────────────────────────────────────────────

vi.mock('../sds-records', () => ({
  getAllSdsRecords: vi.fn(() => []),
  getSdsById: vi.fn(() => undefined),
}))

vi.mock('../safety-records', () => ({
  getPtpForDate: vi.fn(() => null),
  getActivePermits: vi.fn(() => []),
  getAllSafetyRecords: vi.fn(() => []),
}))

vi.mock('../datetime', () => ({
  localToday: vi.fn(() => '2026-06-23'),
}))

import { buildSageContext, contextToPrompt } from '../sage-context'
import { getAllSdsRecords, getSdsById } from '../sds-records'

// ── Helpers ────────────────────────────────────────────────

function makeSds(overrides: Partial<SdsRecord> = {}): SdsRecord {
  return {
    id: 'SDS-2026-0001',
    productName: 'Portland Cement',
    manufacturer: 'Quikrete',
    casNumbers: ['65997-15-1'],
    signalWord: 'Danger',
    pictograms: ['GHS07', 'GHS08'],
    hazardStatements: ['H315: Causes skin irritation'],
    precautionaryStatements: ['P264: Wash hands after handling'],
    firstAid: {
      inhalation: 'Move to fresh air',
      skin: 'Wash with soap and water',
      eyes: 'Flush with water for 15 minutes',
      ingestion: 'Rinse mouth, do not induce vomiting',
    },
    ppeRequired: ['Safety glasses', 'Gloves'],
    fireExtinguishing: 'Not combustible',
    spillProcedure: 'Sweep up dry material',
    storageHandling: 'Keep dry',
    emergencyPhone: '1-800-555-0100',
    sections: [{ number: 1, title: 'Identification', content: 'Portland Cement' }],
    isFavorite: false,
    createdAt: '2026-06-23T00:00:00.000Z',
    updatedAt: '2026-06-23T00:00:00.000Z',
    syncStatus: 'pending',
    _searchIndex: 'portland cement quikrete',
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(getAllSdsRecords).mockReturnValue([])
  vi.mocked(getSdsById).mockReturnValue(undefined)
})

describe('buildSageContext — sdsSummary (via summarizeSdsLibrary)', () => {
  it('returns null sdsSummary when no SDS records exist', () => {
    const ctx = buildSageContext('/dashboard', 'Alice')
    expect(ctx.sdsSummary).toBeNull()
  })

  it('returns summary with count for a single chemical', () => {
    vi.mocked(getAllSdsRecords).mockReturnValue([makeSds()])
    const ctx = buildSageContext('/dashboard', 'Alice')
    expect(ctx.sdsSummary).toContain('SDS LIBRARY: 1 chemical on site')
  })

  it('pluralizes "chemicals" when more than one record exists', () => {
    vi.mocked(getAllSdsRecords).mockReturnValue([
      makeSds({ id: 'SDS-2026-0001', productName: 'Cement' }),
      makeSds({ id: 'SDS-2026-0002', productName: 'Acetone', signalWord: 'Warning' }),
    ])
    const ctx = buildSageContext('/dashboard', 'Alice')
    expect(ctx.sdsSummary).toContain('2 chemicals on site')
  })

  it('lists DANGER chemicals by product name', () => {
    vi.mocked(getAllSdsRecords).mockReturnValue([
      makeSds({ productName: 'Cement', signalWord: 'Danger' }),
      makeSds({ id: 'SDS-2026-0002', productName: 'Acetone', signalWord: 'Warning' }),
      makeSds({ id: 'SDS-2026-0003', productName: 'Sulfuric Acid', signalWord: 'Danger' }),
    ])
    const ctx = buildSageContext('/dashboard', 'Alice')
    expect(ctx.sdsSummary).toContain('DANGER chemicals: Cement, Sulfuric Acid')
  })

  it('truncates DANGER list at 10 names with "and N more" suffix', () => {
    const records = Array.from({ length: 15 }, (_, i) =>
      makeSds({ id: `SDS-2026-${String(i + 1).padStart(4, '0')}`, productName: `Chemical-${i + 1}`, signalWord: 'Danger' })
    )
    vi.mocked(getAllSdsRecords).mockReturnValue(records)
    const ctx = buildSageContext('/dashboard', 'Alice')
    expect(ctx.sdsSummary).toContain('and 5 more')
    expect(ctx.sdsSummary).toContain('Chemical-10')
    expect(ctx.sdsSummary).not.toContain('Chemical-11')
  })

  it('omits DANGER line when no Danger signal-word chemicals exist', () => {
    vi.mocked(getAllSdsRecords).mockReturnValue([
      makeSds({ signalWord: 'Warning' }),
    ])
    const ctx = buildSageContext('/dashboard', 'Alice')
    expect(ctx.sdsSummary).not.toContain('DANGER')
  })
})

describe('buildSageContext — activeChemicalContext (via summarizeActiveSds)', () => {
  it('returns null activeChemicalContext for non-SDS page URLs', () => {
    vi.mocked(getSdsById).mockReturnValue(makeSds())
    const ctx = buildSageContext('/dashboard', 'Alice')
    expect(ctx.activeChemicalContext).toBeNull()
  })

  it('extracts SDS ID from /sds/[id] URL and populates activeChemicalContext', () => {
    const sds = makeSds({ id: 'SDS-2026-0042' })
    vi.mocked(getSdsById).mockReturnValue(sds)
    const ctx = buildSageContext('/sds/SDS-2026-0042', 'Alice')
    expect(getSdsById).toHaveBeenCalledWith('SDS-2026-0042')
    expect(ctx.activeChemicalContext).toContain('ACTIVE SDS: Portland Cement (Quikrete)')
  })

  it('returns null activeChemicalContext when SDS ID not found', () => {
    vi.mocked(getSdsById).mockReturnValue(undefined)
    const ctx = buildSageContext('/sds/nonexistent', 'Alice')
    expect(ctx.activeChemicalContext).toBeNull()
  })

  it('decodes percent-encoded SDS IDs in URL', () => {
    const sds = makeSds({ id: 'SDS-2026-0001' })
    vi.mocked(getSdsById).mockReturnValue(sds)
    buildSageContext('/sds/SDS-2026-0001?tab=details', 'Alice')
    expect(getSdsById).toHaveBeenCalledWith('SDS-2026-0001')
  })

  it('includes all expected fields in activeChemicalContext', () => {
    const sds = makeSds()
    vi.mocked(getSdsById).mockReturnValue(sds)
    const ctx = buildSageContext('/sds/SDS-2026-0001', 'Alice')
    const text = ctx.activeChemicalContext!
    expect(text).toContain('Signal word: Danger')
    expect(text).toContain('CAS: 65997-15-1')
    expect(text).toContain('PPE required: Safety glasses, Gloves')
    expect(text).toContain('First aid (inhalation): Move to fresh air')
    expect(text).toContain('First aid (skin): Wash with soap and water')
    expect(text).toContain('First aid (eyes): Flush with water for 15 minutes')
    expect(text).toContain('First aid (ingestion): Rinse mouth, do not induce vomiting')
    expect(text).toContain('Emergency phone: 1-800-555-0100')
    expect(text).toContain('Spill response: Sweep up dry material')
  })

  it('omits optional fields when empty', () => {
    const sds = makeSds({
      casNumbers: [],
      ppeRequired: [],
      emergencyPhone: '',
      spillProcedure: '',
    })
    vi.mocked(getSdsById).mockReturnValue(sds)
    const ctx = buildSageContext('/sds/SDS-2026-0001', 'Alice')
    const text = ctx.activeChemicalContext!
    expect(text).not.toContain('CAS:')
    expect(text).not.toContain('PPE required:')
    expect(text).not.toContain('Emergency phone:')
    expect(text).not.toContain('Spill response:')
  })
})

describe('contextToPrompt — SDS integration', () => {
  it('includes sdsSummary in prompt output', () => {
    vi.mocked(getAllSdsRecords).mockReturnValue([makeSds()])
    const ctx = buildSageContext('/dashboard', 'Alice')
    const prompt = contextToPrompt(ctx)
    expect(prompt).toContain('SDS LIBRARY: 1 chemical on site')
  })

  it('includes activeChemicalContext in prompt output', () => {
    vi.mocked(getAllSdsRecords).mockReturnValue([makeSds()])
    vi.mocked(getSdsById).mockReturnValue(makeSds())
    const ctx = buildSageContext('/sds/SDS-2026-0001', 'Alice')
    const prompt = contextToPrompt(ctx)
    expect(prompt).toContain('ACTIVE SDS: Portland Cement (Quikrete)')
    expect(prompt).toContain('SDS LIBRARY:')
  })

  it('omits SDS lines from prompt when no SDS data exists', () => {
    const ctx = buildSageContext('/dashboard', 'Alice')
    const prompt = contextToPrompt(ctx)
    expect(prompt).not.toContain('SDS')
    expect(prompt).not.toContain('ACTIVE SDS')
  })
})
