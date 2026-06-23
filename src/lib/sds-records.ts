/**
 * SDS data access layer — THE SWAP POINT.
 *
 * Currently backed by localStorage (records) + IndexedDB (PDF blobs via the
 * shared eqr-photo-store database). To migrate to a remote backend, replace
 * the internal read/write helpers and keep the public API unchanged.
 * Components never touch storage directly.
 */

import type { SdsRecord } from '@/lib/sds-types'
import { safeParseSdsRecords } from '@/lib/sds-schemas'

const STORAGE_KEY = 'eqr-sds-records'
const STORAGE_KEY_BACKUP = 'eqr-sds-records-backup'
const COUNTER_KEY = 'eqr-sds-counter'

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) notify()
  })
}

// ── IndexedDB (shared with inspection/safety photo store) ───

const PHOTO_DB = 'eqr-photo-store'
const PHOTO_STORE = 'photos'

function openBlobDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PHOTO_DB, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(PHOTO_STORE)) {
        req.result.createObjectStore(PHOTO_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveSdsPdf(sdsId: string, dataUrl: string): Promise<void> {
  if (typeof window === 'undefined') return
  const db = await openBlobDB()
  const tx = db.transaction(PHOTO_STORE, 'readwrite')
  tx.objectStore(PHOTO_STORE).put(dataUrl, `sds:${sdsId}:pdf`)
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
  })
  db.close()
}

export async function getSdsPdf(sdsId: string): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const db = await openBlobDB()
  const tx = db.transaction(PHOTO_STORE, 'readonly')
  const store = tx.objectStore(PHOTO_STORE)
  return new Promise<string | null>((resolve) => {
    const req = store.get(`sds:${sdsId}:pdf`)
    req.onsuccess = () => resolve((req.result as string) ?? null)
    req.onerror = () => resolve(null)
  }).finally(() => db.close())
}

// ── Internal record helpers ─────────────────────────────────

function readAll(): SdsRecord[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  const parsed = safeParseSdsRecords(raw)
  if (parsed.length > 0) return parsed
  console.error('[sds-records] Primary store corrupt or empty — attempting backup restore.')
  const backup = localStorage.getItem(STORAGE_KEY_BACKUP)
  if (backup) {
    const recovered = safeParseSdsRecords(backup)
    if (recovered.length > 0) {
      console.warn(`[sds-records] Restored ${recovered.length} record(s) from backup.`)
      try { localStorage.setItem(STORAGE_KEY, backup) } catch { /* quota — leave as-is */ }
      return recovered
    }
    console.error('[sds-records] Backup also corrupt. Returning empty store.')
  }
  try {
    window.dispatchEvent(new CustomEvent('eqr:storage-corruption', { detail: { key: STORAGE_KEY } }))
  } catch { /* SSR guard */ }
  return []
}

function writeAll(records: SdsRecord[]): void {
  if (typeof window === 'undefined') return
  const serialized = JSON.stringify(records)
  try {
    try { localStorage.setItem(STORAGE_KEY_BACKUP, serialized) } catch { /* non-fatal */ }
    localStorage.setItem(STORAGE_KEY, serialized)
  } catch (e) {
    const isQuota =
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    console.error('Failed to save SDS records:', e)
    if (isQuota) {
      throw new Error(
        'Device storage is full. Free up space or sync pending records before continuing.'
      )
    }
    throw e
  }
}

function nextId(): string {
  if (typeof window === 'undefined') return 'SDS-0000-0001'
  const year = new Date().getFullYear()
  let counter = { year: 0, count: 0 }
  try {
    const raw = localStorage.getItem(COUNTER_KEY)
    if (raw) counter = JSON.parse(raw)
  } catch { /* start fresh */ }
  if (counter.year !== year) counter = { year, count: 0 }
  counter.count += 1
  let persisted = false
  try {
    localStorage.setItem(COUNTER_KEY, JSON.stringify(counter))
    persisted = true
  } catch { /* quota — use fallback suffix below */ }
  const seq = String(counter.count).padStart(4, '0')
  if (!persisted) {
    const rand = Math.random().toString(36).slice(2, 6)
    return `SDS-${year}-${seq}-${rand}`
  }
  return `SDS-${year}-${seq}`
}

export function cryptoRandomId(): string {
  const buf = new Uint8Array(16)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}

function nowIso(): string {
  return new Date().toISOString()
}

// ── Search index builder ────────────────────────────────────

