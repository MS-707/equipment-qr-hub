/**
 * Safety Hub data access layer — THE SWAP POINT.
 *
 * Currently backed by localStorage (records) + IndexedDB (signature/photo blobs).
 * To migrate to Notion/Supabase, replace the internal read/write helpers and keep
 * the public API unchanged. Components never touch storage directly.
 *
 * AUDIT INTEGRITY: there is intentionally NO generic update(). Post-creation, the
 * only allowed mutations are:
 *   (a) appending AuditEvents,
 *   (b) permit status transitions via closePermit / revokePermit,
 *   (c) sync-state updates via markSynced / markSyncFailed.
 * Corrections are modeled as new records or 'amended' events — never silent edits.
 */

import type {
  SafetyRecord,
  SafetyRecordType,
  AnyPermit,
  PreTaskPlan,
  HeightPermit,
  HotWorkPermit,
  ConfinedSpacePermit,
  IncidentReport,
  CrewSignature,
} from '@/lib/safety-types'
import { isPermit } from '@/lib/safety-types'
import { getCurrentIdentity } from '@/lib/identity'

const STORAGE_KEY = 'eqr-safety-records'
const COUNTER_KEY = 'eqr-safety-counters'

const ID_PREFIX: Record<SafetyRecordType, string> = {
  'ptp': 'PTP',
  'height-permit': 'WAH',
  'hot-work-permit': 'HWP',
  'confined-space-permit': 'CSP',
  'incident-report': 'INC',
}

// ── IndexedDB blob storage (signatures + incident photos) ────
// Reuses the same DB/store as inspection photos. Keys: `${recordId}:${slotId}`.

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

async function putBlobs(recordId: string, blobs: { id: string; dataUrl: string }[]): Promise<void> {
  if (typeof window === 'undefined' || blobs.length === 0) return
  const db = await openBlobDB()
  const tx = db.transaction(PHOTO_STORE, 'readwrite')
  const store = tx.objectStore(PHOTO_STORE)
  for (const b of blobs) store.put(b.dataUrl, `${recordId}:${b.id}`)
  await new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
  db.close()
}

export async function saveSignatures(recordId: string, sigs: { id: string; dataUrl: string }[]): Promise<void> {
  return putBlobs(recordId, sigs)
}

export async function savePhotosForRecord(recordId: string, photos: { id: string; dataUrl: string }[]): Promise<void> {
  return putBlobs(recordId, photos)
}

export async function getBlobs(recordId: string, slotIds: string[]): Promise<Record<string, string>> {
  if (typeof window === 'undefined' || slotIds.length === 0) return {}
  const db = await openBlobDB()
  const tx = db.transaction(PHOTO_STORE, 'readonly')
  const store = tx.objectStore(PHOTO_STORE)
  const result: Record<string, string> = {}
  await Promise.all(
    slotIds.map(
      (id) =>
        new Promise<void>((resolve) => {
          const req = store.get(`${recordId}:${id}`)
          req.onsuccess = () => {
            if (req.result) result[id] = req.result as string
            resolve()
          }
          req.onerror = () => resolve()
        })
    )
  )
  db.close()
  return result
}

// ── Internal record helpers ──────────────────────────────────

function readAll(): SafetyRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SafetyRecord[]) : []
  } catch {
    return []
  }
}

