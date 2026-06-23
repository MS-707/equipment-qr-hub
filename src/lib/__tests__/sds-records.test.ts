import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SdsRecord } from '../sds-types'

const validInput = {
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

function makeStoredRecord(overrides: Partial<SdsRecord> = {}): SdsRecord {
  return {
    id: 'SDS-2026-0001',
    ...validInput,
    isFavorite: false,
    createdAt: '2026-06-23T00:00:00.000Z',
    updatedAt: '2026-06-23T00:00:00.000Z',
    syncStatus: 'pending',
    _searchIndex: 'portland cement quikrete 65997-15-1 h315: causes skin irritation',
    ...overrides,
  }
}

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

  const mockWindow = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    localStorage: mockStorage,
  }

  vi.stubGlobal('window', mockWindow)
  vi.stubGlobal('localStorage', mockStorage)
  vi.stubGlobal('navigator', { onLine: true })
  vi.stubGlobal('crypto', {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = i
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

describe('getAllSdsRecords', () => {
  it('returns empty array when no records stored', async () => {
    const mod = await importModule()
    expect(mod.getAllSdsRecords()).toEqual([])
  })

  it('returns records sorted by product name', async () => {
    const a = makeStoredRecord({ id: 'SDS-2026-0001', productName: 'Zebra Chemical' })
    const b = makeStoredRecord({ id: 'SDS-2026-0002', productName: 'Alpha Chemical', _searchIndex: 'alpha chemical quikrete 65997-15-1 h315: causes skin irritation' })
    store['eqr-sds-records'] = JSON.stringify([a, b])
    const mod = await importModule()
    const result = mod.getAllSdsRecords()
    expect(result[0].productName).toBe('Alpha Chemical')
    expect(result[1].productName).toBe('Zebra Chemical')
  })
})

describe('getSdsById', () => {
  it('returns undefined for nonexistent id', async () => {
    const mod = await importModule()
    expect(mod.getSdsById('nope')).toBeUndefined()
  })

  it('returns the matching record', async () => {
    store['eqr-sds-records'] = JSON.stringify([makeStoredRecord()])
    const mod = await importModule()
    const result = mod.getSdsById('SDS-2026-0001')
    expect(result?.productName).toBe('Portland Cement')
  })
})

describe('getSdsFavorites', () => {
  it('returns only favorited records', async () => {
    const fav = makeStoredRecord({ id: 'SDS-2026-0001', isFavorite: true })
    const notFav = makeStoredRecord({ id: 'SDS-2026-0002', isFavorite: false, productName: 'Other', _searchIndex: 'other quikrete 65997-15-1' })
    store['eqr-sds-records'] = JSON.stringify([fav, notFav])
    const mod = await importModule()
    const result = mod.getSdsFavorites()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('SDS-2026-0001')
  })
})

describe('getNewSdsCount', () => {
  it('counts records updated in last 7 days', async () => {
    const recent = makeStoredRecord({ updatedAt: '2026-06-22T00:00:00.000Z' })
    const old = makeStoredRecord({ id: 'SDS-2026-0002', productName: 'Old', updatedAt: '2026-06-01T00:00:00.000Z', _searchIndex: 'old' })
    store['eqr-sds-records'] = JSON.stringify([recent, old])
    const mod = await importModule()
    expect(mod.getNewSdsCount()).toBe(1)
  })
})

describe('searchSds', () => {
  it('returns all records for empty query', async () => {
    store['eqr-sds-records'] = JSON.stringify([makeStoredRecord()])
    const mod = await importModule()
    expect(mod.searchSds('')).toHaveLength(1)
  })

  it('matches product name in search index', async () => {
    store['eqr-sds-records'] = JSON.stringify([makeStoredRecord()])
    const mod = await importModule()
    expect(mod.searchSds('portland')).toHaveLength(1)
    expect(mod.searchSds('nonexistent')).toHaveLength(0)
  })

  it('matches PPE and signal word in search index', async () => {
    const mod = await importModule()
    const record = mod.createSdsRecord(validInput)
    expect(record._searchIndex).toContain('safety glasses')
    expect(record._searchIndex).toContain('gloves')
    expect(record._searchIndex).toContain('danger')
  })

  it('matches multiple terms (AND)', async () => {
    store['eqr-sds-records'] = JSON.stringify([makeStoredRecord()])
    const mod = await importModule()
    expect(mod.searchSds('portland quikrete')).toHaveLength(1)
    expect(mod.searchSds('portland unknown')).toHaveLength(0)
  })
})

describe('createSdsRecord', () => {
  it('creates a record with generated id and timestamps', async () => {
    const mod = await importModule()
    const record = mod.createSdsRecord(validInput)
    expect(record.id).toMatch(/^SDS-2026-\d{4}$/)
    expect(record.isFavorite).toBe(false)
    expect(record.createdAt).toBe('2026-06-23T12:00:00.000Z')
    expect(record.updatedAt).toBe('2026-06-23T12:00:00.000Z')
    expect(record.syncStatus).toBe('pending')
    expect(record._searchIndex).toContain('portland cement')
  })

  it('persists to localStorage', async () => {
    const mod = await importModule()
    mod.createSdsRecord(validInput)
    expect(store['eqr-sds-records']).toBeDefined()
    const stored = JSON.parse(store['eqr-sds-records'])
    expect(stored).toHaveLength(1)
    expect(stored[0].productName).toBe('Portland Cement')
  })

  it('sets syncStatus to offline when navigator.onLine is false', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const mod = await importModule()
    const record = mod.createSdsRecord(validInput)
    expect(record.syncStatus).toBe('offline')
  })

  it('increments sequential ID', async () => {
    const mod = await importModule()
    const r1 = mod.createSdsRecord(validInput)
    const r2 = mod.createSdsRecord({ ...validInput, productName: 'Second' })
    expect(r1.id).toBe('SDS-2026-0001')
    expect(r2.id).toBe('SDS-2026-0002')
  })
})

describe('updateSdsRecord', () => {
  it('updates fields and refreshes updatedAt', async () => {
    store['eqr-sds-records'] = JSON.stringify([makeStoredRecord()])
    const mod = await importModule()
    const updated = mod.updateSdsRecord('SDS-2026-0001', { productName: 'Updated Cement' })
    expect(updated?.productName).toBe('Updated Cement')
    expect(updated?.updatedAt).toBe('2026-06-23T12:00:00.000Z')
  })

  it('returns undefined for nonexistent id', async () => {
    const mod = await importModule()
    expect(mod.updateSdsRecord('nope', { productName: 'X' })).toBeUndefined()
  })

  it('rebuilds search index on update', async () => {
    store['eqr-sds-records'] = JSON.stringify([makeStoredRecord()])
    const mod = await importModule()
    const updated = mod.updateSdsRecord('SDS-2026-0001', { productName: 'Diesel Fuel' })
    expect(updated?._searchIndex).toContain('diesel fuel')
    expect(updated?._searchIndex).not.toContain('portland cement')
  })
})

describe('toggleFavorite', () => {
  it('toggles isFavorite from false to true', async () => {
    store['eqr-sds-records'] = JSON.stringify([makeStoredRecord({ isFavorite: false })])
    const mod = await importModule()
    const result = mod.toggleFavorite('SDS-2026-0001')
    expect(result?.isFavorite).toBe(true)
  })

  it('toggles isFavorite from true to false', async () => {
    store['eqr-sds-records'] = JSON.stringify([makeStoredRecord({ isFavorite: true })])
    const mod = await importModule()
    const result = mod.toggleFavorite('SDS-2026-0001')
    expect(result?.isFavorite).toBe(false)
  })

  it('returns undefined for nonexistent id', async () => {
    const mod = await importModule()
    expect(mod.toggleFavorite('nope')).toBeUndefined()
  })
})

describe('onSdsChange', () => {
  it('notifies listeners on create', async () => {
    const mod = await importModule()
    const fn = vi.fn()
    mod.onSdsChange(fn)
    mod.createSdsRecord(validInput)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('notifies listeners on update', async () => {
    store['eqr-sds-records'] = JSON.stringify([makeStoredRecord()])
    const mod = await importModule()
    const fn = vi.fn()
    mod.onSdsChange(fn)
    mod.updateSdsRecord('SDS-2026-0001', { productName: 'X' })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('notifies listeners on toggleFavorite', async () => {
    store['eqr-sds-records'] = JSON.stringify([makeStoredRecord()])
    const mod = await importModule()
    const fn = vi.fn()
    mod.onSdsChange(fn)
    mod.toggleFavorite('SDS-2026-0001')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('unsubscribe stops notifications', async () => {
    const mod = await importModule()
    const fn = vi.fn()
    const unsub = mod.onSdsChange(fn)
    unsub()
    mod.createSdsRecord(validInput)
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('backup recovery', () => {
  it('falls back to backup when primary is corrupt', async () => {
    store['eqr-sds-records'] = 'not json'
    store['eqr-sds-records-backup'] = JSON.stringify([makeStoredRecord()])
    const mod = await importModule()
    const result = mod.getAllSdsRecords()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('SDS-2026-0001')
  })

  it('returns empty when both primary and backup are corrupt', async () => {
    store['eqr-sds-records'] = 'corrupt'
    store['eqr-sds-records-backup'] = 'also corrupt'
    const mod = await importModule()
    expect(mod.getAllSdsRecords()).toEqual([])
  })
})

describe('markSdsSynced', () => {
  it('sets syncStatus to synced and stores notionPageId', async () => {
    store['eqr-sds-records'] = JSON.stringify([makeStoredRecord({ syncStatus: 'pending' })])
    const mod = await importModule()
    mod.markSdsSynced('SDS-2026-0001', 'notion-page-123')
    const record = mod.getSdsById('SDS-2026-0001')
    expect(record?.syncStatus).toBe('synced')
    expect((record as Record<string, unknown>)?.notionPageId).toBe('notion-page-123')
  })

  it('no-ops for nonexistent id', async () => {
    const mod = await importModule()
    mod.markSdsSynced('nope', 'notion-page-123')
    expect(mod.getAllSdsRecords()).toEqual([])
  })

  it('notifies listeners', async () => {
    store['eqr-sds-records'] = JSON.stringify([makeStoredRecord()])
    const mod = await importModule()
    const fn = vi.fn()
    mod.onSdsChange(fn)
    mod.markSdsSynced('SDS-2026-0001', 'np-1')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('markSdsSyncFailed', () => {
  it('sets syncStatus to failed', async () => {
    store['eqr-sds-records'] = JSON.stringify([makeStoredRecord({ syncStatus: 'pending' })])
    const mod = await importModule()
    mod.markSdsSyncFailed('SDS-2026-0001')
    const record = mod.getSdsById('SDS-2026-0001')
    expect(record?.syncStatus).toBe('failed')
  })

  it('no-ops for nonexistent id', async () => {
    const mod = await importModule()
    mod.markSdsSyncFailed('nope')
    expect(mod.getAllSdsRecords()).toEqual([])
  })
})

describe('cryptoRandomId', () => {
  it('returns 32-char hex string', async () => {
    const mod = await importModule()
    const id = mod.cryptoRandomId()
    expect(id).toMatch(/^[0-9a-f]{32}$/)
    expect(id).toHaveLength(32)
  })
})
