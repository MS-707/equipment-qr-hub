/**
 * Record sharing — turns a safety record into a plain-text summary and shares
 * it via the native share sheet (iOS/Android) with a mailto: fallback for
 * desktop. Teams often need to email a completed PTP or permit to a manager
 * or client rep; on iPhone the Web Share API surfaces Mail, Messages, and
 * AirDrop in one tap.
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
} from '@/lib/safety-types'
import {
  SAFETY_TYPE_LABELS,
  RISK_LABELS,
  isPTP,
  isJHA,
  isPermit,
  isIncident,
} from '@/lib/safety-types'
import { ppeLabel } from '@/data/safety-checklists'

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function sigLines(sigs: CrewSignature[]): string[] {
  if (sigs.length === 0) return ['  (none)']
  return sigs.map((s) => {
    const role = s.role ? ` — ${s.role}` : ''
    const signed = s.hasSignature ? '✓ signed' : 'not signed'
    return `  • ${s.name}${role} (${signed}, ${new Date(s.signedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })})`
  })
}

function ptpBody(p: PreTaskPlan): string[] {
  const lines: string[] = []
  lines.push(`Date: ${p.date}  ·  Shift: ${p.shift}`)
  lines.push('')
  lines.push('SCOPE OF WORK')
  lines.push(p.scopeOfWork || '  (none)')
  lines.push('')
  lines.push('HAZARDS & CONTROLS')
  if (p.hazards.length === 0) {
    lines.push('  (none recorded)')
  } else {
    p.hazards.forEach((h, i) => {
      lines.push(`  ${i + 1}. ${h.description} [${RISK_LABELS[h.riskLevel]} risk]`)
      lines.push(`     Control: ${h.controlMeasure || '—'}`)
    })
  }
  if (p.ppeRequired.length > 0) {
    lines.push('')
    lines.push('PPE REQUIRED')
    lines.push('  ' + p.ppeRequired.map(ppeLabel).join(', '))
  }
  const site = [
    p.emergencyMusterPoint && `Muster point: ${p.emergencyMusterPoint}`,
    p.nearestHospital && `Nearest hospital: ${p.nearestHospital}`,
    p.firstAidEyewashLocation && `First aid / eyewash: ${p.firstAidEyewashLocation}`,
    p.weatherNotes && `Weather: ${p.weatherNotes}`,
    p.windSpeed && `Wind: ${p.windSpeed}`,
  ].filter(Boolean) as string[]
  if (site.length > 0) {
    lines.push('')
    lines.push('SITE CONDITIONS & EMERGENCY')
    site.forEach((s) => lines.push('  ' + s))
  }
  if (p.toolboxTalkTopic || p.toolboxTalkNotes) {
    lines.push('')
    lines.push('TOOLBOX TALK')
    if (p.toolboxTalkTopic) lines.push('  ' + p.toolboxTalkTopic)
    if (p.toolboxTalkNotes) lines.push('  ' + p.toolboxTalkNotes)
  }
  lines.push('')
  lines.push(`CREW SIGN-ON (${p.crewSignatures.length})`)
  lines.push(...sigLines(p.crewSignatures))
  return lines
}

function jhaBody(j: JobHazardAnalysis): string[] {
  const lines: string[] = []
  lines.push(`Job / task: ${j.jobTitle || '—'}`)
  lines.push(`Date of analysis: ${j.dateOfAnalysis}`)
  if (j.department) lines.push(`Department / team: ${j.department}`)
  if (j.referenceDoc) lines.push(`Reference doc: ${j.referenceDoc}`)
  if (j.ppeRequired.length > 0) {
    lines.push('')
    lines.push('PPE REQUIRED')
    lines.push('  ' + j.ppeRequired.map(ppeLabel).join(', '))
  }
  lines.push('')
  lines.push(`HAZARD ANALYSIS (${j.steps.length} steps)`)
  j.steps.forEach((s, i) => {
    lines.push('')
    lines.push(`  Step ${i + 1} [${RISK_LABELS[s.riskLevel]} risk]: ${s.taskActivity}`)
    if (s.hazards) lines.push(`    Hazards: ${s.hazards.replace(/\n/g, '; ')}`)
    if (s.controls) lines.push(`    Controls: ${s.controls.replace(/\n/g, '; ')}`)
    if (s.responsible) lines.push(`    Responsible: ${s.responsible}`)
  })
  if (j.additionalNotes) {
    lines.push('')
    lines.push('ADDITIONAL NOTES')
    lines.push(j.additionalNotes)
  }
  return lines
}

function permitBody(p: AnyPermit): string[] {
  const lines: string[] = []
  lines.push(`Valid: ${fmt(p.validFrom)} → ${fmt(p.validUntil)}`)
  if ('workDescription' in p && p.workDescription) lines.push(`Work: ${(p as HeightPermit | HotWorkPermit).workDescription}`)
  lines.push('')

  if (p.type === 'height-permit') {
    const h = p as HeightPermit
    if (h.workingHeight) lines.push(`Working height: ${h.workingHeight}`)
    if (h.accessMethod.length) lines.push(`Access: ${h.accessMethod.join(', ')}`)
    if (h.fallProtection.length) lines.push(`Fall protection: ${h.fallProtection.join(', ')}`)
    if (h.anchorPoints) lines.push(`Anchor points: ${h.anchorPoints}`)
    if (h.rescuePlan) lines.push(`Rescue plan: ${h.rescuePlan}`)
  } else if (p.type === 'hot-work-permit') {
    const h = p as HotWorkPermit
    if (h.hotWorkTypes.length) lines.push(`Type: ${h.hotWorkTypes.join(', ')}`)
    lines.push(`Fire watch: ${h.fireWatchRequired ? `Yes — ${h.fireWatchName || 'unassigned'}` : 'No'}`)
    if (h.fireWatchRequired) lines.push(`Post-work monitoring: ${h.fireWatchPostDurationMin} min`)
    if (h.extinguisherLocation) lines.push(`Extinguisher: ${h.extinguisherType} at ${h.extinguisherLocation}`)
    if (h.sprinklerStatus) lines.push(`Sprinkler status: ${h.sprinklerStatus}`)
    if (h.gasTestRequired) lines.push(`Atmosphere test: ${h.gasTestNotes || 'required'}`)
  } else if (p.type === 'confined-space-permit') {
    const c = p as ConfinedSpacePermit
    if (c.spaceDescription) lines.push(`Space: ${c.spaceDescription}`)
    if (c.hazards.length) lines.push(`Hazards: ${c.hazards.join(', ')}`)
    const a = c.atmospheric
    lines.push(`Atmosphere — O₂: ${a.oxygenPct || '—'}%, LEL: ${a.lelPct || '—'}%, CO: ${a.coPpm || '—'}ppm, H₂S: ${a.h2sPpm || '—'}ppm`)
    if (a.testedBy) lines.push(`Tested by: ${a.testedBy}${a.testedAt ? ` at ${fmt(a.testedAt)}` : ''}`)
    lines.push(`Attendant: ${c.attendantName || '—'}`)
    lines.push(`Continuous monitoring: ${c.continuousMonitoring ? 'Yes' : 'No'}  ·  Ventilation: ${c.ventilationInUse ? 'In use' : 'No'}`)
    if (c.rescuePlan) lines.push(`Rescue plan: ${c.rescuePlan}`)
  }

  lines.push('')
  lines.push('CHECKLIST')
  p.checklist.forEach((c) => {
    lines.push(`  ${c.checked ? '✓' : '○'} ${c.label}${c.notes ? ` — ${c.notes}` : ''}`)
  })

  const workers = 'workers' in p ? p.workers : []
  const entrants = 'entrants' in p ? (p as ConfinedSpacePermit).entrants : []
  const sigs = [...workers, ...entrants]
  lines.push('')
  lines.push(`SIGN-ON (${sigs.length})`)
  lines.push(...sigLines(sigs))
  return lines
}

function incidentBody(inc: IncidentReport): string[] {
  const lines: string[] = []
  lines.push(`Type: ${inc.incidentType}  ·  Severity: ${inc.severity}`)
  lines.push(`Occurred: ${fmt(inc.occurredAt)}`)
  lines.push('')
  lines.push('DESCRIPTION')
  lines.push(inc.description || '  (none)')
  if (inc.immediateActions) {
    lines.push('')
    lines.push('IMMEDIATE ACTIONS')
    lines.push(inc.immediateActions)
  }
  if (inc.witnesses.length) {
    lines.push('')
    lines.push('WITNESSES')
    lines.push('  ' + inc.witnesses.join(', '))
  }
  if (inc.rootCause) {
    lines.push('')
    lines.push('ROOT CAUSE')
    lines.push(inc.rootCause)
  }
  if (inc.correctiveActions) {
    lines.push('')
    lines.push('CORRECTIVE ACTIONS')
    lines.push(inc.correctiveActions)
  }
  if (inc.reportedToCalOsha) {
    lines.push('')
    lines.push('Reported to authorities: Yes')
  }
  return lines
}

/** Build a plain-text summary of a record suitable for email / messaging. */
export function buildRecordText(r: SafetyRecord): string {
  const label = SAFETY_TYPE_LABELS[r.type]
  const header = [
    `${label}`,
    `Ref: ${r.id}`,
    `Project: ${r.projectName || '—'}`,
    `Location: ${r.location || '—'}`,
    `Prepared by: ${r.createdBy}`,
    `Created: ${fmt(r.createdAt)}`,
  ]
  if (r.reviewStatus) header.push(`EHS review: ${r.reviewStatus}`)

  let body: string[] = []
  try {
    if (isPTP(r)) body = ptpBody(r)
    else if (isJHA(r)) body = jhaBody(r)
    else if (isPermit(r)) body = permitBody(r as AnyPermit)
    else if (isIncident(r)) body = incidentBody(r)
  } catch {
    body = ['(Record details unavailable — partial data)']
  }

  return [...header, '', '────────────────────', '', ...body, '', '────────────────────', 'Generated by Sage EHS'].join('\n')
}

/** Subject line for the share / email. */
export function buildRecordSubject(r: SafetyRecord): string {
  const label = SAFETY_TYPE_LABELS[r.type]
  const proj = r.projectName ? ` — ${r.projectName}` : ''
  const date = isPTP(r) ? ` (${fmtDate(r.createdAt)})` : ''
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
    window.location.href = mailto
    return 'mailto'
  }

  return 'unavailable'
}
