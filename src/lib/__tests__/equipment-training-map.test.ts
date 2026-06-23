import { describe, it, expect } from 'vitest'
import { equipmentTrainingMap, getTrainingForEquipment } from '@/data/equipment-training-map'

describe('equipmentTrainingMap', () => {
  it('has entries for all 9 training programs', () => {
    expect(Object.keys(equipmentTrainingMap).length).toBe(9)
  })

  it('all entries have non-empty equipment arrays', () => {
    for (const [key, items] of Object.entries(equipmentTrainingMap)) {
      expect(items.length, `${key} should have items`).toBeGreaterThan(0)
    }
  })
})

describe('getTrainingForEquipment', () => {
  it('returns training programs for equipment in TP-01', () => {
    const programs = getTrainingForEquipment(1)
    expect(programs).toContain('TP-01')
  })

  it('returns multiple programs for shared equipment', () => {
    const programs = getTrainingForEquipment(28)
    expect(programs).toContain('TP-01')
    expect(programs).toContain('TP-03')
  })

  it('returns empty array for unknown equipment', () => {
    expect(getTrainingForEquipment(9999)).toEqual([])
  })
})
