import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-auth', () => ({
  requireSession: vi.fn(() =>
    Promise.resolve({
      session: { user: { email: 'test@example.com', name: 'Test' } },
      error: null,
    })
  ),
}))

vi.mock('@/lib/kv', () => ({
  kv: {
    rpop: vi.fn(() => Promise.resolve(null)),
  },
}))

import { requireSession } from '@/lib/api-auth'
import { kv } from '@/lib/kv'

beforeEach(() => {
  vi.mocked(requireSession).mockResolvedValue({
    session: { user: { email: 'test@example.com', name: 'Test' } },
    error: null,
  } as never)
  vi.mocked(kv.rpop).mockResolvedValue(null)
  delete process.env.KV_REST_API_URL
})

describe('/api/sds/webhook-queue', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireSession).mockResolvedValue({
      session: null,
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    } as never)
    const { GET } = await import('@/app/api/sds/webhook-queue/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns empty array when KV not configured', async () => {
    const { GET } = await import('@/app/api/sds/webhook-queue/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.records).toEqual([])
  })

  it('drains up to 10 records from queue', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.com'
    const records = Array.from({ length: 12 }, (_, i) =>
      JSON.stringify({ id: `SDS-2026-${String(i + 1).padStart(4, '0')}`, productName: `Chemical ${i}` })
    )
    let callCount = 0
    vi.mocked(kv.rpop).mockImplementation(() => {
      const result = callCount < records.length ? records[callCount] : null
      callCount++
      return Promise.resolve(result)
    })
    const { GET } = await import('@/app/api/sds/webhook-queue/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.records).toHaveLength(10)
    expect(body.records[0].id).toBe('SDS-2026-0001')
  })

  it('silently drops malformed JSON entries', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.com'
    let callCount = 0
    const items = ['not-json', JSON.stringify({ id: 'SDS-2026-0001', productName: 'Valid' }), null]
    vi.mocked(kv.rpop).mockImplementation(() => {
      const result = items[callCount] ?? null
      callCount++
      return Promise.resolve(result)
    })
    const { GET } = await import('@/app/api/sds/webhook-queue/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.records).toHaveLength(1)
    expect(body.records[0].productName).toBe('Valid')
  })

  it('returns empty array on KV exception', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.com'
    vi.mocked(kv.rpop).mockRejectedValue(new Error('KV down'))
    const { GET } = await import('@/app/api/sds/webhook-queue/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.records).toEqual([])
  })

  it('returns empty array when queue is empty', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.com'
    vi.mocked(kv.rpop).mockResolvedValue(null)
    const { GET } = await import('@/app/api/sds/webhook-queue/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.records).toEqual([])
  })
})
