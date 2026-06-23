import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { SdsRecordSchema } from '@/lib/sds-schemas'

// The seed file ships as SdsInput[] (no id/timestamps/syncStatus/_searchIndex —
// seedSdsIfNeeded stamps those at load time). To validate against the full
// SdsRecordSchema we replicate that stamping, exactly as the loader does.
const seedRaw = readFileSync(join(process.cwd(), 'public', 'sds', 'seed.json'), 'utf8')
const seeds = JSON.parse(seedRaw) as Record<string, unknown>[]

function stamp(s: Record<string, unknown>, i: number) {
  return {
    id: `SDS-TEST-${String(i).padStart(4, '0')}`,
    ...s,
    isFavorite: false,
    createdAt: '2026-06-23T00:00:00.000Z',
    updatedAt: '2026-06-23T00:00:00.000Z',
    syncStatus: 'synced' as const,
    _searchIndex: '',
  }
}

describe('SDS seed data (Mytra chemical inventory)', () => {
  it('parses as a non-empty array', () => {
    expect(Array.isArray(seeds)).toBe(true)
    expect(seeds.length).toBeGreaterThanOrEqual(70)
  })

  it('every seed record passes the full SdsRecordSchema after loader stamping', () => {
    const failures: string[] = []
    seeds.forEach((s, i) => {
      const result = SdsRecordSchema.safeParse(stamp(s, i))
      if (!result.success) {
        failures.push(`idx ${i} (${s.productName}): ${result.error.issues[0]?.path.join('.')} — ${result.error.issues[0]?.message}`)
      }
    })
    expect(failures, failures.join('\n')).toHaveLength(0)
  })

  it('every record has all 16 GHS sections numbered 1-16', () => {
    for (const s of seeds) {
      const sections = s.sections as { number: number }[]
      expect(sections).toHaveLength(16)
      expect(sections.map((x) => x.number)).toEqual([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16])
    }
  })

  it('signal words are valid GHS values', () => {
    for (const s of seeds) {
      expect(['Danger', 'Warning', 'None']).toContain(s.signalWord)
    }
  })

  it('product names are unique', () => {
    const names = seeds.map((s) => s.productName)
    expect(new Set(names).size).toBe(names.length)
  })

  it('flags safety-critical products that must not be silently dropped', () => {
    const names = seeds.map((s) => String(s.productName).toLowerCase())
    // Leaded solder is a Prop 65 carcinogen/repro toxicant — must be present.
    expect(names.some((n) => n.includes('sn60pb40'))).toBe(true)
    // Crystalline-silica products must be present.
    expect(names.some((n) => n.includes('floor patch') || n.includes('siding sealant'))).toBe(true)
  })
})
