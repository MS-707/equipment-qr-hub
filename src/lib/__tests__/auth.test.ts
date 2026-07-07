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

import { isAdmin } from '@/lib/admin'

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

describe('dev provider registration (DM-6: first-run sign-in out of the box)', () => {
  // next-auth v4 keeps user overrides in provider.options until runtime merge
  type P = { id: string; options?: { id?: string } }
  const providerIds = (providers: unknown[]) =>
    (providers as P[]).map((p) => p.options?.id ?? p.id)
  it('registers the dev provider with NO Google config and NO ALLOW_DEV_LOGIN (zero-config first run)', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', '')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '')
    vi.stubEnv('ALLOW_DEV_LOGIN', '')
    const { authOptions } = await import('../auth')
    expect(authOptions.providers.length).toBeGreaterThan(0)
    expect(providerIds(authOptions.providers)).toContain('dev')
  })

  it('respects the ALLOW_DEV_LOGIN=0 opt-out even without Google config', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', '')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '')
    vi.stubEnv('ALLOW_DEV_LOGIN', '0')
    const { authOptions } = await import('../auth')
    expect(providerIds(authOptions.providers)).not.toContain('dev')
  })

  it('still registers the dev provider when explicitly enabled alongside Google', async () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'x')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'y')
    vi.stubEnv('ALLOW_DEV_LOGIN', '1')
    const { authOptions } = await import('../auth')
    expect(providerIds(authOptions.providers)).toContain('google')
    expect(providerIds(authOptions.providers)).toContain('dev')
  })

  it('NEVER registers credentials providers in production without flags (hard gate preserved)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('GOOGLE_CLIENT_ID', '')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '')
    vi.stubEnv('ALLOW_DEV_LOGIN', '')
    vi.stubEnv('ALLOW_EMAIL_LOGIN', '')
    const { authOptions } = await import('../auth')
    expect(authOptions.providers.length).toBe(0)
  })

  it('production ignores even an explicit ALLOW_DEV_LOGIN=1', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('GOOGLE_CLIENT_ID', '')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '')
    vi.stubEnv('ALLOW_DEV_LOGIN', '1')
    const { authOptions } = await import('../auth')
    expect(providerIds(authOptions.providers)).not.toContain('dev')
  })
})

describe('shared-code login cannot mint elevated sessions in production (EN-M4-TX1)', () => {
  type P = { options?: { id?: string; authorize?: (c: Record<string, string>) => Promise<unknown> } }
  const getAuthorize = async () => {
    const { authOptions } = await import('../auth')
    const dev = (authOptions.providers as P[]).find((p) => p.options?.id === 'dev')
    return dev!.options!.authorize!
  }

  // The block engages only when Google OAuth is configured (a stronger
  // alternative exists). All three "rejects" cases therefore set Google.
  const withGoogle = () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'x')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'y')
  }

  it('rejects an ADMIN_EMAILS address with the correct shared code (Google configured)', async () => {
    // this file mocks @/lib/admin — make the mock recognize the admin
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.stubEnv('NODE_ENV', 'production')
    withGoogle()
    vi.stubEnv('ALLOW_EMAIL_LOGIN', '1')
    vi.stubEnv('EMAIL_LOGIN_CODE', 'sitecode')
    const authorize = await getAuthorize()
    const user = await authorize({ name: 'Impostor', email: 'mark.starr@mytra.ai', code: 'sitecode' })
    expect(user).toBeNull()
  })

  it('rejects an EHS_EMAILS address with the correct shared code (Google configured)', async () => {
    vi.mocked(isAdmin).mockReturnValue(false)
    vi.stubEnv('NODE_ENV', 'production')
    withGoogle()
    vi.stubEnv('ALLOW_EMAIL_LOGIN', '1')
    vi.stubEnv('EMAIL_LOGIN_CODE', 'sitecode')
    vi.stubEnv('EHS_EMAILS', 'safety@mytra.ai')
    const authorize = await getAuthorize()
    const user = await authorize({ name: 'Impostor', email: 'safety@mytra.ai', code: 'sitecode' })
    expect(user).toBeNull()
  })

  it('ALLOWS an admin via shared code when NO OAuth is configured (pre-SSO demo — no alternative door)', async () => {
    vi.mocked(isAdmin).mockReturnValue(true)
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('GOOGLE_CLIENT_ID', '')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '')
    vi.stubEnv('ALLOW_EMAIL_LOGIN', '1')
    vi.stubEnv('EMAIL_LOGIN_CODE', 'sitecode')
    const authorize = await getAuthorize()
    const user = await authorize({ name: 'Mark Starr', email: 'mark.starr@mytra.ai', code: 'sitecode' })
    expect(user).toMatchObject({ email: 'mark.starr@mytra.ai' })
  })

  it('still authenticates a worker address with the correct shared code', async () => {
    vi.mocked(isAdmin).mockReturnValue(false)
    vi.stubEnv('NODE_ENV', 'production')
    withGoogle()
    vi.stubEnv('ALLOW_EMAIL_LOGIN', '1')
    vi.stubEnv('EMAIL_LOGIN_CODE', 'sitecode')
    const authorize = await getAuthorize()
    const user = await authorize({ name: 'Dana', email: 'dana@mytra.ai', code: 'sitecode' })
    expect(user).toMatchObject({ email: 'dana@mytra.ai' })
  })

  it('elevated addresses may still use dev login in development', async () => {
    vi.mocked(isAdmin).mockReturnValue(false)
    vi.stubEnv('GOOGLE_CLIENT_ID', '')
    vi.stubEnv('ALLOW_DEV_LOGIN', '')
    const authorize = await getAuthorize()
    const user = await authorize({ name: 'Mark', email: 'mark.starr@mytra.ai', code: '' })
    expect(user).toMatchObject({ email: 'mark.starr@mytra.ai' })
  })
})
