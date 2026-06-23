import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'crypto'

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => Promise.resolve({ ok: true, retryAfter: 0 })),
}))

vi.mock('@/lib/kv', () => ({
  kv: {
    get: vi.fn(() => Promise.resolve(null)),
    set: vi.fn(() => Promise.resolve()),
    incr: vi.fn(() => Promise.resolve(1)),
    lpush: vi.fn(() => Promise.resolve()),
  },
}))

import { rateLimit } from '@/lib/rate-limit'
import { kv } from '@/lib/kv'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const SECRET = 'test-webhook-secret'

function signPayload(body: string, timestamp: string): string {
  const sigBasestring = `v0:${timestamp}:${body}`
  return `v0=${createHmac('sha256', SECRET).update(sigBasestring).digest('hex')}`
}

function makeSignedRequest(payload: Record<string, unknown>, overrides?: { timestamp?: string; signature?: string }): Request {
  const body = JSON.stringify(payload)
  const timestamp = overrides?.timestamp ?? String(Math.floor(Date.now() / 1000))
  const signature = overrides?.signature ?? signPayload(body, timestamp)
  return new Request('http://localhost/api/sds/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': signature,
      'x-forwarded-for': '10.0.0.1',
    },
    body,
  })
}

const validPayload = {
  chemical_name: 'Portland Cement',
  manufacturer: 'Quikrete',
  cas_number: '65997-15-1',
  approved_by: 'safety-admin',
  event_id: 'evt-001',
}

beforeEach(() => {
  vi.mocked(rateLimit).mockResolvedValue({ ok: true, retryAfter: 0 })
  vi.mocked(kv.get).mockResolvedValue(null)
  vi.mocked(kv.set).mockResolvedValue(undefined as never)
  vi.mocked(kv.incr).mockResolvedValue(1)
  vi.mocked(kv.lpush).mockResolvedValue(undefined as never)
  mockFetch.mockReset()
  process.env.SLACK_SDS_WEBHOOK_SECRET = SECRET
  process.env.KV_REST_API_URL = 'https://kv.example.com'
  delete process.env.SLACK_WEBHOOK_URL
})

describe('/api/sds/webhook', () => {
  it('returns 503 when webhook secret not configured', async () => {
    delete process.env.SLACK_SDS_WEBHOOK_SECRET
    const { POST } = await import('@/app/api/sds/webhook/route')
    const req = makeSignedRequest(validPayload)
    const res = await POST(req)
    expect(res.status).toBe(503)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimit).mockResolvedValue({ ok: false, retryAfter: 60 })
    const { POST } = await import('@/app/api/sds/webhook/route')
    const res = await POST(makeSignedRequest(validPayload))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
  })

  it('returns 401 for invalid signature', async () => {
    const { POST } = await import('@/app/api/sds/webhook/route')
    const res = await POST(makeSignedRequest(validPayload, { signature: 'v0=bad' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 for stale timestamp (>5 min)', async () => {
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 600)
    const body = JSON.stringify(validPayload)
    const sig = signPayload(body, staleTimestamp)
    const { POST } = await import('@/app/api/sds/webhook/route')
    const res = await POST(makeSignedRequest(validPayload, {
      timestamp: staleTimestamp,
      signature: sig,
    }))
    expect(res.status).toBe(401)
  })

  it('handles Slack url_verification challenge', async () => {
    const challengePayload = {
      type: 'url_verification',
      challenge: 'abc-challenge-xyz',
      chemical_name: '',
      event_id: '',
    }
    const { POST } = await import('@/app/api/sds/webhook/route')
    const res = await POST(makeSignedRequest(challengePayload))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.challenge).toBe('abc-challenge-xyz')
  })

  it('returns 400 when missing required fields', async () => {
    const { POST } = await import('@/app/api/sds/webhook/route')
    const res = await POST(makeSignedRequest({ event_id: 'evt-002' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Missing required fields')
  })

  it('deduplicates events already in KV', async () => {
    vi.mocked(kv.get).mockResolvedValue('1')
    const { POST } = await import('@/app/api/sds/webhook/route')
    const res = await POST(makeSignedRequest(validPayload))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.action).toBe('already-exists')
    expect(kv.lpush).not.toHaveBeenCalled()
  })

  it('creates SDS stub and stores in KV queue', async () => {
    const { POST } = await import('@/app/api/sds/webhook/route')
    const res = await POST(makeSignedRequest(validPayload))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.action).toBe('created')
    expect(body.sdsId).toMatch(/^SDS-\d{4}-\d{4}$/)
    expect(kv.lpush).toHaveBeenCalledWith('sds-webhook-queue', expect.any(String))
    const storedStub = JSON.parse(vi.mocked(kv.lpush).mock.calls[0][1] as string)
    expect(storedStub.productName).toBe('Portland Cement')
    expect(storedStub.manufacturer).toBe('Quikrete')
    expect(storedStub.casNumbers).toEqual(['65997-15-1'])
  })

  it('stores backup copy in KV with 7-day TTL', async () => {
    const { POST } = await import('@/app/api/sds/webhook/route')
    await POST(makeSignedRequest(validPayload))
    expect(kv.set).toHaveBeenCalledWith(
      expect.stringMatching(/^sds:SDS-\d{4}-\d{4}$/),
      expect.any(String),
      { ex: 7 * 86400 }
    )
  })

  it('returns 503 when KV not configured', async () => {
    delete process.env.KV_REST_API_URL
    const { POST } = await import('@/app/api/sds/webhook/route')
    const uniquePayload = { ...validPayload, event_id: 'evt-kv-missing' }
    const res = await POST(makeSignedRequest(uniquePayload))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toContain('KV storage not configured')
  })

  it('returns 502 when KV write fails', async () => {
    vi.mocked(kv.lpush).mockRejectedValue(new Error('KV unavailable'))
    const { POST } = await import('@/app/api/sds/webhook/route')
    const res = await POST(makeSignedRequest(validPayload))
    expect(res.status).toBe(502)
  })

  it('fires Slack notification when SLACK_WEBHOOK_URL set', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test'
    mockFetch.mockResolvedValue({ ok: true })
    const { POST } = await import('@/app/api/sds/webhook/route')
    await POST(makeSignedRequest(validPayload))
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Portland Cement'),
      })
    )
  })

  it('generates fallback ID when KV incr fails', async () => {
    vi.mocked(kv.incr).mockRejectedValue(new Error('incr failed'))
    const { POST } = await import('@/app/api/sds/webhook/route')
    const res = await POST(makeSignedRequest(validPayload))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sdsId).toMatch(/^SDS-\d{4}-W[a-z0-9]+$/)
  })
})
