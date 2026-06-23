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
vi.stubGlobal('window', globalThis)

beforeEach(() => {
  for (const k in storage) delete storage[k]
})

import { rememberCrewMember, getCrewRoster, crewRoles } from '@/data/crew'

describe('crewRoles', () => {
  it('includes expected roles', () => {
    expect(crewRoles).toContain('Supervisor')
    expect(crewRoles).toContain('Foreman')
    expect(crewRoles).toContain('Fire Watch')
  })
})

describe('getCrewRoster', () => {
  it('returns empty array when no history', () => {
    expect(getCrewRoster()).toEqual([])
  })
})

describe('rememberCrewMember', () => {
  it('adds a crew member to history', () => {
    rememberCrewMember('Alice', 'Supervisor')
    const roster = getCrewRoster()
    expect(roster.length).toBe(1)
    expect(roster[0].name).toBe('Alice')
    expect(roster[0].role).toBe('Supervisor')
  })

  it('deduplicates by name (case-insensitive)', () => {
    rememberCrewMember('Alice', 'Supervisor')
    rememberCrewMember('alice', 'Foreman')
    const roster = getCrewRoster()
    expect(roster.length).toBe(1)
    expect(roster[0].name).toBe('alice')
    expect(roster[0].role).toBe('Foreman')
  })

  it('moves repeated member to front', () => {
    rememberCrewMember('Alice')
    rememberCrewMember('Bob')
    rememberCrewMember('Alice')
    const roster = getCrewRoster()
    expect(roster[0].name).toBe('Alice')
    expect(roster[1].name).toBe('Bob')
  })

  it('caps history at 30', () => {
    for (let i = 0; i < 35; i++) {
      rememberCrewMember(`Person ${i}`)
    }
    expect(getCrewRoster().length).toBe(30)
  })

  it('omits role when null', () => {
    rememberCrewMember('Alice', null)
    const roster = getCrewRoster()
    expect(roster[0].role).toBeUndefined()
  })
})
