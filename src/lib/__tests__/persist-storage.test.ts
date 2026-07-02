import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requestPersistentStorage, _resetPersistRequestGuard } from '@/lib/persist-storage'

/**
 * Persistent-storage request (queue item D2): the browser must be asked not
 * to evict localStorage/IndexedDB — they are the system of record until sync.
 */

beforeEach(() => {
  _resetPersistRequestGuard()
})

function stubStorage(opts: { persisted?: boolean; grant?: boolean; absent?: boolean }) {
  const persist = vi.fn(async () => opts.grant ?? false)
  const persisted = vi.fn(async () => opts.persisted ?? false)
  vi.stubGlobal('navigator', opts.absent ? {} : { storage: { persist, persisted } })
  return { persist, persisted }
}

describe('requestPersistentStorage', () => {
  it('requests persistence and reports the grant', async () => {
    const { persist } = stubStorage({ grant: true })
    expect(await requestPersistentStorage()).toBe(true)
    expect(persist).toHaveBeenCalledOnce()
  })

  it('reports denial without throwing', async () => {
    stubStorage({ grant: false })
    expect(await requestPersistentStorage()).toBe(false)
  })

  it('skips the request when already persisted', async () => {
    const { persist } = stubStorage({ persisted: true })
    expect(await requestPersistentStorage()).toBe(true)
    expect(persist).not.toHaveBeenCalled()
  })

  it('only asks once per session (no nagging)', async () => {
    const { persist } = stubStorage({ grant: false })
    await requestPersistentStorage()
    await requestPersistentStorage()
    await requestPersistentStorage()
    expect(persist).toHaveBeenCalledOnce()
  })

  it('is a no-op when the Storage API is absent', async () => {
    stubStorage({ absent: true })
    expect(await requestPersistentStorage()).toBe(false)
  })
})
