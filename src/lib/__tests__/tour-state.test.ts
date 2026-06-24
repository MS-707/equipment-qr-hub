import { describe, it, expect, vi, beforeEach } from 'vitest'

const storage: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => { storage[k] = v },
  removeItem: (k: string) => { delete storage[k] },
  clear: () => { for (const k in storage) delete storage[k] },
  get length() { return Object.keys(storage).length },
  key: () => null as string | null,
})

beforeEach(() => {
  for (const k in storage) delete storage[k]
})

import { isTourSeen, markTourSeen } from '@/lib/tourState'

describe('tourState', () => {
  it('returns false for unseen module', () => {
    expect(isTourSeen('safety')).toBe(false)
  })

  it('returns true after marking as seen', () => {
    markTourSeen('safety')
    expect(isTourSeen('safety')).toBe(true)
  })

  it('tracks multiple modules independently', () => {
    markTourSeen('safety')
    expect(isTourSeen('safety')).toBe(true)
    expect(isTourSeen('equipment')).toBe(false)
  })

  it('handles corrupted localStorage gracefully', () => {
    storage['sage-module-tours-seen'] = 'not-json'
    expect(isTourSeen('safety')).toBe(false)
  })
})
