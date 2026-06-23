import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/safety-records', () => ({
  getSafetyRecordById: vi.fn(),
  getAllSafetyRecords: vi.fn(() => []),
  markSynced: vi.fn(),
  markSyncFailed: vi.fn(),
}))
vi.mock('@/components/SyncToast', () => ({
  notifySyncResult: vi.fn(),
}))

vi.stubGlobal('navigator', { onLine: true })

import { getSafetyRecordById, getAllSafetyRecords, markSynced, markSyncFailed } from '@/lib/safety-records'
import { notifySyncResult } from '@/components/SyncToast'

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-23T12:00:00.000Z'))
  vi.stubGlobal('fetch', vi.fn())
  vi.mocked(getSafetyRecordById).mockReset()
  vi.mocked(getAllSafetyRecords).mockReset().mockReturnValue([])
  vi.mocked(markSynced).mockReset()
  vi.mocked(markSyncFailed).mockReset()
  vi.mocked(notifySyncResult).mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

const mockRecord = {
  id: 'PTP-2026-0001',
  type: 'ptp' as const,
  syncStatus: 'pending' as const,
  notionPageId: null,
  events: [],
  createdBy: 'Test',
  createdByEmail: 'test@x.com',
  createdAt: '2026-06-23T00:00:00Z',
  location: 'Site A',
  projectName: 'Test',
}

describe('trySyncRecord', () => {
  it('syncs successfully and shows toast', async () => {
    vi.mocked(getSafetyRecordById).mockReturnValue(mockRecord as never)
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, notionPageId: 'np-123' }),
    } as Response)

    const { trySyncRecord } = await import('../safety-sync')
    const result = await trySyncRecord('PTP-2026-0001')
    expect(result).toBe(true)
    expect(markSynced).toHaveBeenCalledWith('PTP-2026-0001', 'np-123')
    expect(notifySyncResult).toHaveBeenCalledWith(expect.objectContaining({ tone: 'ok' }))
  })

  it('returns false for non-existent record', async () => {
    vi.mocked(getSafetyRecordById).mockReturnValue(undefined)
    const { trySyncRecord } = await import('../safety-sync')
    expect(await trySyncRecord('NOPE')).toBe(false)
  })

  it('skips already-synced record with notionPageId', async () => {
    vi.mocked(getSafetyRecordById).mockReturnValue({ ...mockRecord, notionPageId: 'np-existing' } as never)
    const { trySyncRecord } = await import('../safety-sync')
    const result = await trySyncRecord('PTP-2026-0001')
    expect(result).toBe(true)
    expect(markSynced).toHaveBeenCalledWith('PTP-2026-0001', 'np-existing')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('disables sync for 5min on 503 (not configured)', async () => {
    vi.mocked(getSafetyRecordById).mockReturnValue(mockRecord as never)
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response)
    const { trySyncRecord, isSyncAvailable } = await import('../safety-sync')
    await trySyncRecord('PTP-2026-0001')
    expect(isSyncAvailable()).toBe(false)
  })
})

describe('syncAllPending', () => {
  it('syncs all pending/offline/failed records', async () => {
    vi.mocked(getAllSafetyRecords).mockReturnValue([
      { ...mockRecord, id: 'PTP-001', syncStatus: 'pending' },
      { ...mockRecord, id: 'PTP-002', syncStatus: 'offline' },
    ] as never)
    vi.mocked(getSafetyRecordById).mockImplementation(((id: string) =>
      ({ ...mockRecord, id, syncStatus: 'pending' })
    ) as never)
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, notionPageId: 'np-x' }),
    } as Response)

    const { syncAllPending } = await import('../safety-sync')
    await syncAllPending({ notify: true })
    expect(markSynced).toHaveBeenCalledTimes(2)
    expect(notifySyncResult).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('2 records synced'),
    }))
  })

  it('skips when no pending records', async () => {
    vi.mocked(getAllSafetyRecords).mockReturnValue([])
    const { syncAllPending } = await import('../safety-sync')
    await syncAllPending()
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('isSyncAvailable', () => {
  it('returns true initially', async () => {
    const { isSyncAvailable } = await import('../safety-sync')
    expect(isSyncAvailable()).toBe(true)
  })
})
