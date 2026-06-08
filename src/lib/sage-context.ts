import { getPtpForDate, getActivePermits, getAllSafetyRecords } from './safety-records'
import type { PreTaskPlan, AnyPermit } from './safety-types'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function timeOfDay(): string {
  const h = new Date().getHours()
  if (h < 6) return 'early morning'
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

export interface SageContext {
  pageUrl: string
  userName: string | null
  timeOfDay: string
  ptpSummary: string | null
  permitSummary: string | null
  recentIncidentCount: number
}

function summarizePtp(ptp: PreTaskPlan): string {
  const lines: string[] = [
    `TODAY'S PTP (${ptp.id}):`,
    `Scope: ${ptp.scopeOfWork || '(not specified)'}`,
    `Location: ${ptp.location || '(not specified)'}`,
    `Project: ${ptp.projectName || '(not specified)'}`,
  ]

  if (ptp.hazards.length > 0) {
    const hazardList = ptp.hazards
      .map((h) => `${h.description} (${h.riskLevel})`)
      .join(', ')
    lines.push(`Hazards: ${hazardList}`)
  } else {
    lines.push('Hazards: NONE IDENTIFIED — this is a gap')
  }

  if (ptp.ppeRequired.length > 0) {
    lines.push(`PPE: ${ptp.ppeRequired.join(', ')}`)
  } else {
    lines.push('PPE: NOT SPECIFIED — this is a gap')
  }

  if (ptp.emergencyMusterPoint) {
    lines.push(`Muster point: ${ptp.emergencyMusterPoint}`)
  } else {
    lines.push('Muster point: NOT SET — this is a gap')
  }

  if (ptp.weatherNotes) {
    lines.push(`Weather: ${ptp.weatherNotes}${ptp.windSpeed ? `, wind ${ptp.windSpeed}` : ''}`)
  }

  const signed = ptp.crewSignatures.filter((s) => s.hasSignature)
  const supervisor = ptp.crewSignatures.find((s) => s.role === 'supervisor' && s.hasSignature)
  lines.push(`Crew: ${signed.length} signed${supervisor ? `, supervisor: ${supervisor.name}` : ' — NO SUPERVISOR SIGNATURE'}`)

  if (!ptp.toolboxTalkTopic) {
    lines.push('Toolbox talk: NOT SET — consider adding a topic')
  } else {
    lines.push(`Toolbox talk: ${ptp.toolboxTalkTopic}`)
  }

  const hip = ptp.heatIllnessPlan
  if (hip && (!hip.water || !hip.shade || !hip.restBreaks)) {
    const missing = []
    if (!hip.water) missing.push('water')
    if (!hip.shade) missing.push('shade')
    if (!hip.restBreaks) missing.push('rest breaks')
    lines.push(`Heat illness plan gaps: ${missing.join(', ')}`)
  }

  return lines.join('\n')
}

function summarizePermits(permits: AnyPermit[]): string {
  if (permits.length === 0) return ''
  const lines = permits.map((p) => {
    let desc: string | undefined
    if ('workDescription' in p) desc = (p as { workDescription?: string }).workDescription
    else if ('spaceDescription' in p) desc = (p as { spaceDescription?: string }).spaceDescription
    if (!desc) desc = p.projectName
    const validUntil = p.validUntil
      ? new Date(p.validUntil).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : 'no expiry set'
    return `${p.id} (${p.type}) — ${desc || 'no description'}, expires ${validUntil}`
  })
  return `ACTIVE PERMITS:\n${lines.join('\n')}`
}

export function buildSageContext(
  pageUrl: string,
  userName: string | null
): SageContext {
  const ptp = getPtpForDate(today())
  const permits = getActivePermits()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const recentIncidents = getAllSafetyRecords().filter(
    (r) => r.type === 'incident-report' && r.createdAt > sevenDaysAgo
  )

  return {
    pageUrl,
    userName,
    timeOfDay: timeOfDay(),
    ptpSummary: ptp ? summarizePtp(ptp) : null,
    permitSummary: permits.length > 0 ? summarizePermits(permits) : null,
    recentIncidentCount: recentIncidents.length,
  }
}

export function contextToPrompt(ctx: SageContext): string {
  const lines = [
    `Current page: ${ctx.pageUrl}`,
    ctx.userName ? `Worker: ${ctx.userName}` : null,
    `Time: ${ctx.timeOfDay}`,
    ctx.ptpSummary ?? "Today's PTP: Not started",
    ctx.permitSummary ?? null,
    ctx.recentIncidentCount > 0
      ? `Recent incidents (7 days): ${ctx.recentIncidentCount}`
      : null,
  ]
  return lines.filter(Boolean).join('\n')
}
