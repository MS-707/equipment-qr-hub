import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/kv', () => ({
  kv: {
    get: vi.fn(),
    set: vi.fn(),
    sadd: vi.fn(),
    smembers: vi.fn(),
  },
}))

import { kv } from '@/lib/kv'

beforeEach(() => {
  vi.resetModules()
  delete process.env.KV_REST_API_URL
  vi.mocked(kv.get).mockReset()
  vi.mocked(kv.set).mockReset()
  vi.mocked(kv.sadd).mockReset()
  vi.mocked(kv.smembers).mockReset()
})

const sampleSignup = {
  id: 'beta-001',
  name: 'Alice',
  email: 'alice@example.com',
  company: 'Acme',
  role: 'Safety Manager',
  crewSize: '10-50',
  reason: 'Need better safety tools',
  status: 'pending' as const,
  createdAt: '2026-06-23T00:00:00Z',
}

describe('beta — in-memory fallback', () => {
  it('adds and retrieves a signup', async () => {
    const { addSignup, getSignup } = await import('../beta')
    await addSignup(sampleSignup)
    const found = await getSignup('beta-001')
    expect(found?.name).toBe('Alice')
    expect(found?.status).toBe('pending')
  })

  it('returns undefined for non-existent signup', async () => {
    const { getSignup } = await import('../beta')
    expect(await getSignup('nope')).toBeUndefined()
  })

  it('lists all signups sorted by date descending', async () => {
    const { addSignup, getAllSignups } = await import('../beta')
    await addSignup({ ...sampleSignup, id: 'beta-001', createdAt: '2026-06-21T00:00:00Z' })
    await addSignup({ ...sampleSignup, id: 'beta-002', createdAt: '2026-06-23T00:00:00Z' })
    const all = await getAllSignups()
    expect(all).toHaveLength(2)
    expect(all[0].id).toBe('beta-002')
  })

  it('updates signup status', async () => {
    const { addSignup, updateSignupStatus } = await import('../beta')
    await addSignup(sampleSignup)
    const updated = await updateSignupStatus('beta-001', 'approved')
    expect(updated?.status).toBe('approved')
    expect(updated?.decidedAt).toBeTruthy()
  })

  it('returns undefined when updating non-existent signup', async () => {
    const { updateSignupStatus } = await import('../beta')
    expect(await updateSignupStatus('nope', 'approved')).toBeUndefined()
  })
})

describe('beta — KV-backed', () => {
  it('stores signup to KV with 180-day TTL', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.com'
    vi.mocked(kv.set).mockResolvedValue('OK')
    vi.mocked(kv.sadd).mockResolvedValue(1)
    const { addSignup } = await import('../beta')
    await addSignup(sampleSignup)
    expect(kv.set).toHaveBeenCalledWith(
      'beta:beta-001',
      expect.objectContaining({ id: 'beta-001' }),
      { ex: 15552000 }
    )
    expect(kv.sadd).toHaveBeenCalledWith('beta:_ids', 'beta-001')
  })

  it('retrieves signup from KV', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.com'
    vi.mocked(kv.get).mockResolvedValue(sampleSignup as never)
    const { getSignup } = await import('../beta')
    const found = await getSignup('beta-001')
    expect(found?.name).toBe('Alice')
  })
})
