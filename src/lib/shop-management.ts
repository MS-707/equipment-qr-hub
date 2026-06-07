/**
 * Shop Management — authorization, PM tracking, and training records.
 *
 * Corrective actions from bench grinder incident (2026-06-07):
 *   1. Authorized User List — gate equipment behind an authorization roster
 *   2. PM DRI Assignment — attach a responsible individual + track completion
 *   3. Training Records — tie calOshaTrainingReq to employee completion
 *
 * All data is localStorage-backed (same pattern as safety-records.ts).
 * The public API is the swap-point; replace the storage internals later.
 */

// ── Types ────────────────────────────────────────────────────

export interface AuthorizedUser {
  email: string
  name: string
  authorizedBy: string
  authorizedAt: string
}

export interface EquipmentAuthorization {
  itemNumber: number
  restricted: boolean
  authorizedUsers: AuthorizedUser[]
}

export interface PmCompletion {
  id: string
  itemNumber: number
  frequency: string
  completedBy: string
  completedByEmail: string | null
  completedAt: string
  notes: string
}

export interface PmAssignment {
  itemNumber: number
  driName: string
  driEmail: string | null
  assignedAt: string
}

export interface TrainingRecord {
  id: string
  employeeEmail: string
  employeeName: string
  topic: string
  completedAt: string
  expiresAt: string | null
  verifiedBy: string | null
}

// ── Storage keys ─────────────────────────────────────────────

const AUTH_KEY = 'eqr-equipment-auth'
const PM_COMPLETIONS_KEY = 'eqr-pm-completions'
const PM_ASSIGNMENTS_KEY = 'eqr-pm-assignments'
const TRAINING_KEY = 'eqr-training-records'

// ── Helpers ──────────────────────────────────────────────────

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, data: unknown): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) {
    console.error(`Failed to write ${key}:`, e)
  }
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function nowIso(): string {
  return new Date().toISOString()
}

// ── Change notification ──────────────────────────────────────

const listeners = new Set<() => void>()

export function onShopMgmtChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function notify() {
  listeners.forEach((fn) => fn())
}

// ── Authorization ────────────────────────────────────────────

export function getAuthorization(itemNumber: number): EquipmentAuthorization {
  const all = readJson<Record<number, EquipmentAuthorization>>(AUTH_KEY, {})
  return all[itemNumber] ?? { itemNumber, restricted: false, authorizedUsers: [] }
}

export function getAllRestricted(): EquipmentAuthorization[] {
  const all = readJson<Record<number, EquipmentAuthorization>>(AUTH_KEY, {})
  return Object.values(all).filter((a) => a.restricted)
}

export function setRestricted(itemNumber: number, restricted: boolean): void {
  const all = readJson<Record<number, EquipmentAuthorization>>(AUTH_KEY, {})
  const existing = all[itemNumber] ?? { itemNumber, restricted: false, authorizedUsers: [] }
  all[itemNumber] = { ...existing, restricted }
  writeJson(AUTH_KEY, all)
  notify()
}

export function addAuthorizedUser(
  itemNumber: number,
  user: { email: string; name: string },
  authorizedBy: string
): void {
  const all = readJson<Record<number, EquipmentAuthorization>>(AUTH_KEY, {})
  const existing = all[itemNumber] ?? { itemNumber, restricted: true, authorizedUsers: [] }
  if (existing.authorizedUsers.some((u) => u.email === user.email)) return
  existing.authorizedUsers.push({
    email: user.email,
    name: user.name,
    authorizedBy,
    authorizedAt: nowIso(),
  })
  all[itemNumber] = existing
  writeJson(AUTH_KEY, all)
  notify()
}

export function removeAuthorizedUser(itemNumber: number, email: string): void {
  const all = readJson<Record<number, EquipmentAuthorization>>(AUTH_KEY, {})
  const existing = all[itemNumber]
  if (!existing) return
  existing.authorizedUsers = existing.authorizedUsers.filter((u) => u.email !== email)
  all[itemNumber] = existing
  writeJson(AUTH_KEY, all)
  notify()
}

export function isUserAuthorized(itemNumber: number, email: string | null): boolean {
  const auth = getAuthorization(itemNumber)
  if (!auth.restricted) return true
  if (!email) return false
  return auth.authorizedUsers.some((u) => u.email === email)
}

