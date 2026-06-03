/**
 * Safety Hub — type definitions.
 *
 * Covers Pre-Task Plans, Work-at-Height / Hot Work / Confined Space permits,
 * and Incident reports. Reuses Shift / InspectionSyncStatus from lib/types so
 * the Safety Hub stays consistent with the existing inspection module.
 *
 * AUDIT INTEGRITY: records are immutable after creation. The only post-creation
 * mutations are appending AuditEvents, permit status transitions, and sync-state
 * updates — see lib/safety-records.ts.
 */

import type { Shift, InspectionSyncStatus } from '@/lib/types'

export type SafetyRecordType =
  | 'ptp'
  | 'height-permit'
  | 'hot-work-permit'
  | 'confined-space-permit'
  | 'incident-report'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

/** Permit lifecycle. 'expired' is DERIVED (now > validUntil), never stored. */
export type PermitStatus = 'active' | 'closed' | 'revoked'

/**
 * A single drawn signature with attribution + timestamp. The signature image
 * itself is a base64 PNG stored in IndexedDB; only this reference lives in the
 * record. `id` doubles as the IndexedDB blob slot suffix.
 */
export interface CrewSignature {
  id: string
  name: string
  email: string | null
  role: string | null
  hasSignature: boolean
  signedAt: string
}

/** Append-only audit event. */
export interface AuditEvent {
  action: 'created' | 'submitted' | 'closed' | 'revoked' | 'synced' | 'sync-failed' | 'amended'
  by: string
  byEmail: string | null
  at: string
  note?: string
}

export interface SafetyRecordBase {
  id: string
  type: SafetyRecordType
  createdBy: string
  createdByEmail: string | null
  createdAt: string
  location: string
  projectName: string
  syncStatus: InspectionSyncStatus
  notionPageId: string | null
  events: AuditEvent[]
}

export interface PermitCheckItem {
  id: string
  label: string
  category: string
  checked: boolean
  notes: string
  critical?: boolean
}

// ── Pre-Task Plan / Pre-Build Plan ───────────────────────────

export interface HazardEntry {
  id: string
  description: string
  riskLevel: RiskLevel
  controlMeasure: string
  addedBy: string | null
  /** Provenance; defaults 'manual'. 'sage' = AI-drafted (see spec §13). */
  source?: 'sage' | 'manual'
}

export interface HeatIllnessPlan {
  water: boolean
  shade: boolean
  restBreaks: boolean
  highHeatProcedures: boolean
}

export interface PreTaskPlan extends SafetyRecordBase {
  type: 'ptp'
  date: string
  shift: Shift
  scopeOfWork: string
  hazards: HazardEntry[]
  ppeRequired: string[]
  emergencyMusterPoint: string
  nearestHospital: string
  firstAidEyewashLocation: string
  weatherNotes: string
  windSpeed: string
  heatIllnessPlan: HeatIllnessPlan
  toolboxTalkTopic: string
  toolboxTalkNotes: string
  crewSignatures: CrewSignature[]
  supervisorSignatureId: string | null
}

// ── Work-at-Height Permit ────────────────────────────────────

export interface HeightPermit extends SafetyRecordBase {
  type: 'height-permit'
  status: PermitStatus
  workDescription: string
  workingHeight: string
  accessMethod: string[]
  fallProtection: string[]
  anchorPoints: string
  rescuePlan: string
  checklist: PermitCheckItem[]
  validFrom: string
  validUntil: string
  workers: CrewSignature[]
  issuerSignatureId: string | null
  closedAt: string | null
  closedBy: string | null
}

// ── Hot Work Permit ──────────────────────────────────────────

export interface HotWorkPermit extends SafetyRecordBase {
  type: 'hot-work-permit'
  status: PermitStatus
  workDescription: string
  hotWorkTypes: string[]
  checklist: PermitCheckItem[]
  fireWatchRequired: boolean
  fireWatchName: string
  fireWatchPostDurationMin: number
  extinguisherLocation: string
  extinguisherType: string
  sprinklerStatus: string
  gasTestRequired: boolean
  gasTestNotes: string
  validFrom: string
  validUntil: string
  workers: CrewSignature[]
  issuerSignatureId: string | null
  closedAt: string | null
  closedBy: string | null
}

// ── Confined Space Entry Permit ──────────────────────────────

export interface AtmosphericReading {
  oxygenPct: string
  lelPct: string
  coPpm: string
  h2sPpm: string
  testedBy: string
  testedAt: string
}

export interface ConfinedSpacePermit extends SafetyRecordBase {
  type: 'confined-space-permit'
  status: PermitStatus
  spaceDescription: string
  hazards: string[]
  atmospheric: AtmosphericReading
  continuousMonitoring: boolean
  ventilationInUse: boolean
  rescuePlan: string
  checklist: PermitCheckItem[]
  entrySupervisorSignatureId: string | null
  attendantName: string
  entrants: CrewSignature[]
  validFrom: string
  validUntil: string
  closedAt: string | null
  closedBy: string | null
}

// ── Incident / Near-Miss Report ──────────────────────────────

export type IncidentType = 'injury' | 'near-miss' | 'property-damage' | 'environmental'
export type IncidentSeverity = 'minor' | 'moderate' | 'serious' | 'critical'

export interface IncidentReport extends SafetyRecordBase {
  type: 'incident-report'
  incidentType: IncidentType
  severity: IncidentSeverity
  occurredAt: string
  description: string
  immediateActions: string
  witnesses: string[]
  rootCause: string
  correctiveActions: string
  reportedToCalOsha: boolean
  photoSlots: string[]
  reporterSignatureId: string | null
}

export type SafetyRecord =
  | PreTaskPlan
  | HeightPermit
  | HotWorkPermit
  | ConfinedSpacePermit
  | IncidentReport

export type AnyPermit = HeightPermit | HotWorkPermit | ConfinedSpacePermit

// ── Type guards ──────────────────────────────────────────────

export function isPTP(r: SafetyRecord): r is PreTaskPlan {
  return r.type === 'ptp'
}

export function isPermit(r: SafetyRecord): r is AnyPermit {
  return (
    r.type === 'height-permit' ||
    r.type === 'hot-work-permit' ||
    r.type === 'confined-space-permit'
  )
}

export function isIncident(r: SafetyRecord): r is IncidentReport {
  return r.type === 'incident-report'
}

// ── Display metadata ─────────────────────────────────────────

export const SAFETY_TYPE_LABELS: Record<SafetyRecordType, string> = {
  'ptp': 'Pre-Task Plan',
  'height-permit': 'Work-at-Height Permit',
  'hot-work-permit': 'Hot Work Permit',
  'confined-space-permit': 'Confined Space Permit',
  'incident-report': 'Incident / Near-Miss',
}

export const RISK_COLORS: Record<RiskLevel, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#EAB308',
  low: '#6B7280',
}

export const RISK_LABELS: Record<RiskLevel, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const PERMIT_STATUS_COLORS: Record<PermitStatus | 'expired', string> = {
  active: '#22C55E',
  closed: '#6B7280',
  revoked: '#EF4444',
  expired: '#F97316',
}

export const INCIDENT_SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  minor: '#6B7280',
  moderate: '#EAB308',
  serious: '#F97316',
  critical: '#EF4444',
}
