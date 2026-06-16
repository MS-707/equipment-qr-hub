import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('isAdmin', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns true for default admin email', async () => {
    const { isAdmin } = await import('../admin')
    expect(isAdmin('mark.starr@mytra.ai')).toBe(true)
  })

  it('is case-insensitive', async () => {
    const { isAdmin } = await import('../admin')
    expect(isAdmin('Mark.Starr@Mytra.AI')).toBe(true)
  })

  it('trims whitespace', async () => {
    const { isAdmin } = await import('../admin')
    expect(isAdmin('  mark.starr@mytra.ai  ')).toBe(true)
  })

  it('returns false for null', async () => {
    const { isAdmin } = await import('../admin')
    expect(isAdmin(null)).toBe(false)
  })

  it('returns false for undefined', async () => {
    const { isAdmin } = await import('../admin')
    expect(isAdmin(undefined)).toBe(false)
  })

  it('returns false for empty string', async () => {
    const { isAdmin } = await import('../admin')
    expect(isAdmin('')).toBe(false)
  })

  it('returns false for non-admin email', async () => {
    const { isAdmin } = await import('../admin')
    expect(isAdmin('worker@mytra.ai')).toBe(false)
  })

  it('respects ADMIN_EMAILS env var', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'alice@example.com,bob@example.com')
    const { isAdmin } = await import('../admin')
    expect(isAdmin('alice@example.com')).toBe(true)
    expect(isAdmin('bob@example.com')).toBe(true)
    expect(isAdmin('mark.starr@mytra.ai')).toBe(false)
    vi.unstubAllEnvs()
  })
})
