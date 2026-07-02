import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * submitForReview (queue item C3): forms drive their "Submitted for EHS
 * review" banner off this helper's REAL outcome. Offline, expired session
 * (401), rate limit (429), and server errors must all report 'failed' so the
 * success screen never lies about a submission that died.
 */

vi.mock('@/lib/safety-records', () => ({
  getSafetyRecordById: vi.fn(),
  markSubmittedForReview: vi.fn(),
  markSynced: vi.fn(),
}))
vi.mock('@/lib/identity', () => ({
  getCurrentIdentity: vi.fn(() => ({ name: 'Test User', email: 'test@example.com', image: null, verifiedAt: '2026-06-23T00:00:00Z' })),
}))

import { getSafetyRecordById, markSubmittedForReview, markSynced } from '@/lib/safety-records'
import { submitForReview } from '@/lib/review-submit'

const record = {
  id: 'PTP-2026-0001-ab12',
  type: 'ptp',
  notionPageId: null,
  createdByEmail: 'test@example.com',
} as never

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  vi.mocked(getSafetyRecordById).mockReturnValue(record)
  vi.mocked(markSubmittedForReview).mockReset().mockReturnValue(record)
  vi.mocked(markSynced).mockReset()
})

describe('submitForReview', () => {
  it('returns submitted and marks the record on success', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, notionPageId: 'np-1' }),
    } as Response)
    expect(await submitForReview('PTP-2026-0001-ab12')).toBe('submitted')
    expect(markSubmittedForReview).toHaveBeenCalledWith('PTP-2026-0001-ab12', {
      name: 'Test User',
      email: 'test@example.com',
    })
  })

  it('persists the returned notionPageId so later syncs hit the same page', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, notionPageId: 'np-review-1' }),
    } as Response)
    await submitForReview('PTP-2026-0001-ab12')
    expect(markSynced).toHaveBeenCalledWith('PTP-2026-0001-ab12', 'np-review-1')
  })

  it('does not overwrite an existing notionPageId', async () => {
    vi.mocked(getSafetyRecordById).mockReturnValue({ ...record, notionPageId: 'np-existing' } as never)
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, notionPageId: 'np-other' }),
    } as Response)
    await submitForReview('PTP-2026-0001-ab12')
    expect(markSynced).not.toHaveBeenCalled()
  })

  it.each([[401], [429], [502]])('returns failed on HTTP %d', async (status) => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status } as Response)
    expect(await submitForReview('PTP-2026-0001-ab12')).toBe('failed')
    expect(markSubmittedForReview).not.toHaveBeenCalled()
  })

  it('returns failed when offline (network reject)', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await submitForReview('PTP-2026-0001-ab12')).toBe('failed')
  })

  it('returns failed when the record is missing locally', async () => {
    vi.mocked(getSafetyRecordById).mockReturnValue(undefined)
    expect(await submitForReview('NOPE')).toBe('failed')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns failed when the local status write throws (quota)', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as Response)
    vi.mocked(markSubmittedForReview).mockImplementation(() => { throw new Error('quota') })
    expect(await submitForReview('PTP-2026-0001-ab12')).toBe('failed')
  })

  it('a retry after failure can succeed (state is not sticky)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('offline'))
    expect(await submitForReview('PTP-2026-0001-ab12')).toBe('failed')
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as Response)
    expect(await submitForReview('PTP-2026-0001-ab12')).toBe('submitted')
  })
})
