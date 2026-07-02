import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/review-token', () => ({
  verifyReviewToken: vi.fn(),
}))
vi.mock('@/lib/review-store', () => ({
  getReviewSubmission: vi.fn(),
  decideReview: vi.fn(),
}))
vi.mock('@/lib/email-notify', () => ({
  isEmailConfigured: vi.fn(() => false),
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => Promise.resolve({ ok: true, retryAfter: 0 })),
}))

import { verifyReviewToken } from '@/lib/review-token'
import { getReviewSubmission, decideReview } from '@/lib/review-store'
import { isEmailConfigured } from '@/lib/email-notify'
import { rateLimit } from '@/lib/rate-limit'

const pendingSubmission = {
  recordId: 'PTP-2026-0001',
  recordType: 'ptp' as const,
  recordLabel: 'Pre-Task Plan',
  projectName: 'Project X',
  location: 'Site A',
  submitterName: 'Alice Smith',
  submitterEmail: 'alice@example.com',
  submittedAt: '2026-06-23T00:00:00Z',
  status: 'pending' as const,
}

beforeEach(() => {
  vi.mocked(rateLimit).mockResolvedValue({ ok: true, retryAfter: 0 })
  vi.mocked(verifyReviewToken).mockReturnValue(null)
  vi.mocked(getReviewSubmission).mockResolvedValue(undefined)
  vi.mocked(decideReview).mockResolvedValue(undefined)
  vi.mocked(isEmailConfigured).mockReturnValue(false)
  vi.stubGlobal('fetch', vi.fn())
  delete process.env.NEXT_PUBLIC_EHS_REVIEW
  delete process.env.RESEND_API_KEY
})