function writeAll(records: SafetyRecord[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch (e) {
    console.error('Failed to save safety records:', e)
  }
}

function nextId(type: SafetyRecordType): string {
  const prefix = ID_PREFIX[type]
  if (typeof window === 'undefined') return `${prefix}-0000-0001`
  const year = new Date().getFullYear()
  let counters: Record<string, { year: number; count: number }> = {}
  try {
    const raw = localStorage.getItem(COUNTER_KEY)
    if (raw) counters = JSON.parse(raw)
  } catch {
    /* start fresh */
  }
  let c = counters[prefix]
  if (!c || c.year !== year) c = { year, count: 0 }
  c.count += 1
  counters[prefix] = c
  try { localStorage.setItem(COUNTER_KEY, JSON.stringify(counters)) } catch { /* non-fatal */ }
  return `${prefix}-${year}-${String(c.count).padStart(4, '0')}`
}

function identityStamp(): { createdBy: string; createdByEmail: string | null } {
  const id = getCurrentIdentity()
  return {
    createdBy: id?.name ?? 'Unknown',
    createdByEmail: id?.email ?? null,
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

// ── Change notification (pub/sub) ────────────────────────────

const listeners = new Set<() => void>()

export function onSafetyChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function notify() {
  listeners.forEach((fn) => fn())
}

// ── Reads ─────────────────────────────────────────────────────

export function getAllSafetyRecords(): SafetyRecord[] {
  return readAll().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function getSafetyRecordById(id: string): SafetyRecord | undefined {
  return readAll().find((r) => r.id === id)
}

export function getSafetyRecordsByType(type: SafetyRecordType): SafetyRecord[] {
  return getAllSafetyRecords().filter((r) => r.type === type)
}

export function getRecordsForDate(date: string): SafetyRecord[] {
  return getAllSafetyRecords().filter((r) => r.createdAt.slice(0, 10) === date)
}

export function getPtpForDate(date: string): PreTaskPlan | undefined {
  return getAllSafetyRecords().find(
    (r): r is PreTaskPlan => r.type === 'ptp' && (r as PreTaskPlan).date === date
  )
}

export function isExpired(p: AnyPermit): boolean {
  return new Date().getTime() > new Date(p.validUntil).getTime()
}

export function permitDisplayStatus(p: AnyPermit): 'active' | 'closed' | 'revoked' | 'expired' {
  if (p.status === 'active' && isExpired(p)) return 'expired'
  return p.status
}

export function getActivePermits(): AnyPermit[] {
  return getAllSafetyRecords().filter(
    (r): r is AnyPermit => isPermit(r) && r.status === 'active' && !isExpired(r)
  )
}

/** Open items for the nav badge: active (non-expired) permits + unresolved incidents (7d). */
export function getOpenSafetyCount(): number {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const records = readAll()
  const activePermits = records.filter(
    (r) => isPermit(r) && (r as AnyPermit).status === 'active' && !isExpired(r as AnyPermit)
  ).length
  const recentIncidents = records.filter(
    (r) => r.type === 'incident-report' && new Date(r.createdAt).getTime() >= sevenDaysAgo
  ).length
  return activePermits + recentIncidents
}

// ── Creates ───────────────────────────────────────────────────

function createBase<T extends SafetyRecord>(record: T): T {
  const all = readAll()
  all.push(record)
  writeAll(all)
  notify()
  return record
}

export type PtpInput = Omit<
  PreTaskPlan,
  'id' | 'type' | 'createdBy' | 'createdByEmail' | 'createdAt' | 'syncStatus' | 'notionPageId' | 'events'
>

export function createPreTaskPlan(input: PtpInput): PreTaskPlan {
  const id = nextId('ptp')
  const stamp = identityStamp()
  const at = nowIso()
  const record: PreTaskPlan = {
    id,
    type: 'ptp',
    ...stamp,
    createdAt: at,
    syncStatus: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'pending',
    notionPageId: null,
    events: [{ action: 'created', by: stamp.createdBy, byEmail: stamp.createdByEmail, at }],
    ...input,
  }
  return createBase(record)
}

export type HeightPermitInput = Omit<
  HeightPermit,
  'id' | 'type' | 'status' | 'createdBy' | 'createdByEmail' | 'createdAt' | 'syncStatus' | 'notionPageId' | 'events' | 'closedAt' | 'closedBy'
>

export function createHeightPermit(input: HeightPermitInput): HeightPermit {
  const id = nextId('height-permit')
  const stamp = identityStamp()
  const at = nowIso()
  const record: HeightPermit = {
    id,
    type: 'height-permit',
    status: 'active',
    ...stamp,
    createdAt: at,
    syncStatus: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'pending',
    notionPageId: null,
    events: [{ action: 'created', by: stamp.createdBy, byEmail: stamp.createdByEmail, at }],
    closedAt: null,
    closedBy: null,
    ...input,
  }
  return createBase(record)
}

export type HotWorkPermitInput = Omit<
  HotWorkPermit,
  'id' | 'type' | 'status' | 'createdBy' | 'createdByEmail' | 'createdAt' | 'syncStatus' | 'notionPageId' | 'events' | 'closedAt' | 'closedBy'
>

export function createHotWorkPermit(input: HotWorkPermitInput): HotWorkPermit {
  const id = nextId('hot-work-permit')
  const stamp = identityStamp()
  const at = nowIso()
  const record: HotWorkPermit = {
    id,
    type: 'hot-work-permit',
    status: 'active',
    ...stamp,
    createdAt: at,
    syncStatus: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'pending',
    notionPageId: null,
    events: [{ action: 'created', by: stamp.createdBy, byEmail: stamp.createdByEmail, at }],
    closedAt: null,
    closedBy: null,
    ...input,
  }
  return createBase(record)
}

export type ConfinedSpaceInput = Omit<
  ConfinedSpacePermit,
  'id' | 'type' | 'status' | 'createdBy' | 'createdByEmail' | 'createdAt' | 'syncStatus' | 'notionPageId' | 'events' | 'closedAt' | 'closedBy'
>

export function createConfinedSpacePermit(input: ConfinedSpaceInput): ConfinedSpacePermit {
  const id = nextId('confined-space-permit')
  const stamp = identityStamp()
  const at = nowIso()
  const record: ConfinedSpacePermit = {
    id,
    type: 'confined-space-permit',
    status: 'active',
    ...stamp,
    createdAt: at,
    syncStatus: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'pending',
    notionPageId: null,
    events: [{ action: 'created', by: stamp.createdBy, byEmail: stamp.createdByEmail, at }],
    closedAt: null,
    closedBy: null,
    ...input,
  }
  return createBase(record)
}

export type IncidentInput = Omit<
  IncidentReport,
  'id' | 'type' | 'createdBy' | 'createdByEmail' | 'createdAt' | 'syncStatus' | 'notionPageId' | 'events'
>

export function createIncidentReport(input: IncidentInput): IncidentReport {
  const id = nextId('incident-report')
  const stamp = identityStamp()
  const at = nowIso()
  const record: IncidentReport = {
    id,
    type: 'incident-report',
    ...stamp,
    createdAt: at,
    syncStatus: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'pending',
    notionPageId: null,
    events: [{ action: 'created', by: stamp.createdBy, byEmail: stamp.createdByEmail, at }],
    ...input,
  }
  return createBase(record)
}

// ── Permit lifecycle transitions (append-only) ───────────────

export function closePermit(id: string, by: { name: string; email: string | null }): SafetyRecord | undefined {
  const all = readAll()
  const idx = all.findIndex((r) => r.id === id)
  if (idx === -1) return undefined
  const rec = all[idx]
  if (!isPermit(rec)) return rec
  const at = nowIso()
  all[idx] = {
    ...rec,
    status: 'closed',
    closedAt: at,
    closedBy: by.name,
    events: [...rec.events, { action: 'closed', by: by.name, byEmail: by.email, at }],
  }
  writeAll(all)
  notify()
  return all[idx]
}

export function revokePermit(
  id: string,
  by: { name: string; email: string | null },
  note: string
): SafetyRecord | undefined {
  const all = readAll()
  const idx = all.findIndex((r) => r.id === id)
  if (idx === -1) return undefined
  const rec = all[idx]
  if (!isPermit(rec)) return rec
  const at = nowIso()
  all[idx] = {
    ...rec,
    status: 'revoked',
    closedAt: at,
    closedBy: by.name,
    events: [...rec.events, { action: 'revoked', by: by.name, byEmail: by.email, at, note }],
  }
  writeAll(all)
  notify()
  return all[idx]
}

// ── Sync state updates ───────────────────────────────────────

export function markSynced(id: string, notionPageId: string): void {
  const all = readAll()
  const idx = all.findIndex((r) => r.id === id)
  if (idx === -1) return
  const at = nowIso()
  all[idx] = {
    ...all[idx],
    syncStatus: 'synced',
    notionPageId,
    events: [...all[idx].events, { action: 'synced', by: 'system', byEmail: null, at }],
  }
  writeAll(all)
  notify()
}

export function markSyncFailed(id: string): void {
  const all = readAll()
  const idx = all.findIndex((r) => r.id === id)
  if (idx === -1) return
  all[idx] = { ...all[idx], syncStatus: 'failed' }
  writeAll(all)
  notify()
}

// ── Signature roster helpers ─────────────────────────────────

export function newSignature(data: {
  name: string
  email?: string | null
  role?: string | null
  hasSignature: boolean
}): CrewSignature {
  return {
    id: cryptoRandomId(),
    name: data.name,
    email: data.email ?? null,
    role: data.role ?? null,
    hasSignature: data.hasSignature,
    signedAt: nowIso(),
  }
}

export function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ── CSV export ────────────────────────────────────────────────

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return `"${s.replace(/"/g, '""')}"`
}

export function exportSafetyToCsv(records: SafetyRecord[]): string {
  const headers = [
    'ID', 'Type', 'Project', 'Location', 'Created_By', 'Created_At',
    'Status_Or_Result', 'Signatures', 'Sync_Status',
  ]
  const rows = records.map((r) => {
    let statusOrResult = ''
    let sigCount = 0
    if (r.type === 'ptp') {
      statusOrResult = 'logged'
      sigCount = (r as PreTaskPlan).crewSignatures.length
    } else if (isPermit(r)) {
      statusOrResult = permitDisplayStatus(r as AnyPermit)
      const p = r as AnyPermit
      sigCount = ('workers' in p ? p.workers.length : 0) + ('entrants' in p ? (p as ConfinedSpacePermit).entrants.length : 0)
    } else if (r.type === 'incident-report') {
      statusOrResult = (r as IncidentReport).severity
    }
    return [
      r.id, r.type, csvCell(r.projectName), csvCell(r.location),
      csvCell(r.createdBy), r.createdAt, statusOrResult, sigCount, r.syncStatus,
    ].join(',')
  })
  return [headers.join(','), ...rows].join('\n')
}
