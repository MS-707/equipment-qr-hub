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
  delete process.env.NEXT_PUBLIC_AI_ASSIST
  delete process.env.ANTHROPIC_API_KEY
})

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/safety/audit-ptp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/safety/audit-ptp', () => {
  it('returns 404 when AI not enabled', async () => {
    const { POST } = await import('@/app/api/safety/audit-ptp/route')
    const res = await POST(makeReq({ ptp: { type: 'ptp' } }))
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    vi.mocked(requireSession).mockResolvedValue({
      session: null,
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const { POST } = await import('@/app/api/safety/audit-ptp/route')
    const res = await POST(makeReq({ ptp: { type: 'ptp' } }))
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    vi.mocked(rateLimit).mockResolvedValue({ ok: false, retryAfter: 30 })
    const { POST } = await import('@/app/api/safety/audit-ptp/route')
    const res = await POST(makeReq({ ptp: { type: 'ptp' } }))
    expect(res.status).toBe(429)
  })

  it('returns 503 when API key not configured', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    const { POST } = await import('@/app/api/safety/audit-ptp/route')
    const res = await POST(makeReq({ ptp: { type: 'ptp' } }))
    expect(res.status).toBe(503)
  })

  it('returns 400 for invalid JSON', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const { POST } = await import('@/app/api/safety/audit-ptp/route')
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when PTP missing or wrong type', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const { POST } = await import('@/app/api/safety/audit-ptp/route')
    const res = await POST(makeReq({ ptp: { type: 'jha' } }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('PTP')
  })
})
