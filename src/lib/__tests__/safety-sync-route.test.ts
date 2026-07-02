import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-auth', () => ({
  requireSession: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => Promise.resolve({ ok: true, retryAfter: 0 })),
}))

import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'

beforeEach(() => {
  vi.mocked(requireSession).mockResolvedValue({
    session: { user: { email: 'test@x.com', name: 'Test', image: null }, expires: '' },
    error: null,
  })
  vi.mocked(rateLimit).mockResolvedValue({ ok: true, retryAfter: 0 })
  vi.stubGlobal('fetch', vi.fn())
  delete process.env.NOTION_API_KEY
  delete process.env.NOTION_PTP_DB_ID
  delete process.env.NOTION_INCIDENTS_DB_ID
  delete process.env.NOTION_PERMITS_DB_ID
})

const validPtp = {
  id: 'PTP-2026-0001',
  type: 'ptp',
  projectName: 'Test Project',
  location: 'Site A',
  createdBy: 'Alice',
  createdByEmail: 'test@x.com',
  createdAt: '2026-06-23T08:00:00Z',
}

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/safety/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/safety/sync', () => {
  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimit).mockResolvedValue({ ok: false, retryAfter: 30 })
    const { POST } = await import('@/app/api/safety/sync/route')
    const res = await POST(makeReq(validPtp))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('30')
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireSession).mockResolvedValue({
      session: null,
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const { POST } = await import('@/app/api/safety/sync/route')
    const res = await POST(makeReq(validPtp))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid JSON', async () => {
    const { POST } = await import('@/app/api/safety/sync/route')
    const res = await POST(new Request('http://localhost/api/safety/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when record id missing', async () => {
    const { POST } = await import('@/app/api/safety/sync/route')
    const res = await POST(makeReq({ type: 'ptp', createdAt: '2026-06-23T00:00:00Z' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('record id')
  })

  it('returns 400 when record type invalid', async () => {
    const { POST } = await import('@/app/api/safety/sync/route')
    const res = await POST(makeReq({ id: 'X-001', type: 'invalid', createdAt: '2026-06-23T00:00:00Z' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('record type')
  })

  it('returns 400 when createdAt invalid', async () => {
    process.env.NOTION_PTP_DB_ID = 'db-ptp'
    vi.resetModules()
    const { POST } = await import('@/app/api/safety/sync/route')
    const res = await POST(makeReq({ id: 'PTP-001', type: 'ptp', createdAt: 'not-a-date' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('createdAt')
  })

  it('returns 403 when record owner mismatch', async () => {
    process.env.NOTION_PTP_DB_ID = 'db-ptp'
    vi.resetModules()
    const { POST } = await import('@/app/api/safety/sync/route')
    const res = await POST(makeReq({ ...validPtp, createdByEmail: 'other@x.com' }))
    expect(res.status).toBe(403)
  })

  it('returns 503 when Notion API key not configured', async () => {
    process.env.NOTION_PTP_DB_ID = 'db-ptp'
    vi.resetModules()
    const { POST } = await import('@/app/api/safety/sync/route')
    const res = await POST(makeReq(validPtp))
    expect(res.status).toBe(503)
    const data = await res.json()
    expect(data.error).toContain('Notion')
  })

  it('returns existing page on dedup', async () => {
    process.env.NOTION_API_KEY = 'ntn_test'
    process.env.NOTION_PTP_DB_ID = 'db-ptp'
    vi.resetModules()
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ id: 'existing-page' }] }),
    } as Response)
    const { POST } = await import('@/app/api/safety/sync/route')
    const res = await POST(makeReq(validPtp))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.notionPageId).toBe('existing-page')
  })

  it('creates page when no dedup match', async () => {
    process.env.NOTION_API_KEY = 'ntn_test'
    process.env.NOTION_PTP_DB_ID = 'db-ptp'
    vi.resetModules()
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'new-page-123' }) } as Response)
    const { POST } = await import('@/app/api/safety/sync/route')
    const res = await POST(makeReq(validPtp))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.notionPageId).toBe('new-page-123')
  })

  it('returns 502 when Notion create fails', async () => {
    process.env.NOTION_API_KEY = 'ntn_test'
    process.env.NOTION_PTP_DB_ID = 'db-ptp'
    vi.resetModules()
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) } as Response)
      .mockResolvedValueOnce({ ok: false, text: async () => 'Notion error' } as Response)
    const { POST } = await import('@/app/api/safety/sync/route')
    const res = await POST(makeReq(validPtp))
    expect(res.status).toBe(502)
  })

  it('caps Notion children blocks at 100', async () => {
    process.env.NOTION_API_KEY = 'ntn_test'
    process.env.NOTION_PTP_DB_ID = 'db-ptp'
    vi.resetModules()
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'page-big' }) } as Response)
    const hugeRecord = {
      ...validPtp,
      extraField: 'X'.repeat(300_000),
    }
    const { POST } = await import('@/app/api/safety/sync/route')
    const res = await POST(makeReq(hugeRecord))
    expect(res.status).toBe(200)
    const createCall = vi.mocked(fetch).mock.calls[1]
    const body = JSON.parse(createCall[1]?.body as string)
    expect(body.children.length).toBeLessThanOrEqual(100)
  })

  it('truncates long string fields with safeStr', async () => {
    process.env.NOTION_API_KEY = 'ntn_test'
    process.env.NOTION_PTP_DB_ID = 'db-ptp'
    vi.resetModules()
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'page-x' }) } as Response)
    const longRecord = {
      ...validPtp,
      projectName: 'A'.repeat(500),
      location: 'B'.repeat(500),
      createdBy: 'C'.repeat(500),
    }
    const { POST } = await import('@/app/api/safety/sync/route')
    const res = await POST(makeReq(longRecord))
    expect(res.status).toBe(200)
    const createCall = vi.mocked(fetch).mock.calls[1]
    const body = JSON.parse(createCall[1]?.body as string)
    expect(body.properties.Project.rich_text[0].text.content.length).toBe(200)
    expect(body.properties.Location.rich_text[0].text.content.length).toBe(200)
    expect(body.properties['Created By'].rich_text[0].text.content.length).toBe(200)
  })
})
