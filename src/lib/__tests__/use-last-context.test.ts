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

import { getLastContext, saveLastContext } from '@/lib/use-last-context'

describe('getLastContext', () => {
  it('returns empty object when nothing stored', () => {
    expect(getLastContext()).toEqual({})
  })

  it('returns stored context', () => {
    storage['last-context'] = JSON.stringify({ projectName: 'Site A', location: 'Bay 1' })
    expect(getLastContext()).toEqual({ projectName: 'Site A', location: 'Bay 1' })
  })

  it('returns empty object for corrupted data', () => {
    storage['last-context'] = 'not-json'
    expect(getLastContext()).toEqual({})
  })
})

describe('saveLastContext', () => {
  it('saves project name', () => {
    saveLastContext({ projectName: 'Site B' })
    expect(getLastContext().projectName).toBe('Site B')
  })

  it('merges with existing context', () => {
    saveLastContext({ projectName: 'Site A' })
    saveLastContext({ location: 'Bay 2' })
    const ctx = getLastContext()
    expect(ctx.projectName).toBe('Site A')
    expect(ctx.location).toBe('Bay 2')
  })

  it('ignores empty/whitespace-only values', () => {
    saveLastContext({ projectName: 'Site A' })
    saveLastContext({ projectName: '  ' })
    expect(getLastContext().projectName).toBe('Site A')
  })

  it('trims values', () => {
    saveLastContext({ shift: '  Night  ' })
    expect(getLastContext().shift).toBe('Night')
  })
})
