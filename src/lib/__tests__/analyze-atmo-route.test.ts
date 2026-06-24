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
  return new Request('http://localhost/api/safety/analyze-atmosphere', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/safety/analyze-atmosphere', () => {
  it('returns 404 when AI assist is disabled', async () => {
    const { POST } = await import('@/app/api/safety/analyze-atmosphere/route')
    const res = await POST(makeReq({ readings: { oxygen: 20.9 } }))
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    vi.mocked(requireSession).mockResolvedValue({
      session: null,
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const { POST } = await import('@/app/api/safety/analyze-atmosphere/route')
    const res = await POST(makeReq({ readings: { oxygen: 20.9 } }))
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    vi.mocked(rateLimit).mockResolvedValue({ ok: false, retryAfter: 30 })
    const { POST } = await import('@/app/api/safety/analyze-atmosphere/route')
    const res = await POST(makeReq({ readings: { oxygen: 20.9 } }))
    expect(res.status).toBe(429)
  })

  it('returns 503 when ANTHROPIC_API_KEY is missing', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    const { POST } = await import('@/app/api/safety/analyze-atmosphere/route')
    const res = await POST(makeReq({ readings: { oxygen: 20.9 } }))
    expect(res.status).toBe(503)
  })

  it('returns 400 when no readings provided', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const { POST } = await import('@/app/api/safety/analyze-atmosphere/route')
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('No readings')
  })

  it('returns 400 for invalid JSON', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const { POST } = await import('@/app/api/safety/analyze-atmosphere/route')
    const req = new Request('http://localhost/api/safety/analyze-atmosphere', {
      method: 'POST',
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
