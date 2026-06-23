import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-auth', () => ({
  requireSession: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => Promise.resolve({ ok: true, retryAfter: 0 })),
}))
vi.mock('@/lib/email-notify', () => ({
  isEmailConfigured: vi.fn(() => false),
  sendEhsNotification: vi.fn(() => Promise.resolve('not-configured')),
}))
vi.mock('@/lib/review-token', () => ({
  createReviewToken: vi.fn((id: string, action: string) => `mock-token-${id}-${action}`),
}))
vi.mock('@/lib/review-store', () => ({
  storeReviewSubmission: vi.fn(() => Promise.resolve({ recordId: 'PTP-001', status: 'pending' })),
}))
vi.mock('@/lib/record-share', () => ({
  buildRecordSubject: vi.fn(() => 'Test Subject'),
  buildRecordText: vi.fn(() => 'Test body text'),
}))

import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'
import { isEmailConfigured, sendEhsNotification } from '@/lib/email-notify'
import { storeReviewSubmission } from '@/lib/review-store'

beforeEach(() => {
  vi.mocked(requireSession).mockResolvedValue({
    session: { user: { email: 'test@x.com', name: 'Test', image: null }, expires: '' },
    error: null,
  })
  vi.mocked(rateLimit).mockResolvedValue({ ok: true, retryAfter: 0 })
  vi.mocked(isEmailConfigured).mockReturnValue(false)
  vi.mocked(sendEhsNotification).mockResolvedValue('not-configured')
  vi.mocked(storeReviewSubmission).mockResolvedValue({ recordId: 'PTP-001', status: 'pending' } as never)
  vi.stubGlobal('fetch', vi.fn())
  delete process.env.NEXT_PUBLIC_EHS_REVIEW
  delete process.env.NOTION_API_KEY
  delete process.env.SLACK_EHS_WEBHOOK_URL
  delete process.env.RESEND_API_KEY
  delete process.env.NOTION_PTP_DB_ID
})

const minRecord = {
  id: 'PTP-2026-0001',
  type: 'ptp',
  projectName: 'Test Project',
  location: 'Site A',
  createdBy: 'Alice',
  createdByEmail: 'alice@example.com',
  createdAt: '2026-06-23T00:00:00Z',
}

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/safety/review/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/safety/review/submit', () => {
  it('returns 404 when EHS review is disabled', async () => {
    const { POST } = await import('@/app/api/safety/review/submit/route')
    const res = await POST(makeReq({ record: minRecord }))
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toContain('not enabled')
  })

  it('returns 401 when unauthenticated', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    vi.mocked(requireSession).mockResolvedValue({
      session: null,
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const { POST } = await import('@/app/api/safety/review/submit/route')
    const res = await POST(makeReq({ record: minRecord }))
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    vi.mocked(rateLimit).mockResolvedValue({ ok: false, retryAfter: 15 })
    const { POST } = await import('@/app/api/safety/review/submit/route')
    const res = await POST(makeReq({ record: minRecord }))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('15')
  })

  it('returns 503 when no delivery channel configured', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    const { POST } = await import('@/app/api/safety/review/submit/route')
    const res = await POST(makeReq({ record: minRecord }))
    expect(res.status).toBe(503)
    const data = await res.json()
    expect(data.error).toContain('No EHS notification channel')
  })

  it('returns 400 for invalid JSON body', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    process.env.SLACK_EHS_WEBHOOK_URL = 'https://hooks.slack.com/test'
    const { POST } = await import('@/app/api/safety/review/submit/route')
    const res = await POST(new Request('http://localhost/api/safety/review/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when record missing id or type', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    process.env.SLACK_EHS_WEBHOOK_URL = 'https://hooks.slack.com/test'
    const { POST } = await import('@/app/api/safety/review/submit/route')
    const res = await POST(makeReq({ record: { id: '' } }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Missing record')
  })

  it('returns 400 for invalid Notion page ID format', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    process.env.SLACK_EHS_WEBHOOK_URL = 'https://hooks.slack.com/test'
    const { POST } = await import('@/app/api/safety/review/submit/route')
    const res = await POST(makeReq({ record: minRecord, notionPageId: 'not-a-uuid' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Invalid Notion page ID')
  })

  it('succeeds with Slack-only delivery', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    process.env.SLACK_EHS_WEBHOOK_URL = 'https://hooks.slack.com/test'
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)
    const { POST } = await import('@/app/api/safety/review/submit/route')
    const res = await POST(makeReq({ record: minRecord, notionPageId: null }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(storeReviewSubmission).toHaveBeenCalled()
  })

  it('succeeds with email-only delivery', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    vi.mocked(isEmailConfigured).mockReturnValue(true)
    vi.mocked(sendEhsNotification).mockResolvedValue('sent')
    const { POST } = await import('@/app/api/safety/review/submit/route')
    const res = await POST(makeReq({ record: minRecord, notionPageId: null }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.emailed).toBe(true)
  })

  it('succeeds with Notion-only delivery using existing pageId', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    process.env.NOTION_API_KEY = 'ntn_test'
    const validNotionId = '12345678-1234-1234-1234-123456789abc'
    vi.mocked(fetch).mockResolvedValue({ ok: true, text: async () => '' } as Response)
    const { POST } = await import('@/app/api/safety/review/submit/route')
    const res = await POST(makeReq({ record: minRecord, notionPageId: validNotionId }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.notionPageId).toBe(validNotionId)
  })

  it('returns 502 when all delivery channels fail', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    process.env.SLACK_EHS_WEBHOOK_URL = 'https://hooks.slack.com/test'
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response)
    const { POST } = await import('@/app/api/safety/review/submit/route')
    const res = await POST(makeReq({ record: minRecord, notionPageId: null }))
    expect(res.status).toBe(502)
    const data = await res.json()
    expect(data.error).toContain('Failed to deliver')
  })

  it('succeeds with Notion sync when no pageId provided', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    process.env.NOTION_API_KEY = 'ntn_test'
    process.env.NOTION_PTP_DB_ID = 'db-123'
    vi.resetModules()
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'new-page-id' }) } as Response)
      .mockResolvedValueOnce({ ok: true, text: async () => '' } as Response)
    const { POST } = await import('@/app/api/safety/review/submit/route')
    const res = await POST(makeReq({ record: minRecord, notionPageId: null }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.notionPageId).toBe('new-page-id')
  })

  it('stores review submission with correct fields', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    process.env.SLACK_EHS_WEBHOOK_URL = 'https://hooks.slack.com/test'
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)
    const { POST } = await import('@/app/api/safety/review/submit/route')
    await POST(makeReq({ record: minRecord, notionPageId: null }))
    expect(storeReviewSubmission).toHaveBeenCalledWith(expect.objectContaining({
      recordId: 'PTP-2026-0001',
      recordType: 'ptp',
      projectName: 'Test Project',
      location: 'Site A',
      submitterName: 'Alice',
      submitterEmail: 'test@x.com',
    }))
  })
})
