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
  | 'jha'
  | 'height-permit'
  | 'hot-work-permit'
  | 'confined-space-permit'
  | 'incident-report'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type ReviewStatus = 'submitted' | 'approved' | 'rejected' | 'recalled'

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
  action:
    | 'created' | 'submitted' | 'closed' | 'revoked' | 'synced' | 'sync-failed' | 'amended'
    | 'submitted-for-review' | 'review-decided' | 'review-recalled'
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
  reviewStatus?: ReviewStatus
  reviewerName?: string
  reviewerEmail?: string | null
  reviewNote?: string
  reviewDecidedAt?: string
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

// ── Job Hazard Analysis (JHA) ────────────────────────────────
// Distinct from the PTP: a JHA breaks a job into sequential task STEPS and
// analyses the hazards/controls of each step. Built per the Mytra JHA program
// (EHSPD017) and submitted to EHS for review before work begins.

export interface JhaStep {
  id: string
  /** What is done in this step of the job. */
  taskActivity: string
  /** Hazard(s) identified for this step (free text; one per line). */
  hazards: string
  /** Risk rated BEFORE controls (severity × likelihood). */
  riskLevel: RiskLevel
  /** Controls / mitigations; note residual risk here. */
  controls: string
  /** Risk rated AFTER controls are applied. */
  residualRiskLevel?: RiskLevel
  /** Person responsible for the control (DRI). */
  responsible: string
  /** Provenance of the hazard/control content for this step. */
  source?: 'sage' | 'manual'
  /** UI-only: user expanded the hazard/controls block manually. */
  showDetail?: boolean
}

export interface JobHazardAnalysis extends SafetyRecordBase {
  type: 'jha'
  jobTitle: string
  dateOfAnalysis: string
  department: string
  referenceDoc: string
  ppeRequired: string[]
  steps: JhaStep[]
  additionalNotes: string
  signatures: CrewSignature[]
  preparedBySignatureId: string | null
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

export interface InjuredPerson {
  name: string
  jobTitle: string
  employer: string
  bodyPartAffected: string
}

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
  injuredPerson?: InjuredPerson
  photoSlots: string[]
  reporterSignatureId: string | null
}

export type SafetyRecord =
  | PreTaskPlan
  | JobHazardAnalysis
  | HeightPermit
  | HotWorkPermit
  | ConfinedSpacePermit
  | IncidentReport

export type AnyPermit = HeightPermit | HotWorkPermit | ConfinedSpacePermit

// ── Type guards ──────────────────────────────────────────────

export function isPTP(r: SafetyRecord): r is PreTaskPlan {
  return r.type === 'ptp'
}

export function isJHA(r: SafetyRecord): r is JobHazardAnalysis {
  return r.type === 'jha'
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
  'jha': 'Job Hazard Analysis',
  'height-permit': 'Work-at-Height Permit',
  'hot-work-permit': 'Hot Work Permit',
  'confined-space-permit': 'Confined Space Permit',
  'incident-report': 'Incident / Near-Miss',
}

export const RISK_COLORS: Record<RiskLevel, string> = {
  critical: 'var(--risk-critical)',
  high: 'var(--risk-high)',
  medium: 'var(--risk-medium)',
  low: 'var(--risk-low)',
}

export const RISK_LABELS: Record<RiskLevel, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const PERMIT_STATUS_COLORS: Record<PermitStatus | 'expired', string> = {
  active: 'var(--ok)',
  closed: 'var(--fg-4)',
  revoked: 'var(--danger)',
  expired: 'var(--expired)',
}

export const INCIDENT_SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  minor: 'var(--risk-low)',
  moderate: 'var(--risk-medium)',
  serious: 'var(--risk-high)',
  critical: 'var(--risk-critical)',
}

export const REVIEW_STATUS_COLORS: Record<ReviewStatus, string> = {
  submitted: 'var(--warn)',
  approved: 'var(--ok)',
  rejected: 'var(--danger)',
  recalled: 'var(--fg-4)',
}

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  submitted: 'Pending Review',
  approved: 'Approved',
  rejected: 'Needs Revision',
  recalled: 'Recalled',
}
