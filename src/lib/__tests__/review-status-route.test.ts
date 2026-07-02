import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-auth', () => ({
  requireSession: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => Promise.resolve({ ok: true, retryAfter: 0 })),
}))
vi.mock('@/lib/review-store', () => ({
  getReviewSubmission: vi.fn(),
}))

import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'
import { getReviewSubmission } from '@/lib/review-store'

beforeEach(() => {
  vi.mocked(requireSession).mockResolvedValue({
    session: { user: { email: 'test@x.com', name: 'Test', image: null }, expires: '' },
    error: null,
  })
  vi.mocked(rateLimit).mockResolvedValue({ ok: true, retryAfter: 0 })
  vi.mocked(getReviewSubmission).mockReset()
  vi.stubGlobal('fetch', vi.fn())
  delete process.env.NEXT_PUBLIC_EHS_REVIEW
  delete process.env.NOTION_API_KEY
})

function makeGetReq(pages?: string): Request {
  const url = pages
    ? `http://localhost/api/safety/review/status?pages=${pages}`
    : 'http://localhost/api/safety/review/status'
  return new Request(url, { method: 'GET' })
}

describe('GET /api/safety/review/status', () => {
  it('returns empty decisions when EHS review disabled', async () => {
    const { GET } = await import('@/app/api/safety/review/status/route')
    const res = await GET(makeGetReq('abc'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.decisions).toEqual({})
  })

  it('returns 429 when rate limited (20-page Notion fan-out per call)', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    vi.mocked(rateLimit).mockResolvedValue({ ok: false, retryAfter: 15 })
    const { GET } = await import('@/app/api/safety/review/status/route')
    const res = await GET(makeGetReq('abc'))
    expect(res.status).toBe(429)
  })

  it('resolves decisions by record id from KV when Notion is not configured', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    // No NOTION_API_KEY — email/Slack-only deployment
    vi.mocked(getReviewSubmission).mockResolvedValue({
      recordId: 'PTP-2026-0001-ab12',
      status: 'approved',
      decidedBy: 'EHS reviewer (via email link)',
      note: 'Looks good',
    } as never)
    const { GET } = await import('@/app/api/safety/review/status/route')
    const res = await GET(new Request('http://localhost/api/safety/review/status?records=PTP-2026-0001-ab12'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.decisions['PTP-2026-0001-ab12']).toEqual({
      status: 'approved',
      reviewerName: 'EHS reviewer (via email link)',
      reviewNote: 'Looks good',
    })
  })

  it('omits still-pending KV submissions from decisions', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    vi.mocked(getReviewSubmission).mockResolvedValue({ recordId: 'PTP-2026-0002', status: 'pending' } as never)
    const { GET } = await import('@/app/api/safety/review/status/route')
    const res = await GET(new Request('http://localhost/api/safety/review/status?records=PTP-2026-0002'))
    const data = await res.json()
    expect(data.decisions).toEqual({})
  })

  it('rejects malformed record ids without touching the store', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    const { GET } = await import('@/app/api/safety/review/status/route')
    await GET(new Request('http://localhost/api/safety/review/status?records=../../etc,DROP TABLE'))
    expect(getReviewSubmission).not.toHaveBeenCalled()
  })

  it('returns 401 when unauthenticated', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    vi.mocked(requireSession).mockResolvedValue({
      session: null,
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const { GET } = await import('@/app/api/safety/review/status/route')
    const res = await GET(makeGetReq('abc'))
    expect(res.status).toBe(401)
  })

  it('returns empty decisions when Notion API key missing', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    const { GET } = await import('@/app/api/safety/review/status/route')
    const res = await GET(makeGetReq('12345678-1234-1234-1234-123456789abc'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.decisions).toEqual({})
  })

  it('returns empty decisions when no pages param', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    process.env.NOTION_API_KEY = 'ntn_test'
    const { GET } = await import('@/app/api/safety/review/status/route')
    const res = await GET(makeGetReq())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.decisions).toEqual({})
  })

  it('filters invalid Notion IDs from pages param', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    process.env.NOTION_API_KEY = 'ntn_test'
    const { GET } = await import('@/app/api/safety/review/status/route')
    const res = await GET(makeGetReq('invalid-id,also-bad'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.decisions).toEqual({})
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches and returns review status from Notion', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    process.env.NOTION_API_KEY = 'ntn_test'
    const pageId = '12345678-1234-1234-1234-123456789abc'
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        properties: {
          'EHS Review': { type: 'select', select: { name: 'Approved' } },
          'Reviewed By': { type: 'rich_text', rich_text: [{ plain_text: 'Bob' }] },
          'EHS Review Note': { type: 'rich_text', rich_text: [{ plain_text: 'Looks good' }] },
        },
      }),
    } as Response)
    const { GET } = await import('@/app/api/safety/review/status/route')
    const res = await GET(makeGetReq(pageId))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.decisions[pageId]).toEqual({
      status: 'approved',
      reviewerName: 'Bob',
      reviewNote: 'Looks good',
    })
  })

  it('limits to 20 page IDs', async () => {
    process.env.NEXT_PUBLIC_EHS_REVIEW = '1'
    process.env.NOTION_API_KEY = 'ntn_test'
    const ids = Array.from({ length: 25 }, (_, i) =>
      `1234567${i.toString().padStart(1, '0')}-1234-1234-1234-123456789abc`
    )
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        properties: {
          'EHS Review': { type: 'select', select: { name: 'Pending' } },
        },
      }),
    } as Response)
    const { GET } = await import('@/app/api/safety/review/status/route')
    await GET(makeGetReq(ids.join(',')))
    expect(vi.mocked(fetch).mock.calls.length).toBeLessThanOrEqual(20)
  })
})
