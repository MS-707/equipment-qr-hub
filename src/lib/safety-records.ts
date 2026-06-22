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
  JobHazardAnalysis,
  HeightPermit,
  HotWorkPermit,
  ConfinedSpacePermit,
  IncidentReport,
  CrewSignature,
} from '@/lib/safety-types'
import { isPermit } from '@/lib/safety-types'
import { getCurrentIdentity } from '@/lib/identity'
import { safeParseSafetyRecords } from '@/lib/schemas'

const STORAGE_KEY = 'eqr-safety-records'
const STORAGE_KEY_BACKUP = 'eqr-safety-records-backup'
const COUNTER_KEY = 'eqr-safety-counters'

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) notify()
  })
}

const ID_PREFIX: Record<SafetyRecordType, string> = {
  'ptp': 'PTP',
  'jha': 'JHA',
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
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
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
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  const records = safeParseSafetyRecords(raw)
  if (records.length > 0) {
    return records.map((r) => ({ reviewStatus: undefined, ...r }))
  }
  console.error('[safety-records] Primary store corrupt or empty — attempting backup restore.')
  const backup = localStorage.getItem(STORAGE_KEY_BACKUP)
  if (backup) {
    const recovered = safeParseSafetyRecords(backup)
    if (recovered.length > 0) {
      console.warn(`[safety-records] Restored ${recovered.length} record(s) from backup.`)
      try { localStorage.setItem(STORAGE_KEY, backup) } catch { /* quota — leave as-is */ }
      return recovered.map((r) => ({ reviewStatus: undefined, ...r }))
    }
    console.error('[safety-records] Backup also corrupt. Returning empty store.')
  }
  try {
    window.dispatchEvent(new CustomEvent('eqr:storage-corruption', { detail: { key: STORAGE_KEY } }))
  } catch { /* SSR guard */ }
  return []
}

function writeAll(records: SafetyRecord[]): void {
  if (typeof window === 'undefined') return
  const serialized = JSON.stringify(records)
  try {
    // Write backup first so the last known-good copy is never newer than primary.
    // Ignore quota errors on the backup — it is best-effort.
    try { localStorage.setItem(STORAGE_KEY_BACKUP, serialized) } catch { /* non-fatal */ }
    localStorage.setItem(STORAGE_KEY, serialized)
  } catch (e) {
    // Re-throw so callers (createBase, closePermit, etc.) can surface the
    // failure to the UI instead of silently losing data.
    const isQuota =
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    console.error('Failed to save safety records:', e)
    if (isQuota) {
      throw new Error(
        'Device storage is full. Free up space or sync pending records before continuing.'
      )
    }
    throw e
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
  let persisted = false
  try {
    localStorage.setItem(COUNTER_KEY, JSON.stringify(counters))
    persisted = true
  } catch { /* quota — use fallback suffix below */ }
  const seq = String(c.count).padStart(4, '0')
  if (!persisted) {
    const rand = Math.random().toString(36).slice(2, 6)
    return `${prefix}-${year}-${seq}-${rand}`
  }
  return `${prefix}-${year}-${seq}`
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
    (r): r is PreTaskPlan => {
      if (r.type !== 'ptp') return false
      const ptp = r as PreTaskPlan
      if (ptp.validUntil) return ptp.date <= date && date <= ptp.validUntil
      return ptp.date === date
    }
  )
}

export type PtpDateStatus = { ptp: PreTaskPlan; status: 'active' } | { ptp: PreTaskPlan; status: 'expired' } | { ptp: undefined; status: 'none' }

export function getPtpStatusForDate(date: string): PtpDateStatus {
  const active = getPtpForDate(date)
  if (active) return { ptp: active, status: 'active' }
  const latest = getLatestPtp()
  if (latest?.validUntil && latest.validUntil < date && latest.date <= date) {
    return { ptp: latest, status: 'expired' }
  }
  return { ptp: undefined, status: 'none' }
}

export function getLatestPtp(): PreTaskPlan | undefined {
  return getAllSafetyRecords().find(
    (r): r is PreTaskPlan => r.type === 'ptp'
  )
}

export function getJhaForDate(date: string): JobHazardAnalysis | undefined {
  return getAllSafetyRecords().find(
    (r): r is JobHazardAnalysis => {
      if (r.type !== 'jha') return false
      const jha = r as JobHazardAnalysis
      if (jha.validUntil) return jha.dateOfAnalysis <= date && date <= jha.validUntil
      return jha.dateOfAnalysis === date
    }
  )
}

