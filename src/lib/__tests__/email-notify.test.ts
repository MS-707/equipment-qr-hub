import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  delete process.env.RESEND_API_KEY
  delete process.env.EHS_NOTIFY_EMAIL
  delete process.env.EHS_NOTIFY_FROM
})

describe('isEmailConfigured', () => {
  it('returns false when RESEND_API_KEY not set', async () => {
    const { isEmailConfigured } = await import('../email-notify')
    expect(isEmailConfigured()).toBe(false)
  })

  it('returns true when RESEND_API_KEY is set', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    vi.resetModules()
    const { isEmailConfigured } = await import('../email-notify')
    expect(isEmailConfigured()).toBe(true)
  })
})

describe('sendEhsNotification', () => {
  it('returns not-configured when API key unset', async () => {
    const { sendEhsNotification } = await import('../email-notify')
    const result = await sendEhsNotification({ subject: 'Test', text: 'Body' })
    expect(result).toBe('not-configured')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('sends email via Resend API and returns sent', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    vi.resetModules()
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)
    const { sendEhsNotification } = await import('../email-notify')
    const result = await sendEhsNotification({ subject: 'EHS Alert', text: 'Something happened' })
    expect(result).toBe('sent')
    expect(fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('EHS Alert'),
      })
    )
  })

  it('uses default recipient and sender', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    vi.resetModules()
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)
    const { sendEhsNotification } = await import('../email-notify')
    await sendEhsNotification({ subject: 'Test', text: 'Body' })
    const callBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    expect(callBody.to).toBe('mark.starr@mytra.ai')
    expect(callBody.from).toContain('onboarding@resend.dev')
  })

  it('uses custom recipient and sender from env', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    process.env.EHS_NOTIFY_EMAIL = 'custom@example.com'
    process.env.EHS_NOTIFY_FROM = 'Sage <sage@mytra.ai>'
    vi.resetModules()
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)
    const { sendEhsNotification } = await import('../email-notify')
    await sendEhsNotification({ subject: 'Test', text: 'Body' })
    const callBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    expect(callBody.to).toBe('custom@example.com')
    expect(callBody.from).toBe('Sage <sage@mytra.ai>')
  })

  it('returns failed on HTTP error', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    vi.resetModules()
    vi.mocked(fetch).mockResolvedValue({ ok: false, text: async () => 'error' } as Response)
    const { sendEhsNotification } = await import('../email-notify')
    const result = await sendEhsNotification({ subject: 'Test', text: 'Body' })
    expect(result).toBe('failed')
  })

  it('returns failed on network error', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    vi.resetModules()
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
    const { sendEhsNotification } = await import('../email-notify')
    const result = await sendEhsNotification({ subject: 'Test', text: 'Body' })
    expect(result).toBe('failed')
  })
})
