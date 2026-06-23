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

const validRecord = {
  id: 'SDS-2026-0001',
  productName: 'Portland Cement',
  manufacturer: 'Quikrete',
  casNumbers: ['65997-15-1'],
  signalWord: 'Danger',
  pictograms: ['GHS05', 'GHS07'],
  hazardStatements: ['Causes severe skin burns'],
  precautionaryStatements: ['Wear protective gloves'],
  firstAid: {
    inhalation: 'Move to fresh air',
    skin: 'Wash with water',
    eyes: 'Rinse immediately',
    ingestion: 'Do not induce vomiting',
  },
  ppeRequired: ['Safety goggles', 'Gloves'],
  fireExtinguishing: 'Use water spray',
  spillProcedure: 'Sweep up and contain',
  storageHandling: 'Store in dry area',
  emergencyPhone: '1-800-555-0100',
  sections: [],
  isFavorite: false,
  createdAt: '2026-06-23T00:00:00Z',
  updatedAt: '2026-06-23T00:00:00Z',
  syncStatus: 'pending',
  _searchIndex: 'portland cement quikrete',
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/sds/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.mocked(requireSession).mockResolvedValue({
    session: { user: { email: 'test@example.com', name: 'Test' } },
    error: null,
  } as never)
  vi.mocked(rateLimit).mockResolvedValue({ ok: true, retryAfter: 0 })
  mockFetch.mockReset()
  delete process.env.NOTION_API_KEY
  delete process.env.NOTION_SDS_DB_ID
})

describe('/api/sds/sync', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireSession).mockResolvedValue({
      session: null,
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    } as never)
    const { POST } = await import('@/app/api/sds/sync/route')
    const res = await POST(makeRequest(validRecord))
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimit).mockResolvedValue({ ok: false, retryAfter: 20 })
    const { POST } = await import('@/app/api/sds/sync/route')
    const res = await POST(makeRequest(validRecord))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('20')
  })

  it('returns 400 for invalid JSON body', async () => {
    const { POST } = await import('@/app/api/sds/sync/route')
    const badReq = new Request('http://localhost/api/sds/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    const res = await POST(badReq)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid JSON')
  })

  it('returns 400 for schema-invalid record', async () => {
    const { POST } = await import('@/app/api/sds/sync/route')
    const res = await POST(makeRequest({ id: 123, productName: null }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid SDS record')
    expect(body.details).toBeDefined()
  })

  it('returns 503 when Notion not configured', async () => {
    const { POST } = await import('@/app/api/sds/sync/route')
    const res = await POST(makeRequest(validRecord))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toContain('Notion')
  })

  it('returns existing page when record already in Notion', async () => {
    process.env.NOTION_API_KEY = 'test-key'
    process.env.NOTION_SDS_DB_ID = 'test-db-id'
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ results: [{ id: 'existing-page-id' }] }),
    })
    const { POST } = await import('@/app/api/sds/sync/route')
    const res = await POST(makeRequest(validRecord))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.notionPageId).toBe('existing-page-id')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('creates Notion page with correct properties', async () => {
    process.env.NOTION_API_KEY = 'test-key'
    process.env.NOTION_SDS_DB_ID = 'test-db-id'
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new-page-id' }),
      })
    const { POST } = await import('@/app/api/sds/sync/route')
    const res = await POST(makeRequest(validRecord))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.notionPageId).toBe('new-page-id')
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const createCall = mockFetch.mock.calls[1]
    expect(createCall[0]).toBe('https://api.notion.com/v1/pages')
    const createBody = JSON.parse(createCall[1].body)
    expect(createBody.properties['Product Name'].rich_text[0].text.content).toBe('Portland Cement')
    expect(createBody.properties['Signal Word'].select.name).toBe('Danger')
    expect(createBody.parent.database_id).toBe('test-db-id')
  })

  it('chunks large JSON payloads into 1900-char code blocks', async () => {
    process.env.NOTION_API_KEY = 'test-key'
    process.env.NOTION_SDS_DB_ID = 'test-db-id'
    const largeRecord = {
      ...validRecord,
      hazardStatements: Array.from({ length: 200 }, (_, i) => `H${300 + i}: Hazard statement number ${i} with enough text to make this reasonably long`),
    }
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'chunked-page' }),
      })
    const { POST } = await import('@/app/api/sds/sync/route')
    const res = await POST(makeRequest(largeRecord))
    expect(res.status).toBe(200)
    const createBody = JSON.parse(mockFetch.mock.calls[1][1].body)
    expect(createBody.children.length).toBeGreaterThan(1)
    for (const child of createBody.children) {
      expect(child.code.rich_text[0].text.content.length).toBeLessThanOrEqual(1900)
    }
  })

  it('returns 502 when Notion page creation fails', async () => {
    process.env.NOTION_API_KEY = 'test-key'
    process.env.NOTION_SDS_DB_ID = 'test-db-id'
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Notion error'),
      })
    const { POST } = await import('@/app/api/sds/sync/route')
    const res = await POST(makeRequest(validRecord))
    expect(res.status).toBe(502)
  })

  it('returns 500 on unexpected exceptions', async () => {
    process.env.NOTION_API_KEY = 'test-key'
    process.env.NOTION_SDS_DB_ID = 'test-db-id'
    mockFetch.mockRejectedValue(new Error('network failure'))
    const { POST } = await import('@/app/api/sds/sync/route')
    const res = await POST(makeRequest(validRecord))
    expect(res.status).toBe(500)
  })
})
