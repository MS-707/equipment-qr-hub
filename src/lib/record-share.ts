/**
 * Record sharing — turns a safety record into a plain-text summary and shares
 * it via the native share sheet (iOS/Android) with a mailto: fallback for
 * desktop. Teams often need to email a completed PTP or permit to a manager
 * or client rep; on iPhone the Web Share API surfaces Mail, Messages, and
 * AirDrop in one tap.
 *
 * i18n: the share text renders in the RECORD's signed locale (record.locale
 * ?? 'en'), not the viewer's — the legal artifact re-renders in the language
 * the crew signed (docs/i18n/DESIGN.md).
 */

import type {
  SafetyRecord,
  PreTaskPlan,
  JobHazardAnalysis,
  AnyPermit,
  HeightPermit,
  HotWorkPermit,
  ConfinedSpacePermit,
  IncidentReport,
  CrewSignature,
  RiskLevel,
  ReviewStatus,
  IncidentSeverity,
  IncidentType,
} from '@/lib/safety-types'
import {
  SAFETY_TYPE_LABELS,
  isPTP,
  isJHA,
  isPermit,
  isIncident,
} from '@/lib/safety-types'
import type { Shift, InspectionSyncStatus } from '@/lib/types'
import { ppeLabel } from '@/data/safety-checklists'
import { getT, type Locale, type TFunction } from '@/lib/i18n-core'
import { formatDate, formatDateTime, formatTime } from '@/lib/datetime'
import { permitItemLabel, ppeOptionLabel } from '@/lib/i18n-data'
import type { MessageKey } from '@/lib/i18n-keys'

// ── Enum → catalog-key label helpers (shared with RecordView) ─

const RISK_LABEL_KEY: Record<RiskLevel, MessageKey> = {
  low: 'hazard.risk.low',
  medium: 'hazard.risk.medium',
  high: 'hazard.risk.high',
  critical: 'hazard.risk.critical',
}

const SHIFT_LABEL_KEY: Record<Shift, MessageKey> = {
  Day: 'ptp.shiftDay',
  Swing: 'ptp.shiftSwing',
  Night: 'ptp.shiftNight',
}

const SEVERITY_LABEL_KEY: Record<IncidentSeverity, MessageKey> = {
  minor: 'incident.severityMinor',
  moderate: 'incident.severityModerate',
  serious: 'incident.severitySerious',
  critical: 'incident.severityCritical',
}

const INCIDENT_TYPE_LABEL_KEY: Record<IncidentType, MessageKey> = {
  'injury': 'incident.typeInjury',
  'near-miss': 'incident.typeNearMiss',
  'property-damage': 'incident.typeProperty',
  'environmental': 'incident.typeEnvironmental',
}

const REVIEW_STATUS_LABEL_KEY: Partial<Record<ReviewStatus, MessageKey>> = {
  submitted: 'sync.pending',
  approved: 'review.approved',
  rejected: 'review.needsRevision',
}

const SYNC_STATUS_LABEL_KEY: Record<InspectionSyncStatus, MessageKey> = {
  pending: 'sync.pending',
  synced: 'sync.synced',
  failed: 'sync.failed',
  offline: 'common.offline',
}

export function riskLabel(t: TFunction, level: RiskLevel): string {
  const key = RISK_LABEL_KEY[level]
  return key ? t(key) : level
}

export function shiftLabel(t: TFunction, shift: Shift): string {
  const key = SHIFT_LABEL_KEY[shift]
  return key ? t(key) : shift
}

export function incidentSeverityLabel(t: TFunction, severity: IncidentSeverity): string {
  const key = SEVERITY_LABEL_KEY[severity]
  return key ? t(key) : severity
}

export function incidentTypeLabel(t: TFunction, type: IncidentType): string {
  const key = INCIDENT_TYPE_LABEL_KEY[type]
  return key ? t(key) : type
}

export function reviewStatusLabel(t: TFunction, status: ReviewStatus): string {
  const key = REVIEW_STATUS_LABEL_KEY[status]
  return key ? t(key) : status
}

export function syncStatusLabel(t: TFunction, status: InspectionSyncStatus): string {
  const key = SYNC_STATUS_LABEL_KEY[status]
  return key ? t(key) : status
}

// ── Share-text builders ──────────────────────────────────────

