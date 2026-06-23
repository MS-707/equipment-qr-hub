import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/kv', () => ({
  kv: {
    get: vi.fn(),
    set: vi.fn(),
  },
}))

import { kv } from '@/lib/kv'

beforeEach(() => {
  vi.resetModules()
  delete process.env.KV_REST_API_URL
  vi.mocked(kv.get).mockReset()
  vi.mocked(kv.set).mockReset()
})

const baseData = {
  recordId: 'PTP-2026-0001',
  recordType: 'ptp' as const,
  projectName: 'Project X',
  location: 'Site A',
  submitterName: 'Alice',
  submitterEmail: 'alice@example.com',
}

describe('storeReviewSubmission — in-memory', () => {
  it('creates a pending review submission', async () => {
    const { storeReviewSubmission } = await import('../review-store')
    const sub = await storeReviewSubmission(baseData)
    expect(sub.recordId).toBe('PTP-2026-0001')
    expect(sub.status).toBe('pending')
    expect(sub.recordLabel).toBe('Pre-Task Plan')
    expect(sub.submittedAt).toBeTruthy()
  })
})

describe('getReviewSubmission — in-memory', () => {
  it('retrieves a stored submission', async () => {
    const { storeReviewSubmission, getReviewSubmission } = await import('../review-store')
    await storeReviewSubmission(baseData)
    const found = await getReviewSubmission('PTP-2026-0001')
    expect(found?.submitterName).toBe('Alice')
  })

  it('returns undefined for non-existent submission', async () => {
    const { getReviewSubmission } = await import('../review-store')
    expect(await getReviewSubmission('NOPE')).toBeUndefined()
  })
})

describe('decideReview — in-memory', () => {
  it('approves a pending submission', async () => {
    const { storeReviewSubmission, decideReview } = await import('../review-store')
    await storeReviewSubmission(baseData)
    const decided = await decideReview('PTP-2026-0001', 'approved', 'Bob', 'LGTM')
    expect(decided?.status).toBe('approved')
    expect(decided?.decidedBy).toBe('Bob')
    expect(decided?.note).toBe('LGTM')
  })

  it('rejects a pending submission', async () => {
    const { storeReviewSubmission, decideReview } = await import('../review-store')
    await storeReviewSubmission(baseData)
    const decided = await decideReview('PTP-2026-0001', 'rejected', 'Bob', 'Missing hazards')
    expect(decided?.status).toBe('rejected')
  })

  it('prevents double-decide on in-memory store', async () => {
    const { storeReviewSubmission, decideReview } = await import('../review-store')
    await storeReviewSubmission(baseData)
    await decideReview('PTP-2026-0001', 'approved', 'Bob')
    const second = await decideReview('PTP-2026-0001', 'rejected', 'Charlie')
    expect(second?.status).toBe('approved')
  })

  it('truncates note to 500 chars', async () => {
    const { storeReviewSubmission, decideReview } = await import('../review-store')
    await storeReviewSubmission(baseData)
    const longNote = 'x'.repeat(600)
    const decided = await decideReview('PTP-2026-0001', 'approved', 'Bob', longNote)
    expect(decided?.note?.length).toBe(500)
  })

  it('returns undefined for non-existent record', async () => {
    const { decideReview } = await import('../review-store')
    expect(await decideReview('NOPE', 'approved', 'Bob')).toBeUndefined()
  })
})

describe('storeReviewSubmission — KV-backed', () => {
  it('stores to KV when configured', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.com'
    vi.mocked(kv.set).mockResolvedValue('OK')
    const { storeReviewSubmission } = await import('../review-store')
    const sub = await storeReviewSubmission(baseData)
    expect(sub.status).toBe('pending')
    expect(kv.set).toHaveBeenCalledWith(
      expect.stringContaining('review:PTP-2026-0001'),
      expect.objectContaining({ recordId: 'PTP-2026-0001' }),
      expect.objectContaining({ ex: 604800 })
    )
  })
})

describe('decideReview — KV-backed', () => {
  it('uses lock to prevent double-decide', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.com'
    vi.mocked(kv.set).mockResolvedValueOnce('OK')
    vi.mocked(kv.get).mockResolvedValue({ ...baseData, recordLabel: 'PTP', submittedAt: 'now', status: 'pending' } as never)
    vi.mocked(kv.set).mockResolvedValueOnce('OK')
    const { decideReview } = await import('../review-store')
    const decided = await decideReview('PTP-2026-0001', 'approved', 'Bob')
    expect(decided?.status).toBe('approved')
  })

  it('returns existing when lock already taken', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.com'
    vi.mocked(kv.set).mockResolvedValueOnce(null as never)
    vi.mocked(kv.get).mockResolvedValue({ ...baseData, recordLabel: 'PTP', submittedAt: 'now', status: 'approved', decidedBy: 'Bob' } as never)
    const { decideReview } = await import('../review-store')
    const decided = await decideReview('PTP-2026-0001', 'rejected', 'Charlie')
    expect(decided?.status).toBe('approved')
    expect(decided?.decidedBy).toBe('Bob')
  })
})
