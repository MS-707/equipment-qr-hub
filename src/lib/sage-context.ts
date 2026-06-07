import { getPtpForDate, getActivePermits, getAllSafetyRecords } from './safety-records'

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
  todayPtpStatus: 'none' | 'drafted' | 'signed'
  todayPtpHazards: number
  activePermitCount: number
  recentIncidentCount: number
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
    todayPtpStatus: ptp
      ? ptp.crewSignatures.some((s) => s.hasSignature)
        ? 'signed'
        : 'drafted'
      : 'none',
    todayPtpHazards: ptp?.hazards.length ?? 0,
    activePermitCount: permits.length,
    recentIncidentCount: recentIncidents.length,
  }
}

export function contextToPrompt(ctx: SageContext): string {
  const lines = [
    `Current page: ${ctx.pageUrl}`,
    ctx.userName ? `Worker: ${ctx.userName}` : null,
    `Time: ${ctx.timeOfDay}`,
    `Today's PTP: ${ctx.todayPtpStatus}${ctx.todayPtpHazards > 0 ? ` (${ctx.todayPtpHazards} hazards identified)` : ''}`,
    `Active permits: ${ctx.activePermitCount}`,
    ctx.recentIncidentCount > 0
      ? `Recent incidents (7 days): ${ctx.recentIncidentCount}`
      : null,
  ]
  return lines.filter(Boolean).join('\n')
}
