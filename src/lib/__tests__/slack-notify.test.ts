import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  delete process.env.SLACK_WEBHOOK_URL
})

describe('isSlackConfigured', () => {
  it('returns false when SLACK_WEBHOOK_URL not set', async () => {
    const { isSlackConfigured } = await import('../slack-notify')
    expect(isSlackConfigured()).toBe(false)
  })

  it('returns true when SLACK_WEBHOOK_URL is set', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test'
    vi.resetModules()
    const { isSlackConfigured } = await import('../slack-notify')
    expect(isSlackConfigured()).toBe(true)
  })
})

describe('sendSlackMessage', () => {
  it('returns not-configured when URL unset', async () => {
    const { sendSlackMessage } = await import('../slack-notify')
    const result = await sendSlackMessage('test')
    expect(result).toBe('not-configured')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('sends message and returns sent on success', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test'
    vi.resetModules()
    vi.mocked(fetch).mockResolvedValue({ ok: true, text: async () => 'ok' } as Response)
    const { sendSlackMessage } = await import('../slack-notify')
    const result = await sendSlackMessage('Hello from Sage EHS')
    expect(result).toBe('sent')
    expect(fetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/test',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Hello from Sage EHS'),
      })
    )
  })

  it('returns failed on HTTP error', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test'
    vi.resetModules()
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500, text: async () => 'error' } as Response)
    const { sendSlackMessage } = await import('../slack-notify')
    const result = await sendSlackMessage('test')
    expect(result).toBe('failed')
  })

  it('returns failed on network error', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test'
    vi.resetModules()
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
    const { sendSlackMessage } = await import('../slack-notify')
    const result = await sendSlackMessage('test')
    expect(result).toBe('failed')
  })
})
