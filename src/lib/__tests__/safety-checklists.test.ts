import { describe, it, expect } from 'vitest'
import { PPE_OPTIONS, ppeLabel, buildPermitItems } from '@/data/safety-checklists'

describe('ppeLabel', () => {
  it('returns label for known PPE id', () => {
    expect(ppeLabel('hard-hat')).toBe('Hard hat')
    expect(ppeLabel('harness')).toBe('Fall-arrest harness')
  })

  it('returns the id as fallback for unknown ids', () => {
    expect(ppeLabel('unknown-ppe')).toBe('unknown-ppe')
  })
})

describe('PPE_OPTIONS', () => {
  it('has at least 10 options', () => {
    expect(PPE_OPTIONS.length).toBeGreaterThanOrEqual(10)
  })

  it('all options have id and label', () => {
    for (const opt of PPE_OPTIONS) {
      expect(opt.id).toBeTruthy()
      expect(opt.label).toBeTruthy()
    }
  })

  it('has no duplicate ids', () => {
    const ids = PPE_OPTIONS.map(o => o.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('buildPermitItems', () => {
  it('returns checklist for height permits', () => {
    const items = buildPermitItems('height')
    expect(items.length).toBeGreaterThan(0)
    expect(items.every(i => typeof i.label === 'string')).toBe(true)
    expect(items.every(i => i.checked === false)).toBe(true)
  })

  it('returns checklist for hot-work permits', () => {
    const items = buildPermitItems('hot-work')
    expect(items.length).toBeGreaterThan(0)
  })

  it('returns checklist for confined-space permits', () => {
    const items = buildPermitItems('confined-space')
    expect(items.length).toBeGreaterThan(0)
  })
})
