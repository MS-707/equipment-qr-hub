import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/user-tracker', () => ({
  isFirstLogin: vi.fn(() => Promise.resolve(false)),
}))
vi.mock('@/lib/slack-notify', () => ({
  sendSlackMessage: vi.fn(() => Promise.resolve()),
  escapeSlack: vi.fn((s: string) => s),
}))
vi.mock('@/lib/admin', () => ({
  isAdmin: vi.fn(() => false),
}))

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
})

describe('emailAllowed', () => {
  it('returns true for default domain (mytra.ai)', async () => {
    const { emailAllowed } = await import('../auth')
    expect(emailAllowed('alice@mytra.ai')).toBe(true)
  })

  it('returns false for non-allowed domain', async () => {
    const { emailAllowed } = await import('../auth')
    expect(emailAllowed('alice@gmail.com')).toBe(false)
  })

  it('returns false for null', async () => {
    const { emailAllowed } = await import('../auth')
    expect(emailAllowed(null)).toBe(false)
  })

  it('returns false for undefined', async () => {
    const { emailAllowed } = await import('../auth')
    expect(emailAllowed(undefined)).toBe(false)
  })

  it('returns false for empty string', async () => {
    const { emailAllowed } = await import('../auth')
    expect(emailAllowed('')).toBe(false)
  })

  it('returns false for email without @', async () => {
    const { emailAllowed } = await import('../auth')
    expect(emailAllowed('alice')).toBe(false)
  })

  it('respects ALLOWED_EMAIL_DOMAINS env var', async () => {
    vi.stubEnv('ALLOWED_EMAIL_DOMAINS', 'example.com,test.org')
    const { emailAllowed } = await import('../auth')
    expect(emailAllowed('alice@example.com')).toBe(true)
    expect(emailAllowed('bob@test.org')).toBe(true)
    expect(emailAllowed('charlie@mytra.ai')).toBe(false)
  })
})

describe('authConfigFlags', () => {
  it('has expected shape', async () => {
    const { authConfigFlags } = await import('../auth')
    expect(authConfigFlags).toHaveProperty('hasGoogle')
    expect(authConfigFlags).toHaveProperty('allowDevLogin')
    expect(typeof authConfigFlags.hasGoogle).toBe('boolean')
    expect(typeof authConfigFlags.allowDevLogin).toBe('boolean')
  })

  it('hasGoogle is false without env vars', async () => {
    const { authConfigFlags } = await import('../auth')
    expect(authConfigFlags.hasGoogle).toBe(false)
  })
})

describe('authOptions', () => {
  it('has session strategy jwt', async () => {
    const { authOptions } = await import('../auth')
    expect(authOptions.session?.strategy).toBe('jwt')
  })

  it('has signIn page set to /safety', async () => {
    const { authOptions } = await import('../auth')
    expect(authOptions.pages?.signIn).toBe('/safety')
  })

  it('includes signIn callback', async () => {
    const { authOptions } = await import('../auth')
    expect(authOptions.callbacks?.signIn).toBeDefined()
  })

  it('includes session callback', async () => {
    const { authOptions } = await import('../auth')
    expect(authOptions.callbacks?.session).toBeDefined()
  })
})