// ── PM Assignments (DRI) ─────────────────────────────────────

export function getPmAssignment(itemNumber: number): PmAssignment | null {
  const all = readJson<Record<number, PmAssignment>>(PM_ASSIGNMENTS_KEY, {})
  return all[itemNumber] ?? null
}

export function getAllPmAssignments(): Record<number, PmAssignment> {
  return readJson<Record<number, PmAssignment>>(PM_ASSIGNMENTS_KEY, {})
}

export function setPmAssignment(
  itemNumber: number,
  dri: { name: string; email: string | null }
): void {
  const all = readJson<Record<number, PmAssignment>>(PM_ASSIGNMENTS_KEY, {})
  all[itemNumber] = {
    itemNumber,
    driName: dri.name,
    driEmail: dri.email,
    assignedAt: nowIso(),
  }
  writeJson(PM_ASSIGNMENTS_KEY, all)
  notify()
}

export function removePmAssignment(itemNumber: number): void {
  const all = readJson<Record<number, PmAssignment>>(PM_ASSIGNMENTS_KEY, {})
  delete all[itemNumber]
  writeJson(PM_ASSIGNMENTS_KEY, all)
  notify()
}

// ── PM Completions ───────────────────────────────────────────

export function getPmCompletions(itemNumber: number): PmCompletion[] {
  const all = readJson<PmCompletion[]>(PM_COMPLETIONS_KEY, [])
  return all
    .filter((c) => c.itemNumber === itemNumber)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
}

export function getLatestPmCompletion(
  itemNumber: number,
  frequency: string
): PmCompletion | null {
  const completions = getPmCompletions(itemNumber)
  return completions.find((c) => c.frequency === frequency) ?? null
}

export function recordPmCompletion(input: {
  itemNumber: number
  frequency: string
  completedBy: string
  completedByEmail: string | null
  notes: string
}): PmCompletion {
  const all = readJson<PmCompletion[]>(PM_COMPLETIONS_KEY, [])
  const record: PmCompletion = {
    id: randomId(),
    ...input,
    completedAt: nowIso(),
  }
  all.push(record)
  writeJson(PM_COMPLETIONS_KEY, all)
  notify()
  return record
}

export function isPmOverdue(itemNumber: number, frequency: string): boolean {
  const latest = getLatestPmCompletion(itemNumber, frequency)
  if (!latest) return true
  const elapsed = Date.now() - new Date(latest.completedAt).getTime()
  const DAY = 86400000
  const thresholds: Record<string, number> = {
    Daily: 1.5 * DAY,
    Weekly: 8 * DAY,
    Monthly: 35 * DAY,
    Quarterly: 100 * DAY,
    'Semi-Annual': 200 * DAY,
    Annual: 380 * DAY,
  }
  return elapsed > (thresholds[frequency] ?? 35 * DAY)
}

// ── Training Records ─────────────────────────────────────────

export function getAllTrainingRecords(): TrainingRecord[] {
  return readJson<TrainingRecord[]>(TRAINING_KEY, [])
}

export function getTrainingForEmployee(email: string): TrainingRecord[] {
  return getAllTrainingRecords()
    .filter((t) => t.employeeEmail === email)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
}

export function getTrainingForTopic(topic: string): TrainingRecord[] {
  return getAllTrainingRecords()
    .filter((t) => t.topic === topic)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
}

export function addTrainingRecord(input: {
  employeeEmail: string
  employeeName: string
  topic: string
  expiresAt?: string | null
  verifiedBy?: string | null
}): TrainingRecord {
  const all = getAllTrainingRecords()
  const record: TrainingRecord = {
    id: randomId(),
    employeeEmail: input.employeeEmail,
    employeeName: input.employeeName,
    topic: input.topic,
    completedAt: nowIso(),
    expiresAt: input.expiresAt ?? null,
    verifiedBy: input.verifiedBy ?? null,
  }
  all.push(record)
  writeJson(TRAINING_KEY, all)
  notify()
  return record
}

export function isTrainingCurrent(email: string, topic: string): boolean {
  const records = getTrainingForEmployee(email)
  const match = records.find((t) => t.topic === topic)
  if (!match) return false
  if (!match.expiresAt) return true
  return new Date(match.expiresAt).getTime() > Date.now()
}