function sigLines(t: TFunction, locale: Locale, sigs: CrewSignature[]): string[] {
  if (sigs.length === 0) return ['  ' + t('record.shareNone', undefined, '(none)')]
  return sigs.map((s) => {
    const signedStatus = s.hasSignature
      ? t('record.shareSigned', undefined, '✓ signed')
      : t('record.shareNotSigned', undefined, 'not signed')
    const line = t('record.shareSigLine', {
      name: s.name,
      role: s.role || '',
      signedStatus,
      time: formatTime(s.signedAt, locale),
    })
    // No role: collapse the dangling " — " left by the empty {role} slot.
    return '  ' + (s.role ? line : line.replace(' —  (', ' ('))
  })
}

function ptpBody(t: TFunction, locale: Locale, p: PreTaskPlan): string[] {
  const lines: string[] = []
  lines.push(t('record.shareDateShift', { date: p.date, shift: shiftLabel(t, p.shift) }))
  lines.push('')
  lines.push(t('record.shareScopeOfWork', undefined, 'SCOPE OF WORK'))
  lines.push(p.scopeOfWork || '  ' + t('record.shareNone', undefined, '(none)'))
  lines.push('')
  lines.push(t('record.shareHazardsControls', undefined, 'HAZARDS & CONTROLS'))
  if (p.hazards.length === 0) {
    lines.push('  ' + t('record.shareNoneRecorded', undefined, '(none recorded)'))
  } else {
    p.hazards.forEach((h, i) => {
      lines.push('  ' + t('record.shareHazardLine', { n: i + 1, description: h.description, risk: riskLabel(t, h.riskLevel) }))
      lines.push('     ' + t('record.shareControlLine', { control: h.controlMeasure || '—' }))
    })
  }
  if (p.ppeRequired.length > 0) {
    lines.push('')
    lines.push(t('record.sharePpeRequired', undefined, 'PPE REQUIRED'))
    lines.push('  ' + p.ppeRequired.map((id) => ppeOptionLabel(locale, id, ppeLabel(id))).join(', '))
  }
  const site = [
    p.emergencyMusterPoint && t('record.shareMusterPoint', { value: p.emergencyMusterPoint }),
    p.nearestHospital && t('record.shareNearestHospital', { value: p.nearestHospital }),
    p.firstAidEyewashLocation && t('record.shareFirstAidEyewash', { value: p.firstAidEyewashLocation }),
    p.weatherNotes && t('record.shareWeather', { value: p.weatherNotes }),
    p.windSpeed && t('record.shareWind', { value: p.windSpeed }),
  ].filter(Boolean) as string[]
  if (site.length > 0) {
    lines.push('')
    lines.push(t('record.shareSiteConditions', undefined, 'SITE CONDITIONS & EMERGENCY'))
    site.forEach((s) => lines.push('  ' + s))
  }
  if (p.toolboxTalkTopic || p.toolboxTalkNotes) {
    lines.push('')
    lines.push(t('record.shareToolboxTalk', undefined, 'TOOLBOX TALK'))
    if (p.toolboxTalkTopic) lines.push('  ' + p.toolboxTalkTopic)
    if (p.toolboxTalkNotes) lines.push('  ' + p.toolboxTalkNotes)
  }
  lines.push('')
  lines.push(t('record.shareCrewSignOn', { count: p.crewSignatures.length }))
  lines.push(...sigLines(t, locale, p.crewSignatures))
  return lines
}

function jhaBody(t: TFunction, locale: Locale, j: JobHazardAnalysis): string[] {
  const lines: string[] = []
  lines.push(t('record.shareJobTask', { jobTitle: j.jobTitle || '—' }))
  lines.push(t('record.shareDateOfAnalysis', { date: j.dateOfAnalysis }))
  if (j.department) lines.push(t('record.shareDepartment', { department: j.department }))
  if (j.referenceDoc) lines.push(t('record.shareReferenceDoc', { referenceDoc: j.referenceDoc }))
  if (j.ppeRequired.length > 0) {
    lines.push('')
    lines.push(t('record.sharePpeRequired', undefined, 'PPE REQUIRED'))
    lines.push('  ' + j.ppeRequired.map((id) => ppeOptionLabel(locale, id, ppeLabel(id))).join(', '))
  }
  lines.push('')
  lines.push(t('record.shareHazardAnalysis', { count: j.steps.length }))
  j.steps.forEach((s, i) => {
    lines.push('')
    lines.push('  ' + t('record.shareStepLine', { n: i + 1, risk: riskLabel(t, s.riskLevel), taskActivity: s.taskActivity }))
    if (s.hazards) lines.push('    ' + t('record.shareHazards', { value: s.hazards.replace(/\n/g, '; ') }))
    if (s.controls) lines.push('    ' + t('record.shareControls', { value: s.controls.replace(/\n/g, '; ') }))
    if (s.responsible) lines.push('    ' + t('record.responsible', { responsible: s.responsible }))
  })
  if (j.additionalNotes) {
    lines.push('')
    lines.push(t('record.shareAdditionalNotes', undefined, 'ADDITIONAL NOTES'))
    lines.push(j.additionalNotes)
  }
  return lines
}

