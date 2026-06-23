import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

import { getServerSession } from 'next-auth/next'

beforeEach(() => {
  vi.mocked(getServerSession).mockReset()
})

describe('requireSession', () => {
  it('returns session when authenticated', async () => {
    const session = { user: { email: 'test@x.com', name: 'Test', image: null }, expires: '' }
    vi.mocked(getServerSession).mockResolvedValue(session)
    const { requireSession } = await import('../api-auth')
    const result = await requireSession()
    expect(result.session).toBe(session)
    expect(result.error).toBeNull()
  })

  it('returns 401 error when no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { requireSession } = await import('../api-auth')
    const result = await requireSession()
    expect(result.session).toBeNull()
    expect(result.error).toBeTruthy()
    expect(result.error!.status).toBe(401)
  })

  it('returns 401 when session has no email', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: null, name: 'Test' }, expires: '' })
    const { requireSession } = await import('../api-auth')
    const result = await requireSession()
    expect(result.session).toBeNull()
    expect(result.error!.status).toBe(401)
  })
})