function buildSearchIndex(r: Omit<SdsRecord, '_searchIndex' | 'id' | 'isFavorite' | 'createdAt' | 'updatedAt' | 'syncStatus'>): string {
  return [
    r.productName,
    r.manufacturer,
    r.casNumbers.join(' '),
    r.signalWord,
    r.ppeRequired.join(' '),
    r.hazardStatements.join(' '),
  ]
    .join(' ')
    .toLowerCase()
}

// ── Change notification (pub/sub) ───────────────────────────

const listeners = new Set<() => void>()

export function onSdsChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function notify() {
  listeners.forEach((fn) => fn())
}

// ── Reads ───────────────────────────────────────────────────

export function getAllSdsRecords(): SdsRecord[] {
  return readAll().sort((a, b) => a.productName.localeCompare(b.productName))
}

export function getSdsById(id: string): SdsRecord | undefined {
  return readAll().find((r) => r.id === id)
}

export function getSdsFavorites(): SdsRecord[] {
  return getAllSdsRecords().filter((r) => r.isFavorite)
}

export function getNewSdsCount(): number {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  return readAll().filter((r) => new Date(r.updatedAt).getTime() >= sevenDaysAgo).length
}

// ── Search ──────────────────────────────────────────────────

export function searchSds(query: string): SdsRecord[] {
  if (!query.trim()) return getAllSdsRecords()
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  return getAllSdsRecords().filter((r) =>
    terms.every((t) => r._searchIndex.includes(t))
  )
}

// ── Creates ─────────────────────────────────────────────────

export type SdsInput = Omit<SdsRecord, 'id' | 'isFavorite' | 'createdAt' | 'updatedAt' | 'syncStatus' | '_searchIndex'>

export function createSdsRecord(input: SdsInput): SdsRecord {
  const at = nowIso()
  const record: SdsRecord = {
    id: nextId(),
    ...input,
    isFavorite: false,
    createdAt: at,
    updatedAt: at,
    syncStatus: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'pending',
    _searchIndex: buildSearchIndex(input),
  }
  const all = readAll()
  all.push(record)
  writeAll(all)
  notify()
  return record
}

// ── Updates ─────────────────────────────────────────────────

export function updateSdsRecord(id: string, updates: Partial<SdsInput>): SdsRecord | undefined {
  const all = readAll()
  const idx = all.findIndex((r) => r.id === id)
  if (idx === -1) return undefined
  const merged = { ...all[idx], ...updates, updatedAt: nowIso() }
  merged._searchIndex = buildSearchIndex(merged)
  all[idx] = merged
  writeAll(all)
  notify()
  return merged
}

export function toggleFavorite(id: string): SdsRecord | undefined {
  const all = readAll()
  const idx = all.findIndex((r) => r.id === id)
  if (idx === -1) return undefined
  all[idx] = { ...all[idx], isFavorite: !all[idx].isFavorite, updatedAt: nowIso() }
  writeAll(all)
  notify()
  return all[idx]
}

// ── Sync state updates ─────────────────────────────────────

export function markSdsSynced(id: string, notionPageId: string): void {
  const all = readAll()
  const idx = all.findIndex((r) => r.id === id)
  if (idx === -1) return
  all[idx] = { ...all[idx], syncStatus: 'synced', notionPageId, updatedAt: nowIso() } as SdsRecord
  writeAll(all)
  notify()
}

export function markSdsSyncFailed(id: string): void {
  const all = readAll()
  const idx = all.findIndex((r) => r.id === id)
  if (idx === -1) return
  all[idx] = { ...all[idx], syncStatus: 'failed', updatedAt: nowIso() }
  writeAll(all)
  notify()
}

// ── Seed data ───────────────────────────────────────────────

const SEED_FLAG = 'eqr-sds-seeded'

export async function seedSdsIfNeeded(): Promise<void> {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(SEED_FLAG)) return
  const existing = readAll()
  if (existing.length > 0) {
    localStorage.setItem(SEED_FLAG, '1')
    return
  }
  try {
    const res = await fetch('/sds/seed.json')
    if (!res.ok) {
      console.error('[sds-records] Failed to fetch seed data:', res.status)
      return
    }
    const seeds = (await res.json()) as SdsInput[]
    const at = nowIso()
    const records: SdsRecord[] = seeds.map((s) => ({
      id: nextId(),
      ...s,
      isFavorite: false,
      createdAt: at,
      updatedAt: at,
      syncStatus: 'synced' as const,
      _searchIndex: buildSearchIndex(s),
    }))
    writeAll(records)
    localStorage.setItem(SEED_FLAG, '1')
    notify()
  } catch (e) {
    console.error('[sds-records] Seed load failed:', e)
  }
}
