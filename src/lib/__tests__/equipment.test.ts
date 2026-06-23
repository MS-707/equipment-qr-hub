import { describe, it, expect, vi, beforeEach } from 'vitest'

const storage: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => { storage[k] = v },
  removeItem: (k: string) => { delete storage[k] },
  clear: () => { for (const k in storage) delete storage[k] },
  get length() { return Object.keys(storage).length },
  key: (_i: number) => null as string | null,
})
vi.stubGlobal('window', globalThis)

beforeEach(() => {
  for (const k in storage) delete storage[k]
})

import {
  getAllEquipment,
  getEquipmentById,
  getEquipmentByCategory,
  getCategories,
  searchEquipment,
  updateEquipmentStatus,
} from '@/lib/equipment'

describe('equipment', () => {
  it('getAllEquipment returns sorted array', () => {
    const all = getAllEquipment()
    expect(all.length).toBeGreaterThan(0)
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1].name.localeCompare(all[i].name)).toBeLessThanOrEqual(0)
    }
  })

  it('getEquipmentById returns item for valid number', () => {
    const all = getAllEquipment()
    const first = all[0]
    const found = getEquipmentById(first.itemNumber)
    expect(found).toBeDefined()
    expect(found!.itemNumber).toBe(first.itemNumber)
  })

  it('getEquipmentById returns undefined for invalid number', () => {
    expect(getEquipmentById(999999)).toBeUndefined()
  })

  it('getEquipmentByCategory returns only matching items', () => {
    const cats = getCategories()
    const firstCat = cats[0]
    const items = getEquipmentByCategory(firstCat)
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(item.category).toBe(firstCat)
    }
  })

  it('getCategories returns unique categories', () => {
    const cats = getCategories()
    expect(cats.length).toBeGreaterThan(0)
    expect(new Set(cats).size).toBe(cats.length)
  })

  it('searchEquipment matches by name', () => {
    const all = getAllEquipment()
    const query = all[0].name.split(' ')[0]
    const results = searchEquipment(query)
    expect(results.length).toBeGreaterThan(0)
    expect(results.some(r => r.name.toLowerCase().includes(query.toLowerCase()))).toBe(true)
  })

  it('searchEquipment returns empty for gibberish', () => {
    expect(searchEquipment('zzxzxnonexistent')).toEqual([])
  })

  it('updateEquipmentStatus persists override', () => {
    const all = getAllEquipment()
    const item = all[0]
    updateEquipmentStatus(item.itemNumber, 'Out of Service')
    const updated = getEquipmentById(item.itemNumber)
    expect(updated!.status).toBe('Out of Service')
  })

  it('updateEquipmentStatus removes override when restoring original', () => {
    const all = getAllEquipment()
    const item = all[0]
    const original = item.status
    updateEquipmentStatus(item.itemNumber, 'Out of Service')
    updateEquipmentStatus(item.itemNumber, original)
    const raw = storage['eqr-status-overrides']
    const overrides = raw ? JSON.parse(raw) : {}
    expect(overrides[item.itemNumber]).toBeUndefined()
  })
})
