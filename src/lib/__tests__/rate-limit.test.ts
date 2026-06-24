import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/kv', () => ({
  kv: {
    incr: vi.fn(() => Promise.resolve(1)),
    expire: vi.fn(() => Promise.resolve()),
  },
}))

import { kv } from '@/lib/kv'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-23T12:00:00.000Z'))
  vi.mocked(kv.incr).mockResolvedValue(1)
  vi.mocked(kv.expire).mockResolvedValue(undefined as never)
  delete process.env.KV_REST_API_URL
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetModules()
})

describe('rateLimit — in-memory fallback', () => {
  it('allows requests within limit', async () => {
    const { rateLimit } = await import('../rate-limit')
    const r1 = await rateLimit('test-key', 3, 60_000)
    expect(r1.ok).toBe(true)
    const r2 = await rateLimit('test-key', 3, 60_000)
    expect(r2.ok).toBe(true)
    const r3 = await rateLimit('test-key', 3, 60_000)
    expect(r3.ok).toBe(true)
  })

  it('blocks requests over limit', async () => {
    const { rateLimit } = await import('../rate-limit')
    await rateLimit('block-key', 2, 60_000)
    await rateLimit('block-key', 2, 60_000)
    const r3 = await rateLimit('block-key', 2, 60_000)
    expect(r3.ok).toBe(false)
    expect(r3.retryAfter).toBeGreaterThan(0)
  })

  it('resets after window expires', async () => {
    const { rateLimit } = await import('../rate-limit')
    await rateLimit('reset-key', 1, 10_000)
    const blocked = await rateLimit('reset-key', 1, 10_000)
    expect(blocked.ok).toBe(false)

    vi.advanceTimersByTime(11_000)

    const fresh = await rateLimit('reset-key', 1, 10_000)
    expect(fresh.ok).toBe(true)
  })

  it('tracks different keys independently', async () => {
    const { rateLimit } = await import('../rate-limit')
    await rateLimit('key-a', 1, 60_000)
    const a2 = await rateLimit('key-a', 1, 60_000)
    expect(a2.ok).toBe(false)

    const b1 = await rateLimit('key-b', 1, 60_000)
    expect(b1.ok).toBe(true)
  })
})

describe('rateLimit — KV-backed', () => {
  it('uses KV when KV_REST_API_URL is set', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.com'
    const { rateLimit } = await import('../rate-limit')
    const result = await rateLimit('kv-key', 10, 60_000)
    expect(result.ok).toBe(true)
    expect(kv.incr).toHaveBeenCalled()
  })

  it('sets expiry on first request in bucket', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.com'
    vi.mocked(kv.incr).mockResolvedValue(1)
    const { rateLimit } = await import('../rate-limit')
    await rateLimit('expire-key', 10, 60_000)
    expect(kv.expire).toHaveBeenCalled()
  })

  it('blocks when KV count exceeds limit', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.com'
    vi.mocked(kv.incr).mockResolvedValue(11)
    const { rateLimit } = await import('../rate-limit')
    const result = await rateLimit('over-key', 10, 60_000)
    expect(result.ok).toBe(false)
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('falls back to memory on KV error', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.com'
    vi.mocked(kv.incr).mockRejectedValue(new Error('KV down'))
    const { rateLimit } = await import('../rate-limit')
    const result = await rateLimit('fallback-key', 10, 60_000)
    expect(result.ok).toBe(true)
  })
})
