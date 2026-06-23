import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-auth', () => ({
  requireSession: vi.fn(() =>
    Promise.resolve({
      session: { user: { email: 'test@example.com', name: 'Test' } },
      error: null,
    })
  ),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => Promise.resolve({ ok: true, retryAfter: 0 })),
}))

import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  vi.mocked(requireSession).mockResolvedValue({
    session: { user: { email: 'test@example.com', name: 'Test' } },
    error: null,
  } as never)
  vi.mocked(rateLimit).mockResolvedValue({ ok: true, retryAfter: 0 })
  mockFetch.mockReset()
})

function makeGetRequest(params: Record<string, string>): Request {
  const url = new URL('http://localhost/api/sds/search')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new Request(url.toString(), { method: 'GET' })
}

describe('/api/sds/search', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireSession).mockResolvedValue({
      session: null,
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    } as never)
    const { GET } = await import('@/app/api/sds/search/route')
    const res = await GET(makeGetRequest({ q: 'cement' }))
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimit).mockResolvedValue({ ok: false, retryAfter: 45 })
    const { GET } = await import('@/app/api/sds/search/route')
    const res = await GET(makeGetRequest({ q: 'cement' }))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('45')
  })

  it('returns 400 for query shorter than 2 chars', async () => {
    const { GET } = await import('@/app/api/sds/search/route')
    const res = await GET(makeGetRequest({ q: 'a' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('too short')
  })

  it('returns empty results when Notion not configured', async () => {
    delete process.env.NOTION_API_KEY
    delete process.env.NOTION_SDS_DB_ID
    const { GET } = await import('@/app/api/sds/search/route')
    const res = await GET(makeGetRequest({ q: 'cement' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toEqual([])
    expect(body.total).toBe(0)
  })

  it('queries Notion and returns mapped results', async () => {
    process.env.NOTION_API_KEY = 'test-key'
    process.env.NOTION_SDS_DB_ID = 'test-db-id'
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{
          id: 'page-1',
          properties: {
            'ID': { title: [{ plain_text: 'SDS-2026-0001' }] },
            'Product Name': { rich_text: [{ plain_text: 'Portland Cement' }] },
            'Manufacturer': { rich_text: [{ plain_text: 'Quikrete' }] },
            'Signal Word': { select: { name: 'Danger' } },
            'Emergency Phone': { rich_text: [{ plain_text: '1-800-555-0100' }] },
          },
        }],
      }),
    })
    const { GET } = await import('@/app/api/sds/search/route')
    const res = await GET(makeGetRequest({ q: 'portland' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toHaveLength(1)
    expect(body.results[0].productName).toBe('Portland Cement')
    expect(body.results[0].signalWord).toBe('Danger')
  })

  it('handles Notion API errors gracefully', async () => {
    process.env.NOTION_API_KEY = 'test-key'
    process.env.NOTION_SDS_DB_ID = 'test-db-id'
    mockFetch.mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('Notion error'),
    })
    const { GET } = await import('@/app/api/sds/search/route')
    const res = await GET(makeGetRequest({ q: 'cement' }))
    expect(res.status).toBe(502)
  })
})
