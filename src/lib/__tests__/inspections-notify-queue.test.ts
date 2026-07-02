import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Offline EHS notify queue (queue item C5): a notify payload that can't be
 * delivered right now must queue and flush on reconnect — previously the
 * fire-once POST silently dropped offline inspections' EHS alerting.
 */

let store: Record<string, string> = {}
let online = true

vi.stubGlobal('window', {
  ...globalThis,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(() => true),
})
vi.stubGlobal('localStorage', {
  getItem: vi.fn((k: string) => store[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { store[k] = v }),
  removeItem: vi.fn((k: string) => { delete store[k] }),
  get length() { return Object.keys(store).length },
  key: vi.fn(() => null),
})
vi.stubGlobal('navigator', { get onLine() { return online } })

vi.mock('@/lib/work-orders', () => ({ createWorkOrder: vi.fn() }))
vi.mock('@/lib/equipment', () => ({ updateEquipmentStatus: vi.fn(), getEquipmentById: vi.fn() }))

import { queueNotifyPayload, flushNotifyQueue, getNotifyQueueLength } from '@/lib/inspections'

const QUEUE_KEY = 'eqr-notify-queue'

beforeEach(() => {
  store = {}
  online = true
  vi.stubGlobal('fetch', vi.fn())
})

describe('notify queue', () => {
  it('queues payloads durably', () => {
    expect(queueNotifyPayload({ record: { id: 'INS-1' } })).toBe(true)
    expect(getNotifyQueueLength()).toBe(1)
    expect(JSON.parse(store[QUEUE_KEY])[0].payload.record.id).toBe('INS-1')
  })

  it('caps the queue at 50, dropping oldest first', () => {
    for (let i = 0; i < 55; i++) queueNotifyPayload({ record: { id: `INS-${i}` } })
    const q = JSON.parse(store[QUEUE_KEY])
    expect(q).toHaveLength(50)
    expect(q[0].payload.record.id).toBe('INS-5')
  })

  it('flush delivers and dequeues on success', async () => {
    queueNotifyPayload({ record: { id: 'INS-1' } })
    queueNotifyPayload({ record: { id: 'INS-2' } })
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200 } as Response)
    await flushNotifyQueue()
    expect(getNotifyQueueLength()).toBe(0)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('drops permanently-invalid payloads (400) instead of poisoning the queue', async () => {
    queueNotifyPayload({ record: { id: 'BAD' } })
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 400 } as Response)
    await flushNotifyQueue()
    expect(getNotifyQueueLength()).toBe(0)
  })

  it('retains 5xx failures up to 3 attempts, then drops', async () => {
    queueNotifyPayload({ record: { id: 'INS-1' } })
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 502 } as Response)
    await flushNotifyQueue()
    expect(getNotifyQueueLength()).toBe(1)
    await flushNotifyQueue()
    expect(getNotifyQueueLength()).toBe(1)
    await flushNotifyQueue()
    expect(getNotifyQueueLength()).toBe(0) // third strike
  })

  it('a network drop mid-flush preserves the unprocessed tail untouched', async () => {
    queueNotifyPayload({ record: { id: 'INS-1' } })
    queueNotifyPayload({ record: { id: 'INS-2' } })
    queueNotifyPayload({ record: { id: 'INS-3' } })
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockRejectedValueOnce(new TypeError('network dropped'))
    await flushNotifyQueue()
    const q = JSON.parse(store[QUEUE_KEY])
    expect(q).toHaveLength(2)
    expect(q[0].payload.record.id).toBe('INS-2')
    expect(q[0].attempts).toBe(1)
    expect(q[1].payload.record.id).toBe('INS-3')
    expect(q[1].attempts).toBe(0) // never touched this round
  })

  it('does nothing while offline', async () => {
    queueNotifyPayload({ record: { id: 'INS-1' } })
    online = false
    await flushNotifyQueue()
    expect(fetch).not.toHaveBeenCalled()
    expect(getNotifyQueueLength()).toBe(1)
  })
})
