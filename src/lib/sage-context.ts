import { getPtpForDate, getActivePermits, getAllSafetyRecords } from './safety-records'
import { getAllSdsRecords, getSdsById } from './sds-records'
import type { PreTaskPlan, AnyPermit } from './safety-types'
import { localToday } from './datetime'

function today(): string {
  return localToday()
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
  sdsSummary: string | null
  activeChemicalContext: string | null
}

function summarizePtp(ptp: PreTaskPlan): string {
  const validityLine = ptp.validUntil && ptp.validUntil !== ptp.date
    ? `Valid: ${ptp.date} through ${ptp.validUntil} (multi-day)`
    : `Valid: ${ptp.date} (single day)`
  const lines: string[] = [
    `TODAY'S PTP (${ptp.id}):`,
    validityLine,
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

function summarizeSdsLibrary(): string | null {
  const records = getAllSdsRecords()
  if (records.length === 0) return null
  const dangerChemicals = records.filter((r) => r.signalWord === 'Danger')
  const MAX_DANGER_NAMES = 10
  const dangerNames = dangerChemicals.slice(0, MAX_DANGER_NAMES).map((r) => r.productName)
  const dangerLine = dangerChemicals.length > 0
    ? `DANGER chemicals: ${dangerNames.join(', ')}${dangerChemicals.length > MAX_DANGER_NAMES ? ` and ${dangerChemicals.length - MAX_DANGER_NAMES} more` : ''}`
    : null
  const lines = [
    `SDS LIBRARY: ${records.length} chemical${records.length !== 1 ? 's' : ''} on site`,
    dangerLine,
  ]
  return lines.filter(Boolean).join('\n')
}

function summarizeActiveSds(sdsId: string): string | null {
  const sds = getSdsById(sdsId)
  if (!sds) return null
  const lines = [
    `ACTIVE SDS: ${sds.productName} (${sds.manufacturer})`,
    `Signal word: ${sds.signalWord}`,
    sds.casNumbers.length > 0 ? `CAS: ${sds.casNumbers.join(', ')}` : null,
    sds.ppeRequired.length > 0 ? `PPE required: ${sds.ppeRequired.join(', ')}` : null,
    `First aid (inhalation): ${sds.firstAid.inhalation}`,
    `First aid (skin): ${sds.firstAid.skin}`,
    `First aid (eyes): ${sds.firstAid.eyes}`,
    `First aid (ingestion): ${sds.firstAid.ingestion}`,
    sds.emergencyPhone ? `Emergency phone: ${sds.emergencyPhone}` : null,
    sds.spillProcedure ? `Spill response: ${sds.spillProcedure}` : null,
  ]
  return lines.filter(Boolean).join('\n')
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

  const sdsMatch = pageUrl.match(/\/sds\/([^/?#]+)/)
  const activeSdsId = sdsMatch ? decodeURIComponent(sdsMatch[1]) : null

  return {
    pageUrl,
    userName,
    timeOfDay: timeOfDay(),
    ptpSummary: ptp ? summarizePtp(ptp) : null,
    permitSummary: permits.length > 0 ? summarizePermits(permits) : null,
    recentIncidentCount: recentIncidents.length,
    sdsSummary: summarizeSdsLibrary(),
    activeChemicalContext: activeSdsId ? summarizeActiveSds(activeSdsId) : null,
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
    ctx.sdsSummary ?? null,
    ctx.activeChemicalContext ?? null,
  ]
  return lines.filter(Boolean).join('\n')
}
