import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/kv', () => ({
  kv: {
    sadd: vi.fn(),
    expire: vi.fn(),
  },
}))

import { kv } from '@/lib/kv'

beforeEach(() => {
  vi.resetModules()
  delete process.env.KV_REST_API_URL
  vi.mocked(kv.sadd).mockReset()
  vi.mocked(kv.expire).mockReset()
})

describe('isFirstLogin — in-memory', () => {
  it('returns true for first login', async () => {
    const { isFirstLogin } = await import('../user-tracker')
    expect(await isFirstLogin('alice@example.com')).toBe(true)
  })

  it('returns false for repeated login', async () => {
    const { isFirstLogin } = await import('../user-tracker')
    await isFirstLogin('bob@example.com')
    expect(await isFirstLogin('bob@example.com')).toBe(false)
  })

  it('normalizes email case and whitespace', async () => {
    const { isFirstLogin } = await import('../user-tracker')
    await isFirstLogin('Carol@Example.COM')
    expect(await isFirstLogin('  carol@example.com  ')).toBe(false)
  })
})

describe('isFirstLogin — KV-backed', () => {
  it('uses KV when configured', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.com'
    vi.mocked(kv.sadd).mockResolvedValue(1)
    vi.mocked(kv.expire).mockResolvedValue(1)
    const { isFirstLogin } = await import('../user-tracker')
    const result = await isFirstLogin('dave@example.com')
    expect(result).toBe(true)
    expect(kv.sadd).toHaveBeenCalledWith('known-users', 'dave@example.com')
    expect(kv.expire).toHaveBeenCalled()
  })

  it('returns false when KV says already seen', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.com'
    vi.mocked(kv.sadd).mockResolvedValue(0)
    vi.mocked(kv.expire).mockResolvedValue(1)
    const { isFirstLogin } = await import('../user-tracker')
    expect(await isFirstLogin('existing@example.com')).toBe(false)
  })
})
