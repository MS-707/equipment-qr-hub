import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-auth', () => ({
  requireSession: vi.fn(() => ({
    session: { user: { email: 'test@example.com', name: 'Test' } },
    error: null,
  })),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ ok: true, retryAfter: 0 })),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk/helpers/zod', () => ({
  zodOutputFormat: vi.fn(),
}))

import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'

beforeEach(() => {
  vi.mocked(requireSession).mockReturnValue(
    Promise.resolve({ session: { user: { email: 'test@example.com', name: 'Test' } }, error: null }) as never
  )
  vi.mocked(rateLimit).mockResolvedValue({ ok: true, retryAfter: 0 })
})

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/sds/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/sds/parse guards', () => {
  it('returns 404 when AI_ASSIST is not enabled', async () => {
    const origVal = process.env.NEXT_PUBLIC_AI_ASSIST
    process.env.NEXT_PUBLIC_AI_ASSIST = '0'
    const { POST } = await import('@/app/api/sds/parse/route')
    const res = await POST(makeRequest({ documentBase64: 'test' }))
    expect(res.status).toBe(404)
    process.env.NEXT_PUBLIC_AI_ASSIST = origVal
  })

  it('returns 401 when not authenticated', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    vi.mocked(requireSession).mockResolvedValue({
      session: null,
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    } as never)
    const { POST } = await import('@/app/api/sds/parse/route')
    const res = await POST(makeRequest({ documentBase64: 'test' }))
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    vi.mocked(rateLimit).mockResolvedValue({ ok: false, retryAfter: 30 })
    const { POST } = await import('@/app/api/sds/parse/route')
    const res = await POST(makeRequest({ documentBase64: 'test' }))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('30')
  })

  it('returns 503 when ANTHROPIC_API_KEY is missing', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    const origKey = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    const { POST } = await import('@/app/api/sds/parse/route')
    const res = await POST(makeRequest({ documentBase64: 'test' }))
    expect(res.status).toBe(503)
    if (origKey) process.env.ANTHROPIC_API_KEY = origKey
  })

  it('returns 400 when no PDF provided', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const { POST } = await import('@/app/api/sds/parse/route')
    const res = await POST(makeRequest({ documentBase64: '' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('No PDF')
  })

  it('returns 413 when PDF exceeds size limit', async () => {
    process.env.NEXT_PUBLIC_AI_ASSIST = '1'
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const { POST } = await import('@/app/api/sds/parse/route')
    const bigBase64 = 'A'.repeat(5_700_000)
    const res = await POST(makeRequest({ documentBase64: bigBase64 }))
    expect(res.status).toBe(413)
    const body = await res.json()
    expect(body.error).toContain('too large')
  })
})