function permitBody(t: TFunction, locale: Locale, p: AnyPermit): string[] {
  const lines: string[] = []
  lines.push(t('record.shareValid', { from: formatDateTime(p.validFrom, locale), until: formatDateTime(p.validUntil, locale) }))
  if ('workDescription' in p && p.workDescription) lines.push(t('record.shareWork', { workDescription: (p as HeightPermit | HotWorkPermit).workDescription }))
  lines.push('')

  if (p.type === 'height-permit') {
    const h = p as HeightPermit
    if (h.workingHeight) lines.push(t('record.shareWorkingHeight', { value: h.workingHeight }))
    if (h.accessMethod.length) lines.push(t('record.shareAccess', { value: h.accessMethod.join(', ') }))
    if (h.fallProtection.length) lines.push(t('record.shareFallProtection', { value: h.fallProtection.join(', ') }))
    if (h.anchorPoints) lines.push(t('record.shareAnchorPoints', { value: h.anchorPoints }))
    if (h.rescuePlan) lines.push(t('record.shareRescuePlan', { value: h.rescuePlan }))
  } else if (p.type === 'hot-work-permit') {
    const h = p as HotWorkPermit
    if (h.hotWorkTypes.length) lines.push(t('record.shareType', { value: h.hotWorkTypes.join(', ') }))
    lines.push(t('record.shareFireWatch', {
      value: h.fireWatchRequired
        ? t('record.yesAssigned', { name: h.fireWatchName || t('record.unassigned', undefined, 'unassigned') })
        : t('common.no', undefined, 'No'),
    }))
    if (h.fireWatchRequired) lines.push(t('record.sharePostWorkMonitoring', { min: h.fireWatchPostDurationMin }))
    if (h.extinguisherLocation) lines.push(t('record.shareExtinguisher', { type: h.extinguisherType, location: h.extinguisherLocation }))
    if (h.sprinklerStatus) lines.push(t('record.shareSprinklerStatus', { value: h.sprinklerStatus }))
    if (h.gasTestRequired) lines.push(t('record.shareAtmosphereTest', { value: h.gasTestNotes || t('record.shareRequired', undefined, 'required') }))
  } else if (p.type === 'confined-space-permit') {
    const c = p as ConfinedSpacePermit
    if (c.spaceDescription) lines.push(t('record.shareSpace', { value: c.spaceDescription }))
    if (c.hazards.length) lines.push(t('record.shareHazards', { value: c.hazards.join(', ') }))
    const a = c.atmospheric
    lines.push(t('record.shareAtmosphereReadings', {
      o2: a.oxygenPct || '—',
      lel: a.lelPct || '—',
      co: a.coPpm || '—',
      h2s: a.h2sPpm || '—',
    }))
    if (a.testedBy) {
      lines.push(a.testedAt
        ? t('record.shareTestedByAt', { name: a.testedBy, time: formatDateTime(a.testedAt, locale) })
        : t('record.shareTestedBy', { name: a.testedBy }))
    }
    lines.push(t('record.shareAttendant', { value: c.attendantName || '—' }))
    lines.push(t('record.shareMonitoringVentilation', {
      monitoring: c.continuousMonitoring ? t('common.yes', undefined, 'Yes') : t('common.no', undefined, 'No'),
      ventilation: c.ventilationInUse ? t('record.inUse', undefined, 'In use') : t('common.no', undefined, 'No'),
    }))
    if (c.rescuePlan) lines.push(t('record.shareRescuePlan', { value: c.rescuePlan }))
  }

  lines.push('')
  lines.push(t('record.shareChecklist', undefined, 'CHECKLIST'))
  p.checklist.forEach((c) => {
    lines.push(`  ${c.checked ? '✓' : '○'} ${permitItemLabel(locale, c.id, c.label)}${c.notes ? ` — ${c.notes}` : ''}`)
  })

  const workers = 'workers' in p ? p.workers : []
  const entrants = 'entrants' in p ? (p as ConfinedSpacePermit).entrants : []
  const sigs = [...workers, ...entrants]
  lines.push('')
  lines.push(t('record.shareSignOn', { count: sigs.length }))
  lines.push(...sigLines(t, locale, sigs))
  return lines
}

