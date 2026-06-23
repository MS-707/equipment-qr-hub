import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let store: Record<string, string>

function setupBrowserGlobals() {
  store = {}
  const mockStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { for (const k in store) delete store[k] },
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
  vi.stubGlobal('window', {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    localStorage: mockStorage,
  })
  vi.stubGlobal('localStorage', mockStorage)
  vi.stubGlobal('navigator', { onLine: true })
  vi.stubGlobal('crypto', {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256)
      return arr
    },
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-23T12:00:00.000Z'))
  setupBrowserGlobals()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.resetModules()
})

async function importModule() {
  return await import('../sds-records')
}

const baseInput = {
  productName: 'Portland Cement',
  manufacturer: 'Quikrete',
  casNumbers: ['65997-15-1'],
  signalWord: 'Danger' as const,
  pictograms: ['GHS07' as const, 'GHS08' as const],
  hazardStatements: ['H315: Causes skin irritation'],
  precautionaryStatements: ['P264: Wash hands after handling'],
  firstAid: { inhalation: 'Move to fresh air', skin: 'Wash with soap', eyes: 'Flush with water', ingestion: 'Rinse mouth' },
  ppeRequired: ['Safety glasses', 'Gloves'],
  fireExtinguishing: 'Not combustible',
  spillProcedure: 'Sweep up',
  storageHandling: 'Keep dry',
  emergencyPhone: '1-800-555-0100',
  sections: [{ number: 1, title: 'Identification', content: 'Portland Cement' }],
}

describe('SDS record lifecycle', () => {
  it('create → read → update → search → favorite → archive', async () => {
    const mod = await importModule()

    const r1 = mod.createSdsRecord(baseInput)
    expect(r1.id).toMatch(/^SDS-2026-/)
    expect(r1.syncStatus).toBe('pending')

    const r2 = mod.createSdsRecord({ ...baseInput, productName: 'Diesel Fuel', signalWord: 'Warning' })
    expect(r2.id).not.toBe(r1.id)

    const all = mod.getAllSdsRecords()
    expect(all).toHaveLength(2)
    expect(all[0].productName).toBe('Diesel Fuel')
    expect(all[1].productName).toBe('Portland Cement')

    const found = mod.getSdsById(r1.id)
    expect(found).toBeDefined()
    expect(found!.productName).toBe('Portland Cement')

    const updated = mod.updateSdsRecord(r1.id, { productName: 'Type I/II Portland Cement' })
    expect(updated).toBeDefined()
    expect(updated!.productName).toBe('Type I/II Portland Cement')
    expect(updated!._searchIndex).toContain('type i/ii portland cement')

    const searchResults = mod.searchSds('portland')
    expect(searchResults).toHaveLength(1)
    expect(searchResults[0].id).toBe(r1.id)

    const searchPPE = mod.searchSds('safety glasses')
    expect(searchPPE).toHaveLength(2)

    const fav = mod.toggleFavorite(r1.id)
    expect(fav).toBeDefined()
    expect(fav!.isFavorite).toBe(true)
    expect(mod.getSdsFavorites()).toHaveLength(1)

    const unfav = mod.toggleFavorite(r1.id)
    expect(unfav!.isFavorite).toBe(false)
    expect(mod.getSdsFavorites()).toHaveLength(0)

    mod.markSdsSynced(r1.id, 'notion-page-123')
    const synced = mod.getSdsById(r1.id)
    expect(synced!.syncStatus).toBe('synced')
    expect(synced!.notionPageId).toBe('notion-page-123')

    mod.markSdsSynced(r2.id, 'notion-page-456')

    vi.setSystemTime(new Date('2027-06-01T12:00:00.000Z'))
    mod.archiveOldSyncedSdsRecords()
    const afterArchive = mod.getAllSdsRecords()
    expect(afterArchive).toHaveLength(0)
  })

  it('create offline → reconnect would change status', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const mod = await importModule()
    const r = mod.createSdsRecord(baseInput)
    expect(r.syncStatus).toBe('offline')
    vi.stubGlobal('navigator', { onLine: true })
  })

  it('backup recovery works after corruption', async () => {
    const mod = await importModule()
    mod.createSdsRecord(baseInput)
    expect(mod.getAllSdsRecords()).toHaveLength(1)

    store['eqr-sds-records'] = 'corrupted data'

    const recovered = mod.getAllSdsRecords()
    expect(recovered).toHaveLength(1)
    expect(recovered[0].productName).toBe('Portland Cement')
  })

  it('getNewSdsCount reflects recent records only', async () => {
    const mod = await importModule()
    mod.createSdsRecord(baseInput)
    expect(mod.getNewSdsCount()).toBe(1)

    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'))
    expect(mod.getNewSdsCount()).toBe(0)
  })

  it('change listener fires on create, update, toggle', async () => {
    const mod = await importModule()
    const listener = vi.fn()
    mod.onSdsChange(listener)

    mod.createSdsRecord(baseInput)
    expect(listener).toHaveBeenCalledTimes(1)

    const all = mod.getAllSdsRecords()
    mod.updateSdsRecord(all[0].id, { productName: 'Updated' })
    expect(listener).toHaveBeenCalledTimes(2)

    mod.toggleFavorite(all[0].id)
    expect(listener).toHaveBeenCalledTimes(3)
  })
})
