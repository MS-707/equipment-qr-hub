import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

beforeEach(() => {
  delete process.env.RESEND_API_KEY
  delete process.env.SLACK_WEBHOOK_URL
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('email-notify', () => {
  it('returns not-configured when RESEND_API_KEY is unset', async () => {
    const { sendEhsNotification } = await import('../email-notify')
    expect(await sendEhsNotification({ subject: 'Test', text: 'Body' })).toBe('not-configured')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('isEmailConfigured returns false without API key', async () => {
    const { isEmailConfigured } = await import('../email-notify')
    expect(isEmailConfigured()).toBe(false)
  })

  it('sends email when configured', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    vi.mocked(fetch).mockResolvedValue({ ok: true, text: async () => '{}' } as Response)
    const { sendEhsNotification } = await import('../email-notify')
    const result = await sendEhsNotification({ subject: 'PTP Submitted', text: 'Details' })
    expect(result).toBe('sent')
    expect(fetch).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
    }))
  })

  it('returns failed on API error', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    vi.mocked(fetch).mockResolvedValue({ ok: false, text: async () => 'error' } as Response)
    const { sendEhsNotification } = await import('../email-notify')
    expect(await sendEhsNotification({ subject: 'Test', text: 'Body' })).toBe('failed')
  })

  it('returns failed on network error', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
    const { sendEhsNotification } = await import('../email-notify')
    expect(await sendEhsNotification({ subject: 'Test', text: 'Body' })).toBe('failed')
  })
})

describe('slack-notify', () => {
  it('returns not-configured when SLACK_WEBHOOK_URL is unset', async () => {
    const { sendSlackMessage } = await import('../slack-notify')
    expect(await sendSlackMessage('Test')).toBe('not-configured')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('isSlackConfigured returns false without URL', async () => {
    const { isSlackConfigured } = await import('../slack-notify')
    expect(isSlackConfigured()).toBe(false)
  })

  it('sends message when configured', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test'
    vi.mocked(fetch).mockResolvedValue({ ok: true, text: async () => 'ok' } as Response)
    const { sendSlackMessage } = await import('../slack-notify')
    const result = await sendSlackMessage('PTP submitted for Site A')
    expect(result).toBe('sent')
    expect(fetch).toHaveBeenCalledWith('https://hooks.slack.com/test', expect.objectContaining({
      method: 'POST',
    }))
  })

  it('returns failed on webhook error', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test'
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500, text: async () => 'error' } as Response)
    const { sendSlackMessage } = await import('../slack-notify')
    expect(await sendSlackMessage('Test')).toBe('failed')
  })

  it('returns failed on network error', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test'
    vi.mocked(fetch).mockRejectedValue(new Error('Connection refused'))
    const { sendSlackMessage } = await import('../slack-notify')
    expect(await sendSlackMessage('Test')).toBe('failed')
  })
})
