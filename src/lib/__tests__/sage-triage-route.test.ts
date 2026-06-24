import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => Promise.resolve({ ok: true, retryAfter: 0 })),
}))
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}))
vi.mock('@anthropic-ai/sdk/helpers/zod', () => ({
  zodOutputFormat: vi.fn(),
}))

import { getServerSession } from 'next-auth/next'
import { rateLimit } from '@/lib/rate-limit'

beforeEach(() => {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: 'test@x.com', name: 'Test User', image: null },
    expires: '',
  })
  vi.mocked(rateLimit).mockResolvedValue({ ok: true, retryAfter: 0 })
  delete process.env.NEXT_PUBLIC_AI_ASSIST
  delete process.env.ANTHROPIC_API_KEY
})

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/sage/triage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/sage/triage', () => {
  it('returns 404 when AI assist disabled', async () => {
    const { POST } = await import('@/app/api/sage/triage/route')
    const res = await POST(makeReq({ message: 'hello' }))
    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { POST } = await import('@/app/api/sage/triage/route')
    const res = await POST(makeReq({ message: 'hello' }))
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    vi.mocked(rateLimit).mockResolvedValue({ ok: false, retryAfter: 10 })
    const { POST } = await import('@/app/api/sage/triage/route')
    const res = await POST(makeReq({ message: 'hello' }))
    expect(res.status).toBe(429)
  })

  it('returns 503 when API key missing', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    const { POST } = await import('@/app/api/sage/triage/route')
    const res = await POST(makeReq({ message: 'hello' }))
    expect(res.status).toBe(503)
  })

  it('returns 400 for invalid JSON', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const { POST } = await import('@/app/api/sage/triage/route')
    const res = await POST(new Request('http://localhost/api/sage/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty message', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const { POST } = await import('@/app/api/sage/triage/route')
    const res = await POST(makeReq({ message: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for message over 500 chars', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const { POST } = await import('@/app/api/sage/triage/route')
    const res = await POST(makeReq({ message: 'x'.repeat(501) }))
    expect(res.status).toBe(400)
  })
})
