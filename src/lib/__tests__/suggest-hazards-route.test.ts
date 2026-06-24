import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-auth', () => ({
  requireSession: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => Promise.resolve({ ok: true, retryAfter: 0 })),
}))
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}))

import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'

beforeEach(() => {
  vi.mocked(requireSession).mockResolvedValue({
    session: { user: { email: 'test@x.com', name: 'Test', image: null }, expires: '' },
    error: null,
  })
  vi.mocked(rateLimit).mockResolvedValue({ ok: true, retryAfter: 0 })
  delete process.env.NEXT_PUBLIC_AI_ASSIST
  delete process.env.ANTHROPIC_API_KEY
})

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/safety/suggest-hazards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/safety/suggest-hazards', () => {
  it('returns 404 when AI assist disabled', async () => {
    const { POST } = await import('@/app/api/safety/suggest-hazards/route')
    const res = await POST(makeReq({ scopeOfWork: 'test' }))
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.hazards).toEqual([])
  })

  it('returns 401 when unauthenticated', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    vi.mocked(requireSession).mockResolvedValue({
      session: null,
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const { POST } = await import('@/app/api/safety/suggest-hazards/route')
    const res = await POST(makeReq({ scopeOfWork: 'test' }))
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    vi.mocked(rateLimit).mockResolvedValue({ ok: false, retryAfter: 15 })
    const { POST } = await import('@/app/api/safety/suggest-hazards/route')
    const res = await POST(makeReq({ scopeOfWork: 'test' }))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('15')
  })

  it('returns 503 when API key missing', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    const { POST } = await import('@/app/api/safety/suggest-hazards/route')
    const res = await POST(makeReq({ scopeOfWork: 'test' }))
    expect(res.status).toBe(503)
  })

  it('returns 400 for empty scope of work', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const { POST } = await import('@/app/api/safety/suggest-hazards/route')
    const res = await POST(makeReq({ scopeOfWork: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const { POST } = await import('@/app/api/safety/suggest-hazards/route')
    const req = new Request('http://localhost/api/safety/suggest-hazards', {
      method: 'POST',
      body: 'invalid',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
