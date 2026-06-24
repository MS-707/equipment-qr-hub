import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })))
  delete process.env.RESEND_API_KEY
})

const signup = {
  id: 'beta-1',
  name: 'Alice Smith',
  email: 'alice@example.com',
  company: 'ACME',
  role: 'Safety Manager',
  crewSize: '50',
  reason: 'Better PTPs',
  status: 'pending' as const,
  createdAt: '2026-06-23T00:00:00Z',
}

describe('sendBetaEmail', () => {
  it('does nothing when RESEND_API_KEY not set', async () => {
    const { sendBetaEmail } = await import('@/app/api/beta/decide/email')
    await sendBetaEmail(signup, 'approved')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('sends approval email with correct content', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    vi.resetModules()
    const { sendBetaEmail } = await import('@/app/api/beta/decide/email')
    await sendBetaEmail(signup, 'approved')
    expect(fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' })
    )
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    expect(body.to).toBe('alice@example.com')
    expect(body.subject).toContain('Welcome')
    expect(body.text).toContain('Alice')
    expect(body.text).toContain('Pre-Task Plan')
  })

  it('sends rejection email with correct content', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    vi.resetModules()
    const { sendBetaEmail } = await import('@/app/api/beta/decide/email')
    await sendBetaEmail(signup, 'rejected')
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    expect(body.subject).toContain('Update')
    expect(body.text).toContain('not able to include')
  })

  it('handles fetch failure gracefully', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    vi.resetModules()
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
    const { sendBetaEmail } = await import('@/app/api/beta/decide/email')
    await expect(sendBetaEmail(signup, 'approved')).resolves.toBeUndefined()
  })
})
