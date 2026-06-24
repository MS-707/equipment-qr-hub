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
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/safety/audit-ptp guards', () => {
  it('returns 404 when AI disabled', async () => {
    const { POST } = await import('@/app/api/safety/audit-ptp/route')
    const res = await POST(makeReq({}))
    expect(res.status).toBe(404)
  })

  it('returns 429 when rate limited', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    vi.mocked(rateLimit).mockResolvedValue({ ok: false, retryAfter: 5 })
    const { POST } = await import('@/app/api/safety/audit-ptp/route')
    const res = await POST(makeReq({}))
    expect(res.status).toBe(429)
  })

  it('returns 503 when API key missing', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    const { POST } = await import('@/app/api/safety/audit-ptp/route')
    const res = await POST(makeReq({}))
    expect(res.status).toBe(503)
  })
})

describe('POST /api/safety/suggest-jha guards', () => {
  it('returns 404 when AI disabled', async () => {
    const { POST } = await import('@/app/api/safety/suggest-jha/route')
    const res = await POST(makeReq({}))
    expect(res.status).toBe(404)
  })

  it('returns 429 when rate limited', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    vi.mocked(rateLimit).mockResolvedValue({ ok: false, retryAfter: 5 })
    const { POST } = await import('@/app/api/safety/suggest-jha/route')
    const res = await POST(makeReq({}))
    expect(res.status).toBe(429)
  })

  it('returns 503 when API key missing', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    const { POST } = await import('@/app/api/safety/suggest-jha/route')
    const res = await POST(makeReq({}))
    expect(res.status).toBe(503)
  })
})

describe('POST /api/safety/suggest-toolbox guards', () => {
  it('returns 404 when AI disabled', async () => {
    const { POST } = await import('@/app/api/safety/suggest-toolbox/route')
    const res = await POST(makeReq({}))
    expect(res.status).toBe(404)
  })

  it('returns 429 when rate limited', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    vi.mocked(rateLimit).mockResolvedValue({ ok: false, retryAfter: 5 })
    const { POST } = await import('@/app/api/safety/suggest-toolbox/route')
    const res = await POST(makeReq({}))
    expect(res.status).toBe(429)
  })

  it('returns 503 when API key missing', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    const { POST } = await import('@/app/api/safety/suggest-toolbox/route')
    const res = await POST(makeReq({}))
    expect(res.status).toBe(503)
  })
})