function makePostReq(body: unknown): Request {
  return new Request('http://localhost/api/safety/review/decide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeGetReq(token?: string): Request {
  const url = token
    ? `http://localhost/api/safety/review/decide?token=${token}`
    : 'http://localhost/api/safety/review/decide'
  return new Request(url, { method: 'GET' })
}

describe('POST /api/safety/review/decide', () => {
  it('returns 404 when EHS review disabled', async () => {
    const { POST } = await import('@/app/api/safety/review/decide/route')
    const res = await POST(makePostReq({ token: 'abc' }))
    expect(res.status).toBe(404)
  })

  it('returns 429 when rate limited', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    vi.mocked(rateLimit).mockResolvedValue({ ok: false, retryAfter: 30 })
    const { POST } = await import('@/app/api/safety/review/decide/route')
    const res = await POST(makePostReq({ token: 'abc' }))
    expect(res.status).toBe(429)
  })

  it('returns 400 for invalid JSON', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    const { POST } = await import('@/app/api/safety/review/decide/route')
    const res = await POST(new Request('http://localhost/api/safety/review/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when token missing', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    const { POST } = await import('@/app/api/safety/review/decide/route')
    const res = await POST(makePostReq({}))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Missing token')
  })

  it('returns 403 for invalid/expired token', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    vi.mocked(verifyReviewToken).mockReturnValue(null)
    const { POST } = await import('@/app/api/safety/review/decide/route')
    const res = await POST(makePostReq({ token: 'bad-token' }))
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('expired')
  })

  it('returns 404 when submission not found', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    vi.mocked(verifyReviewToken).mockReturnValue({ recordId: 'PTP-GONE', action: 'approve', ts: 0 })
    vi.mocked(getReviewSubmission).mockResolvedValue(undefined)
    const { POST } = await import('@/app/api/safety/review/decide/route')
    const res = await POST(makePostReq({ token: 'valid-token' }))
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toContain('not found')
  })

  it('returns alreadyDecided when submission already resolved', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    vi.mocked(verifyReviewToken).mockReturnValue({ recordId: 'PTP-2026-0001', action: 'approve', ts: 0 })
    vi.mocked(getReviewSubmission).mockResolvedValue({ ...pendingSubmission, status: 'approved' })
    const { POST } = await import('@/app/api/safety/review/decide/route')
    const res = await POST(makePostReq({ token: 'valid-token' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.alreadyDecided).toBe(true)
    expect(data.status).toBe('approved')
  })

  it('approves a pending submission', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    vi.mocked(verifyReviewToken).mockReturnValue({ recordId: 'PTP-2026-0001', action: 'approve', ts: 0 })
    vi.mocked(getReviewSubmission).mockResolvedValue(pendingSubmission)
    vi.mocked(decideReview).mockResolvedValue({
      ...pendingSubmission,
      status: 'approved',
      decidedBy: 'EHS reviewer (via email link)',
      decidedAt: '2026-06-23T01:00:00Z',
    })
    const { POST } = await import('@/app/api/safety/review/decide/route')
    const res = await POST(makePostReq({ token: 'valid-token' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.alreadyDecided).toBe(false)
    expect(data.status).toBe('approved')
    expect(decideReview).toHaveBeenCalledWith(
      'PTP-2026-0001', 'approved', 'EHS reviewer (via email link)', undefined
    )
  })

  it('PATCHes the decision onto the Notion page so device polling sees it', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    process.env.NOTION_API_KEY = 'notion-key'
    vi.mocked(verifyReviewToken).mockReturnValue({ recordId: 'PTP-2026-0001', action: 'approve', ts: 0 })
    vi.mocked(getReviewSubmission).mockResolvedValue(pendingSubmission)
    vi.mocked(decideReview).mockResolvedValue({
      ...pendingSubmission,
      status: 'approved',
      decidedBy: 'EHS reviewer (via email link)',
      decidedAt: '2026-06-23T01:00:00Z',
      notionPageId: '9c911f57-0000-4000-8000-000000000000',
    })
    vi.mocked(fetch).mockResolvedValue({ ok: true, text: async () => '' } as Response)
    const { POST } = await import('@/app/api/safety/review/decide/route')
    const res = await POST(makePostReq({ token: 'valid-token' }))
    expect(res.status).toBe(200)
    const patchCall = vi.mocked(fetch).mock.calls.find(([u]) =>
      String(u).includes('/v1/pages/9c911f57-0000-4000-8000-000000000000')
    )
    expect(patchCall).toBeDefined()
    const body = JSON.parse(patchCall![1]?.body as string)
    expect(body.properties['EHS Review'].select.name).toBe('Approved')
    expect(body.properties['Reviewed By'].rich_text[0].text.content).toContain('EHS reviewer')
    delete process.env.NOTION_API_KEY
  })

  it('decision stands even when the Notion PATCH fails', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    process.env.NOTION_API_KEY = 'notion-key'
    vi.mocked(verifyReviewToken).mockReturnValue({ recordId: 'PTP-2026-0001', action: 'reject', ts: 0 })
    vi.mocked(getReviewSubmission).mockResolvedValue(pendingSubmission)
    vi.mocked(decideReview).mockResolvedValue({
      ...pendingSubmission,
      status: 'rejected',
      notionPageId: '9c911f57-0000-4000-8000-000000000000',
    })
    vi.mocked(fetch).mockRejectedValue(new Error('Notion down'))
    const { POST } = await import('@/app/api/safety/review/decide/route')
    const res = await POST(makePostReq({ token: 'valid-token' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('rejected')
    delete process.env.NOTION_API_KEY
  })

  it('rejects with a note (truncated to 500 chars)', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    vi.mocked(verifyReviewToken).mockReturnValue({ recordId: 'PTP-2026-0001', action: 'reject', ts: 0 })
    vi.mocked(getReviewSubmission).mockResolvedValue(pendingSubmission)
    vi.mocked(decideReview).mockResolvedValue({
      ...pendingSubmission,
      status: 'rejected',
      decidedBy: 'EHS reviewer (via email link)',
      decidedAt: '2026-06-23T01:00:00Z',
      note: 'x'.repeat(500),
    })
    const longNote = 'x'.repeat(600)
    const { POST } = await import('@/app/api/safety/review/decide/route')
    const res = await POST(makePostReq({ token: 'valid-token', note: longNote }))
    expect(res.status).toBe(200)
    expect(decideReview).toHaveBeenCalledWith(
      'PTP-2026-0001', 'rejected', 'EHS reviewer (via email link)', 'x'.repeat(500)
    )
  })

  it('returns 500 when decideReview fails', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    vi.mocked(verifyReviewToken).mockReturnValue({ recordId: 'PTP-2026-0001', action: 'approve', ts: 0 })
    vi.mocked(getReviewSubmission).mockResolvedValue(pendingSubmission)
    vi.mocked(decideReview).mockResolvedValue(undefined)
    const { POST } = await import('@/app/api/safety/review/decide/route')
    const res = await POST(makePostReq({ token: 'valid-token' }))
    expect(res.status).toBe(500)
  })

  it('sends decision email when configured', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    process.env.RESEND_API_KEY = 'test-key'
    vi.mocked(isEmailConfigured).mockReturnValue(true)
    vi.mocked(verifyReviewToken).mockReturnValue({ recordId: 'PTP-2026-0001', action: 'approve', ts: 0 })
    vi.mocked(getReviewSubmission).mockResolvedValue(pendingSubmission)
    vi.mocked(decideReview).mockResolvedValue({
      ...pendingSubmission,
      status: 'approved',
      decidedBy: 'EHS reviewer (via email link)',
      decidedAt: '2026-06-23T01:00:00Z',
    })
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)
    const { POST } = await import('@/app/api/safety/review/decide/route')
    const res = await POST(makePostReq({ token: 'valid-token' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.employeeNotified).toBe(true)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' })
    )
  })
})

describe('GET /api/safety/review/decide', () => {
  it('returns 404 when EHS review disabled', async () => {
    const { GET } = await import('@/app/api/safety/review/decide/route')
    const res = await GET(makeGetReq('abc'))
    expect(res.status).toBe(404)
  })

  it('returns 400 when token missing from query', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    const { GET } = await import('@/app/api/safety/review/decide/route')
    const res = await GET(makeGetReq())
    expect(res.status).toBe(400)
  })

  it('returns 403 for invalid token', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    vi.mocked(verifyReviewToken).mockReturnValue(null)
    const { GET } = await import('@/app/api/safety/review/decide/route')
    const res = await GET(makeGetReq('bad-token'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when submission not found', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    vi.mocked(verifyReviewToken).mockReturnValue({ recordId: 'PTP-GONE', action: 'approve', ts: 0 })
    const { GET } = await import('@/app/api/safety/review/decide/route')
    const res = await GET(makeGetReq('valid-token'))
    expect(res.status).toBe(404)
  })

  it('returns submission details for valid token', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    vi.mocked(verifyReviewToken).mockReturnValue({ recordId: 'PTP-2026-0001', action: 'approve', ts: 0 })
    vi.mocked(getReviewSubmission).mockResolvedValue(pendingSubmission)
    const { GET } = await import('@/app/api/safety/review/decide/route')
    const res = await GET(makeGetReq('valid-token'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.recordId).toBe('PTP-2026-0001')
    expect(data.recordLabel).toBe('Pre-Task Plan')
    expect(data.action).toBe('approve')
    expect(data.status).toBe('pending')
  })
})
