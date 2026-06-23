import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-auth', () => ({
  requireSession: vi.fn(),
}))

import { requireSession } from '@/lib/api-auth'

beforeEach(() => {
  vi.mocked(requireSession).mockResolvedValue({
    session: { user: { email: 'test@x.com', name: 'Test', image: null }, expires: '' },
    error: null,
  })
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
