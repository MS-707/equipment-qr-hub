import { describe, it, expect } from 'vitest'
import {
  requiresPreTrip,
  getChecklistType,
  requiresMachineGuarding,
} from '@/lib/types'
import type { EquipmentItem } from '@/lib/types'

function makeItem(overrides: Partial<EquipmentItem>): EquipmentItem {
  return {
    id: 1,
    name: 'Test Equipment',
    category: 'Powered Industrial Trucks',
    status: 'Active',
    department: 'Warehouse',
    calOshaSections: [],
    ...overrides,
  } as EquipmentItem
}

describe('requiresPreTrip', () => {
  it('returns true for Powered Industrial Trucks', () => {
    expect(requiresPreTrip(makeItem({ category: 'Powered Industrial Trucks' }))).toBe(true)
  })

  it('returns true for Aerial Work Platforms', () => {
    expect(requiresPreTrip(makeItem({ category: 'Aerial Work Platforms' }))).toBe(true)
  })

  it('returns false for other categories', () => {
    expect(requiresPreTrip(makeItem({ category: 'Cranes' as EquipmentItem['category'] }))).toBe(false)
  })
})

describe('getChecklistType', () => {
  it('returns scissor-lift for Aerial Work Platforms', () => {
    expect(getChecklistType(makeItem({ category: 'Aerial Work Platforms' }))).toBe('scissor-lift')
  })

  it('returns manual-pallet-jack for manual pallet jacks', () => {
    expect(getChecklistType(makeItem({ name: 'Manual Pallet Jack' }))).toBe('manual-pallet-jack')
  })

  it('returns manual-pallet-jack for hydraulic pallet jacks', () => {
    expect(getChecklistType(makeItem({ name: 'Hydraulic Pallet Jack' }))).toBe('manual-pallet-jack')
  })

  it('returns walkie-pallet-jack for walkie stackers', () => {
    expect(getChecklistType(makeItem({ name: 'Walkie Stacker' }))).toBe('walkie-pallet-jack')
  })

  it('returns walkie-pallet-jack for pallet jacks', () => {
    expect(getChecklistType(makeItem({ name: 'Electric Pallet Jack' }))).toBe('walkie-pallet-jack')
  })

  it('returns electric-forklift as default', () => {
    expect(getChecklistType(makeItem({ name: 'Reach Truck' }))).toBe('electric-forklift')
  })
})

describe('requiresMachineGuarding', () => {
  it('returns true for section 3556', () => {
    expect(requiresMachineGuarding(makeItem({ calOshaSections: ['3556'] }))).toBe(true)
  })

  it('returns true for section 3577', () => {
    expect(requiresMachineGuarding(makeItem({ calOshaSections: ['3577'] }))).toBe(true)
  })

  it('returns false for other sections', () => {
    expect(requiresMachineGuarding(makeItem({ calOshaSections: ['3200'] }))).toBe(false)
  })

  it('returns false for empty sections', () => {
    expect(requiresMachineGuarding(makeItem({ calOshaSections: [] }))).toBe(false)
  })
})