export function ptpDayLabel(ptp: PreTaskPlan, date: string): string | null {
  if (!ptp.validUntil || ptp.validUntil === ptp.date) return null
  const start = new Date(ptp.date + 'T00:00:00')
  const current = new Date(date + 'T00:00:00')
  const end = new Date(ptp.validUntil + 'T00:00:00')
  const dayN = Math.floor((current.getTime() - start.getTime()) / 86_400_000) + 1
  const totalDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
  return `Day ${dayN} of ${totalDays}`
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
  const rejectedReviews = records.filter(
    (r) => r.reviewStatus === 'rejected'
  ).length
  return activePermits + recentIncidents + rejectedReviews
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

export type JhaInput = Omit<
  JobHazardAnalysis,
  'id' | 'type' | 'createdBy' | 'createdByEmail' | 'createdAt' | 'syncStatus' | 'notionPageId' | 'events'
>

export function createJobHazardAnalysis(input: JhaInput): JobHazardAnalysis {
  const id = nextId('jha')
  const stamp = identityStamp()
  const at = nowIso()
  const record: JobHazardAnalysis = {
    id,
    type: 'jha',
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

export function closePermit(id: string, by: { name: string; email: string | null }, note?: string): SafetyRecord | undefined {
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
    events: [...rec.events, { action: 'closed', by: by.name, byEmail: by.email, at, note: note || undefined }],
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
  const event: import('@/lib/safety-types').AuditEvent = {
    action: 'sync-failed',
    by: 'system',
    byEmail: null,
    at: new Date().toISOString(),
  }
  all[idx] = {
    ...all[idx],
    syncStatus: 'failed',
    events: [...all[idx].events, event],
  }
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
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

// ── EHS review mutations (append-only, guarded) ────────────

export function markSubmittedForReview(
  id: string,
  by: { name: string; email: string | null }
): SafetyRecord | undefined {
  const all = readAll()
  const idx = all.findIndex((r) => r.id === id)
  if (idx === -1) return undefined
  const rec = all[idx]
  if (rec.reviewStatus === 'approved') return rec
  if (rec.reviewStatus === 'submitted') return rec
  const at = nowIso()
  all[idx] = {
    ...rec,
    reviewStatus: 'submitted',
    events: [...rec.events, { action: 'submitted-for-review', by: by.name, byEmail: by.email, at }],
  }
  writeAll(all)
  notify()
  return all[idx]
}

export function markReviewApproved(
  id: string,
  decision: { reviewerName: string; reviewerEmail: string | null; reviewNote: string | null }
): SafetyRecord | undefined {
  const all = readAll()
  const idx = all.findIndex((r) => r.id === id)
  if (idx === -1) return undefined
  const rec = all[idx]
  if (rec.reviewStatus === 'approved') return rec
  if (rec.reviewStatus !== 'submitted') return rec
  const at = nowIso()
  all[idx] = {
    ...rec,
    reviewStatus: 'approved',
    reviewerName: decision.reviewerName,
    reviewerEmail: decision.reviewerEmail,
    reviewNote: decision.reviewNote ?? undefined,
    reviewDecidedAt: at,
    events: [...rec.events, {
      action: 'review-decided',
      by: decision.reviewerName,
      byEmail: decision.reviewerEmail,
      at,
      note: `Approved${decision.reviewNote ? ': ' + decision.reviewNote : ''}`,
    }],
  }
  writeAll(all)
  notify()
  return all[idx]
}

export function markReviewRejected(
  id: string,
  decision: { reviewerName: string; reviewerEmail: string | null; reviewNote: string | null }
): SafetyRecord | undefined {
  const all = readAll()
  const idx = all.findIndex((r) => r.id === id)
  if (idx === -1) return undefined
  const rec = all[idx]
  if (rec.reviewStatus !== 'submitted') return rec
  const at = nowIso()
  all[idx] = {
    ...rec,
    reviewStatus: 'rejected',
    reviewerName: decision.reviewerName,
    reviewerEmail: decision.reviewerEmail,
    reviewNote: decision.reviewNote ?? undefined,
    reviewDecidedAt: at,
    events: [...rec.events, {
      action: 'review-decided',
      by: decision.reviewerName,
      byEmail: decision.reviewerEmail,
      at,
      note: `Rejected${decision.reviewNote ? ': ' + decision.reviewNote : ''}`,
    }],
  }
  writeAll(all)
  notify()
  return all[idx]
}

export function markReviewRecalled(
  id: string,
  by: { name: string; email: string | null }
): SafetyRecord | undefined {
  const all = readAll()
  const idx = all.findIndex((r) => r.id === id)
  if (idx === -1) return undefined
  const rec = all[idx]
  if (rec.reviewStatus !== 'submitted') return rec
  const at = nowIso()
  all[idx] = {
    ...rec,
    reviewStatus: 'recalled',
    events: [...rec.events, {
      action: 'review-recalled',
      by: by.name,
      byEmail: by.email,
      at,
      ...(rec.reviewerName ? { previousReviewer: rec.reviewerName } : {}),
    }],
  }
  writeAll(all)
  notify()
  return all[idx]
}

// ── EHS review read helpers ─────────────────────────────────

export function getReviewPendingRecords(): SafetyRecord[] {
  return readAll().filter((r) => r.reviewStatus === 'submitted' && r.notionPageId)
}

export function getReviewActionableRecords(): { approved: SafetyRecord[]; rejected: SafetyRecord[] } {
  const all = readAll()
  return {
    approved: all.filter((r) => r.reviewStatus === 'approved'),
    rejected: all.filter((r) => r.reviewStatus === 'rejected'),
  }
}

// ── CSV export ────────────────────────────────────────────────

export function exportSafetyToCsv(records: SafetyRecord[]): string {
  const headers = [
    'ID', 'Type', 'Project', 'Location', 'Created_By', 'Created_At',
    'Status_Or_Result', 'Signatures', 'Sync_Status',
    'Review_Status', 'Reviewed_By', 'Review_Decided_At',
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
      csvCell(r.id), csvCell(r.type), csvCell(r.projectName), csvCell(r.location),
      csvCell(r.createdBy), csvCell(r.createdAt), csvCell(statusOrResult), csvCell(sigCount), csvCell(r.syncStatus),
      csvCell(r.reviewStatus ?? ''), csvCell(r.reviewerName ?? ''), csvCell(r.reviewDecidedAt ?? ''),
    ].join(',')
  })
  return [headers.join(','), ...rows].join('\n')
}

// ── Retention cleanup ────────────────────────────────────────

const RETENTION_DAYS = 90

export function archiveOldSyncedRecords(): number {
  const all = readAll()
  const cutoff = Date.now() - RETENTION_DAYS * 86_400_000
  const toKeep: SafetyRecord[] = []
  let removed = 0
  for (const r of all) {
    const lastEvent = r.events[r.events.length - 1]
    const ts = lastEvent?.at ?? r.createdAt
    if (r.syncStatus === 'synced' && new Date(ts).getTime() < cutoff) {
      removed++
    } else {
      toKeep.push(r)
    }
  }
  if (removed > 0) {
    writeAll(toKeep)
    notify()
  }
  return removed
}

const DRAFT_MAX_AGE_MS = 7 * 86_400_000

export function pruneOldDrafts(): number {
  const now = Date.now()
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k?.startsWith('draft:')) continue
    try {
      const raw = localStorage.getItem(k)
      if (!raw) continue
      const parsed = JSON.parse(raw) as { _savedAt?: number }
      if (parsed._savedAt && now - parsed._savedAt > DRAFT_MAX_AGE_MS) {
        toRemove.push(k)
      }
    } catch {
      toRemove.push(k)
    }
  }
  toRemove.forEach((k) => localStorage.removeItem(k))
  return toRemove.length
}

// ── Data deletion (GDPR right-to-erasure) ────────────────────

export async function clearAllLocalData(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(STORAGE_KEY_BACKUP)

  const draftKeys = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith('draft:')) draftKeys.push(k)
  }
  draftKeys.forEach((k) => localStorage.removeItem(k))

  localStorage.removeItem('eqr-current-user')

  try {
    const db = await openBlobDB()
    const tx = db.transaction(PHOTO_STORE, 'readwrite')
    tx.objectStore(PHOTO_STORE).clear()
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // IndexedDB may not be available
  }

  notify()
}
