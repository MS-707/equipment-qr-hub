import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let store: Record<string, string> = {}

vi.stubGlobal('window', globalThis)
vi.stubGlobal('localStorage', {
  getItem: vi.fn((k: string) => store[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { store[k] = v }),
  removeItem: vi.fn((k: string) => { delete store[k] }),
})

import {
  setCurrentIdentity,
  getCurrentIdentity,
  isIdentityStale,
  clearCurrentIdentity,
  CURRENT_USER_KEY,
} from '../identity'

beforeEach(() => {
  store = {}
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-23T12:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('setCurrentIdentity', () => {
  it('persists identity to localStorage', () => {
    setCurrentIdentity({ name: 'Alice', email: 'alice@example.com', image: null })
    const raw = store[CURRENT_USER_KEY]
    expect(raw).toBeDefined()
    const parsed = JSON.parse(raw)
    expect(parsed.name).toBe('Alice')
    expect(parsed.email).toBe('alice@example.com')
    expect(parsed.verifiedAt).toBe('2026-06-23T12:00:00.000Z')
  })

  it('defaults email and image to null when omitted', () => {
    setCurrentIdentity({ name: 'Bob' })
    const parsed = JSON.parse(store[CURRENT_USER_KEY])
    expect(parsed.email).toBeNull()
    expect(parsed.image).toBeNull()
  })
})

describe('getCurrentIdentity', () => {
  it('returns null when no identity stored', () => {
    expect(getCurrentIdentity()).toBeNull()
  })

  it('returns identity when valid JSON stored', () => {
    store[CURRENT_USER_KEY] = JSON.stringify({
      name: 'Carol',
      email: 'carol@example.com',
      image: null,
      verifiedAt: '2026-06-23T12:00:00.000Z',
    })
    const id = getCurrentIdentity()
    expect(id?.name).toBe('Carol')
    expect(id?.email).toBe('carol@example.com')
  })

  it('returns null for invalid JSON', () => {
    store[CURRENT_USER_KEY] = '{broken'
    expect(getCurrentIdentity()).toBeNull()
  })

  it('returns null for schema-invalid data', () => {
    store[CURRENT_USER_KEY] = JSON.stringify({ wrong: 'shape' })
    expect(getCurrentIdentity()).toBeNull()
  })
})

describe('isIdentityStale', () => {
  it('returns true when no identity exists', () => {
    expect(isIdentityStale()).toBe(true)
  })

  it('returns false for a fresh identity', () => {
    setCurrentIdentity({ name: 'Dave', email: 'd@x.com' })
    expect(isIdentityStale()).toBe(false)
  })

  it('returns true after 72 hours', () => {
    setCurrentIdentity({ name: 'Eve', email: 'e@x.com' })
    vi.advanceTimersByTime(72 * 60 * 60 * 1000 + 1)
    expect(isIdentityStale()).toBe(true)
  })

  it('returns false just before 72 hours', () => {
    setCurrentIdentity({ name: 'Frank', email: 'f@x.com' })
    vi.advanceTimersByTime(72 * 60 * 60 * 1000 - 1000)
    expect(isIdentityStale()).toBe(false)
  })
})

describe('clearCurrentIdentity', () => {
  it('removes identity from localStorage', () => {
    setCurrentIdentity({ name: 'Grace', email: 'g@x.com' })
    expect(store[CURRENT_USER_KEY]).toBeDefined()
    clearCurrentIdentity()
    expect(store[CURRENT_USER_KEY]).toBeUndefined()
  })
})
