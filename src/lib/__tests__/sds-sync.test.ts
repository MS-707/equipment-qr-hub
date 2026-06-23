import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/sds-records', () => ({
  getSdsById: vi.fn(),
  getAllSdsRecords: vi.fn(() => []),
  markSdsSynced: vi.fn(),
  markSdsSyncFailed: vi.fn(),
  createSdsRecord: vi.fn(),
}))

vi.mock('@/lib/sds-schemas', () => ({
  SdsRecordSchema: {
    safeParse: vi.fn((data: unknown) => ({ success: true, data })),
  },
}))

vi.mock('@/components/SyncToast', () => ({
  notifySyncResult: vi.fn(),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import {
  isSdsSyncAvailable,
  trySyncSds,
  syncAllPendingSds,
  checkWebhookQueue,
} from '../sds-sync'
import { getSdsById, getAllSdsRecords, markSdsSynced, markSdsSyncFailed, createSdsRecord } from '../sds-records'
import { SdsRecordSchema } from '../sds-schemas'
import { notifySyncResult } from '@/components/SyncToast'

const mockRecord = {
  id: 'SDS-2026-0001',
  productName: 'Cement',
  syncStatus: 'pending' as const,
}

let timeBase = Date.now() + 3_600_000

beforeEach(() => {
  vi.useFakeTimers()
  timeBase += 3_600_000
  vi.setSystemTime(timeBase)
  vi.mocked(getSdsById).mockReturnValue(undefined)
  vi.mocked(getAllSdsRecords).mockReturnValue([])
  vi.mocked(markSdsSynced).mockClear()
  vi.mocked(markSdsSyncFailed).mockClear()
  vi.mocked(createSdsRecord).mockClear()
  vi.mocked(notifySyncResult).mockClear()
  mockFetch.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('isSdsSyncAvailable', () => {
  it('returns true initially', () => {
    expect(isSdsSyncAvailable()).toBe(true)
  })
})

describe('trySyncSds', () => {
  it('returns false for nonexistent record', async () => {
    vi.mocked(getSdsById).mockReturnValue(undefined)
    const result = await trySyncSds('nope', false)
    expect(result).toBe(false)
  })

  it('returns true on successful sync', async () => {
    vi.mocked(getSdsById).mockReturnValue(mockRecord as never)
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true, notionPageId: 'np-1' }),
    })
    const result = await trySyncSds('SDS-2026-0001', false)
    expect(result).toBe(true)
    expect(markSdsSynced).toHaveBeenCalledWith('SDS-2026-0001', 'np-1')
  })

  it('marks failed after all retries exhausted', async () => {
    vi.mocked(getSdsById).mockReturnValue(mockRecord as never)
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) })
    const p = trySyncSds('SDS-2026-0001', false)
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(4000)
    await vi.advanceTimersByTimeAsync(1000)
    await p
    expect(markSdsSyncFailed).toHaveBeenCalledWith('SDS-2026-0001')
  })

  it('disables sync for 5 min on 503', async () => {
    vi.mocked(getSdsById).mockReturnValue(mockRecord as never)
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({}),
    })
    const result = await trySyncSds('SDS-2026-0001', false)
    expect(result).toBe(false)
    expect(isSdsSyncAvailable()).toBe(false)
  })

  it('shows success toast when notify=true', async () => {
    vi.mocked(getSdsById).mockReturnValue(mockRecord as never)
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true, notionPageId: 'np-1' }),
    })
    await trySyncSds('SDS-2026-0001', true)
    expect(notifySyncResult).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'ok', message: 'SDS synced to cloud' })
    )
  })

  it('shows offline toast when notify=true and navigator offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    vi.mocked(getSdsById).mockReturnValue(mockRecord as never)
    mockFetch.mockRejectedValue(new Error('network'))
    const p = trySyncSds('SDS-2026-0001', true)
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(4000)
    await vi.advanceTimersByTimeAsync(1000)
    await p
    expect(notifySyncResult).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'warn' })
    )
    vi.stubGlobal('navigator', { onLine: true })
  })

  it('deduplicates concurrent sync attempts for same id', async () => {
    vi.mocked(getSdsById).mockReturnValue(mockRecord as never)
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true, notionPageId: 'np-1' }),
    })
    const p1 = trySyncSds('SDS-2026-0001', false)
    const p2 = trySyncSds('SDS-2026-0001', false)
    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toBe(true)
    expect(r2).toBe(false)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

describe('syncAllPendingSds', () => {
  it('syncs all pending records', async () => {
    vi.mocked(getAllSdsRecords).mockReturnValue([
      { ...mockRecord, syncStatus: 'pending' },
      { ...mockRecord, id: 'SDS-2026-0002', syncStatus: 'failed' },
    ] as never)
    vi.mocked(getSdsById).mockReturnValue(mockRecord as never)
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true, notionPageId: 'np-1' }),
    })
    await syncAllPendingSds({ notify: true })
    expect(notifySyncResult).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'ok', message: '2 SDS records synced' })
    )
  })

  it('does nothing when no pending records', async () => {
    vi.mocked(getAllSdsRecords).mockReturnValue([])
    await syncAllPendingSds()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('checkWebhookQueue', () => {
  it('returns 0 when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('network'))
    const count = await checkWebhookQueue()
    expect(count).toBe(0)
  })

  it('returns 0 when response not ok', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    const count = await checkWebhookQueue()
    expect(count).toBe(0)
  })

  it('creates records from valid queue items', async () => {
    const stub = { id: 'SDS-2026-W123', productName: 'Test' }
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ records: [stub] }),
    })
    vi.mocked(getAllSdsRecords).mockReturnValue([])
    const count = await checkWebhookQueue()
    expect(count).toBe(1)
    expect(createSdsRecord).toHaveBeenCalled()
  })

  it('skips duplicate IDs', async () => {
    const stub = { id: 'SDS-2026-0001', productName: 'Test' }
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ records: [stub] }),
    })
    vi.mocked(getAllSdsRecords).mockReturnValue([{ id: 'SDS-2026-0001' }] as never)
    const count = await checkWebhookQueue()
    expect(count).toBe(0)
    expect(createSdsRecord).not.toHaveBeenCalled()
  })

  it('drops records that fail Zod validation', async () => {
    const stub = { id: 'SDS-BAD', productName: 'Test' }
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ records: [stub] }),
    })
    vi.mocked(getAllSdsRecords).mockReturnValue([])
    vi.mocked(SdsRecordSchema.safeParse).mockReturnValue({ success: false, error: { issues: [] } } as never)
    const count = await checkWebhookQueue()
    expect(count).toBe(0)
    expect(createSdsRecord).not.toHaveBeenCalled()
  })
})
