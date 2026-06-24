import { describe, it, expect } from 'vitest'
import { CHECKLISTS, getChecklist, getAllItems } from '@/data/inspection-checklists'
import type { ChecklistType } from '@/lib/types'

const types: ChecklistType[] = ['electric-forklift', 'scissor-lift', 'walkie-pallet-jack', 'manual-pallet-jack']

describe('CHECKLISTS', () => {
  it('has definitions for all checklist types', () => {
    for (const type of types) {
      expect(CHECKLISTS[type]).toBeDefined()
      expect(CHECKLISTS[type].title).toBeTruthy()
      expect(CHECKLISTS[type].sections.length).toBeGreaterThan(0)
    }
  })
})

describe('getChecklist', () => {
  it('returns checklist for each valid type', () => {
    for (const type of types) {
      const cl = getChecklist(type)
      expect(cl.type).toBe(type)
      expect(cl.sections.length).toBeGreaterThan(0)
    }
  })
})

describe('getAllItems', () => {
  it('returns flat list of items for each type', () => {
    for (const type of types) {
      const items = getAllItems(type)
      expect(items.length).toBeGreaterThan(0)
      expect(items.every(i => typeof i.id === 'string')).toBe(true)
      expect(items.every(i => typeof i.label === 'string')).toBe(true)
    }
  })

  it('includes critical items', () => {
    const items = getAllItems('electric-forklift')
    const hasCritical = items.some(i => i.critical === true)
    expect(hasCritical).toBe(true)
  })

  it('has no duplicate item IDs within a checklist', () => {
    for (const type of types) {
      const items = getAllItems(type)
      const ids = items.map(i => i.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})