function incidentBody(t: TFunction, locale: Locale, inc: IncidentReport): string[] {
  const lines: string[] = []
  lines.push(t('record.shareTypeSeverity', { type: incidentTypeLabel(t, inc.incidentType), severity: incidentSeverityLabel(t, inc.severity) }))
  lines.push(t('record.shareOccurred', { time: formatDateTime(inc.occurredAt, locale) }))
  lines.push('')
  lines.push(t('record.shareDescription', undefined, 'DESCRIPTION'))
  lines.push(inc.description || '  ' + t('record.shareNone', undefined, '(none)'))
  if (inc.immediateActions) {
    lines.push('')
    lines.push(t('record.shareImmediateActions', undefined, 'IMMEDIATE ACTIONS'))
    lines.push(inc.immediateActions)
  }
  if (inc.witnesses.length) {
    lines.push('')
    lines.push(t('record.shareWitnesses', undefined, 'WITNESSES'))
    lines.push('  ' + inc.witnesses.join(', '))
  }
  if (inc.rootCause) {
    lines.push('')
    lines.push(t('record.shareRootCause', undefined, 'ROOT CAUSE'))
    lines.push(inc.rootCause)
  }
  if (inc.correctiveActions) {
    lines.push('')
    lines.push(t('record.shareCorrectiveActions', undefined, 'CORRECTIVE ACTIONS'))
    lines.push(inc.correctiveActions)
  }
  if (inc.reportedToCalOsha) {
    lines.push('')
    lines.push(t('record.shareReportedToAuthorities', undefined, 'Reported to authorities: Yes'))
  }
  return lines
}

/** Build a plain-text summary of a record suitable for email / messaging. */
export function buildRecordText(r: SafetyRecord): string {
  const locale: Locale = r.locale ?? 'en'
  const t = getT(locale)
  const label = SAFETY_TYPE_LABELS[r.type]
  const header = [
    `${label}`,
    t('record.shareRef', { id: r.id }),
    t('record.shareProject', { value: r.projectName || '—' }),
    t('record.shareLocation', { value: r.location || '—' }),
    t('record.sharePreparedBy', { value: r.createdBy }),
    t('record.shareCreated', { value: formatDateTime(r.createdAt, locale) }),
  ]
  if (r.reviewStatus) header.push(t('record.shareEhsReview', { status: reviewStatusLabel(t, r.reviewStatus) }))

  let body: string[] = []
  try {
    if (isPTP(r)) body = ptpBody(t, locale, r)
    else if (isJHA(r)) body = jhaBody(t, locale, r)
    else if (isPermit(r)) body = permitBody(t, locale, r as AnyPermit)
    else if (isIncident(r)) body = incidentBody(t, locale, r)
  } catch {
    body = [t('record.shareDetailsUnavailable', undefined, '(Record details unavailable — partial data)')]
  }

  return [...header, '', '────────────────────', '', ...body, '', '────────────────────', t('record.shareGeneratedBy', undefined, 'Generated by Sage EHS')].join('\n')
}

/** Subject line for the share / email. */
export function buildRecordSubject(r: SafetyRecord): string {
  const label = SAFETY_TYPE_LABELS[r.type]
  const proj = r.projectName ? ` — ${r.projectName}` : ''
  const date = isPTP(r) ? ` (${formatDate(r.createdAt, r.locale ?? 'en')})` : ''
  return `${label}${proj}${date} [${r.id}]`
}

export type ShareOutcome = 'shared' | 'mailto' | 'cancelled' | 'unavailable'

/**
 * Share a record via the native share sheet, falling back to a mailto: link.
 * Returns how it was handled so the UI can give feedback.
 */
export async function shareRecord(r: SafetyRecord): Promise<ShareOutcome> {
  const subject = buildRecordSubject(r)
  const text = buildRecordText(r)

  // Native share sheet (iOS Safari, Android Chrome, some desktop).
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: subject, text })
      return 'shared'
    } catch (err) {
      // User cancelled the sheet — don't fall through to mailto.
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // Otherwise fall through to mailto.
    }
  }

  // Fallback: open the user's mail client with the body pre-filled.
  if (typeof window !== 'undefined') {
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
    window.open(mailto, '_self')
    return 'mailto'
  }

  return 'unavailable'
}
