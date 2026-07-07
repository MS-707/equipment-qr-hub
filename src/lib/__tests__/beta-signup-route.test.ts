import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/beta', () => ({
  addSignup: vi.fn(),
}))
vi.mock('@/lib/email-notify', () => ({
  sendEhsNotification: vi.fn(() => Promise.resolve('not-configured')),
}))
vi.mock('@/lib/slack-notify', () => ({
  sendSlackMessage: vi.fn(() => Promise.resolve(false)),
  escapeSlack: vi.fn((s: string) => s),
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => Promise.resolve({ ok: true, retryAfter: 0 })),
}))

import { addSignup } from '@/lib/beta'
import { rateLimit } from '@/lib/rate-limit'

beforeEach(() => {
  vi.mocked(rateLimit).mockResolvedValue({ ok: true, retryAfter: 0 })
  vi.mocked(addSignup).mockResolvedValue(undefined as never)
})

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/beta/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validSignup = {
  name: 'Alice Smith',
  email: 'alice@example.com',
  company: 'ACME Construction',
  role: 'Safety Manager',
  crewSize: '50-100',
  reason: 'Need better PTP workflow',
}

describe('POST /api/beta/signup', () => {
  it('returns 429 with Retry-After when rate limited', async () => {
    vi.mocked(rateLimit).mockResolvedValue({ ok: false, retryAfter: 60 })
    const { POST } = await import('@/app/api/beta/signup/route')
    const res = await POST(makeReq(validSignup))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
  })

  it('returns 400 for invalid JSON', async () => {
    const { POST } = await import('@/app/api/beta/signup/route')
    const res = await POST(new Request('http://localhost/api/beta/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when required fields missing', async () => {
    const { POST } = await import('@/app/api/beta/signup/route')
    const res = await POST(makeReq({ name: 'Alice' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('required')
  })

  it('returns 400 for invalid email', async () => {
    const { POST } = await import('@/app/api/beta/signup/route')
    const res = await POST(makeReq({ ...validSignup, email: 'not-an-email' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('email')
  })

  it('returns 400 when input too long', async () => {
    const { POST } = await import('@/app/api/beta/signup/route')
    const res = await POST(makeReq({ ...validSignup, name: 'x'.repeat(101) }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('too long')
  })

  it('caps role length (flows into email/Slack/KV)', async () => {
    const { POST } = await import('@/app/api/beta/signup/route')
    const res = await POST(makeReq({ ...validSignup, role: 'x'.repeat(201) }))
    expect(res.status).toBe(400)
  })

  it('caps crewSize length', async () => {
    const { POST } = await import('@/app/api/beta/signup/route')
    const res = await POST(makeReq({ ...validSignup, crewSize: 'x'.repeat(201) }))
    expect(res.status).toBe(400)
  })

  it('creates signup and returns ok', async () => {
    const { POST } = await import('@/app/api/beta/signup/route')
    const res = await POST(makeReq(validSignup))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.id).toBeTruthy()
    expect(addSignup).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Alice Smith',
      email: 'alice@example.com',
      company: 'ACME Construction',
      status: 'pending',
    }))
  })
})

describe('KV outage (BE-9)', () => {
  it('returns 503 when addSignup throws (KV down)', async () => {
    vi.mocked(addSignup).mockRejectedValue(new Error('kv down'))
    const { POST } = await import('@/app/api/beta/signup/route')
    const res = await POST(makeReq(validSignup))
    expect(res.status).toBe(503)
    const data = await res.json()
    expect(data.error).toContain('temporarily unavailable')
  })
})
