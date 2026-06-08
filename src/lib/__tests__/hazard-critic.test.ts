import { describe, it, expect } from 'vitest'
import { critique, hintDescriptions } from '../hazard-critic'

describe('critique', () => {
  it('detects missing implications for height work', () => {
    const result = critique([
      { description: 'Working at height on scaffold', riskLevel: 'high', controlMeasure: 'Harness' },
    ])
    expect(result.hints).toContain('dropped')
    expect(result.hints).toContain('slips')
  })

  it('detects missing implications for lifting', () => {
    const result = critique([
      { description: 'Crane lift operation', riskLevel: 'high', controlMeasure: 'Rigging plan' },
    ])
    expect(result.hints).toContain('dropped')
    expect(result.hints).toContain('pinch')
  })

  it('does not flag already-present hazards', () => {
    const result = critique([
      { description: 'Working at height', riskLevel: 'high', controlMeasure: 'Harness' },
      { description: 'Falling object protection', riskLevel: 'medium', controlMeasure: 'Barricade' },
      { description: 'Slip and trip hazards', riskLevel: 'low', controlMeasure: 'Housekeeping' },
    ])
    expect(result.hints).not.toContain('dropped')
    expect(result.hints).not.toContain('slips')
  })

  it('returns empty hints for unrecognized hazards', () => {
    const result = critique([
      { description: 'Something completely unique', riskLevel: 'low', controlMeasure: 'Monitor' },
    ])
    expect(result.hints).toHaveLength(0)
  })

  it('returns empty hints for empty list', () => {
    const result = critique([])
    expect(result.hints).toHaveLength(0)
    expect(result.notes).toHaveLength(0)
  })
})

describe('hintDescriptions', () => {
  it('maps hint keys to human-readable descriptions', () => {
    const descriptions = hintDescriptions(['dropped', 'slips'])
    expect(descriptions).toContain('falling / dropped objects')
    expect(descriptions).toContain('slips, trips & falls')
  })

  it('filters out unknown keys', () => {
    const descriptions = hintDescriptions(['nonexistent'])
    expect(descriptions).toHaveLength(0)
  })
})
