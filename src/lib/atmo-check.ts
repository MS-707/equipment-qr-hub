import { getT, type TFunction } from '@/lib/i18n-core'

export interface AtmoReading {
  oxygen: number | null
  lel: number | null
  co: number | null
  h2s: number | null
}

export interface AtmoAlert {
  gas: string
  reading: number
  threshold: string
  severity: 'safe' | 'warning' | 'danger' | 'idlh'
  guidance: string
}

export interface AtmoAnalysis {
  safe: boolean
  alerts: AtmoAlert[]
  recommendations: string[]
}

/**
 * Guidance strings flow through the i18n catalog (atmo namespace, ES-6) so a
 * Spanish-preference worker reads gas alarms in Spanish. Callers pass their
 * t(); the default keeps every existing caller/test byte-identical English.
 * Thresholds/gas symbols stay literal — units are never translated.
 */

function checkOxygen(reading: number, t: TFunction): AtmoAlert {
  if (reading < 16) {
    return { gas: 'O2', reading, threshold: '<16%', severity: 'idlh', guidance: t('atmo.o2Idlh', { reading }) }
  }
  if (reading < 18) {
    return { gas: 'O2', reading, threshold: '<18%', severity: 'danger', guidance: t('atmo.o2DangerLow', { reading }) }
  }
  if (reading > 25) {
    return { gas: 'O2', reading, threshold: '>25%', severity: 'danger', guidance: t('atmo.o2DangerHigh', { reading }) }
  }
  if (reading < 19.5) {
    return { gas: 'O2', reading, threshold: '19.5%', severity: 'warning', guidance: t('atmo.o2WarnLow', { reading }) }
  }
  if (reading > 23.5) {
    return { gas: 'O2', reading, threshold: '23.5%', severity: 'warning', guidance: t('atmo.o2WarnHigh', { reading }) }
  }
  return { gas: 'O2', reading, threshold: '19.5–23.5%', severity: 'safe', guidance: t('atmo.withinLimits') }
}

function checkLel(reading: number, t: TFunction): AtmoAlert {
  if (reading >= 50) {
    return { gas: 'LEL', reading, threshold: '>=50%', severity: 'idlh', guidance: t('atmo.lelIdlh', { reading }) }
  }
  if (reading >= 25) {
    return { gas: 'LEL', reading, threshold: '25%', severity: 'danger', guidance: t('atmo.lelDanger', { reading }) }
  }
  if (reading >= 10) {
    return { gas: 'LEL', reading, threshold: '10%', severity: 'warning', guidance: t('atmo.lelWarn', { reading }) }
  }
  return { gas: 'LEL', reading, threshold: '<10%', severity: 'safe', guidance: t('atmo.withinLimits') }
}

function checkCo(reading: number, t: TFunction): AtmoAlert {
  if (reading >= 1200) {
    return { gas: 'CO', reading, threshold: '>=1200 ppm', severity: 'idlh', guidance: t('atmo.coIdlh', { reading }) }
  }
  if (reading >= 35) {
    return { gas: 'CO', reading, threshold: '35 ppm (NIOSH REL)', severity: 'danger', guidance: t('atmo.coDanger', { reading }) }
  }
  if (reading >= 25) {
    return { gas: 'CO', reading, threshold: '25 ppm (ACGIH TLV)', severity: 'warning', guidance: t('atmo.coWarn', { reading }) }
  }
  return { gas: 'CO', reading, threshold: '<25 ppm', severity: 'safe', guidance: t('atmo.withinLimits') }
}

function checkH2s(reading: number, t: TFunction): AtmoAlert {
  if (reading >= 100) {
    return { gas: 'H2S', reading, threshold: '>=100 ppm', severity: 'idlh', guidance: t('atmo.h2sIdlh', { reading }) }
  }
  if (reading >= 20) {
    return { gas: 'H2S', reading, threshold: '20 ppm', severity: 'danger', guidance: t('atmo.h2sDanger', { reading }) }
  }
  if (reading >= 10) {
    return { gas: 'H2S', reading, threshold: '10 ppm', severity: 'warning', guidance: t('atmo.h2sWarn', { reading }) }
  }
  return { gas: 'H2S', reading, threshold: '<10 ppm', severity: 'safe', guidance: t('atmo.withinLimits') }
}

const SEVERITY_ORDER: Record<AtmoAlert['severity'], number> = {
  safe: 0,
  warning: 1,
  danger: 2,
  idlh: 3,
}

export function analyzeAtmosphere(
  readings: AtmoReading,
  spaceDescription?: string,
  hazards?: string[],
  t: TFunction = getT('en'),
): AtmoAnalysis {
  const alerts: AtmoAlert[] = []

  if (readings.oxygen !== null) alerts.push(checkOxygen(readings.oxygen, t))
  if (readings.lel !== null) alerts.push(checkLel(readings.lel, t))
  if (readings.co !== null) alerts.push(checkCo(readings.co, t))
  if (readings.h2s !== null) alerts.push(checkH2s(readings.h2s, t))

  alerts.sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity])

  const safe = alerts.every((a) => a.severity === 'safe')
  const recommendations: string[] = []

  const elevatedCount = alerts.filter((a) => a.severity !== 'safe').length
  if (elevatedCount >= 2) {
    recommendations.push(t('atmo.recMultiple'))
  }

  if (readings.oxygen !== null && readings.oxygen > 23.5) {
    recommendations.push(t('atmo.recEnriched'))
  }

  const hazardLower = (hazards ?? []).map((h) => h.toLowerCase())
  if (
    hazardLower.some((h) => h.includes('chemical') || h.includes('químic')) &&
    readings.h2s !== null &&
    readings.h2s === 0
  ) {
    recommendations.push(t('atmo.recH2sZero'))
  }

  if (
    hazardLower.some((h) => h.includes('chemical') || h.includes('químic')) &&
    readings.co !== null &&
    readings.co === 0
  ) {
    recommendations.push(t('atmo.recCoZero'))
  }

  if (
    readings.lel !== null &&
    readings.lel > 0 &&
    readings.oxygen !== null &&
    readings.oxygen > 23.5
  ) {
    recommendations.push(t('atmo.recLelEnriched'))
  }

  if (
    readings.oxygen !== null &&
    readings.oxygen < 19.5 &&
    readings.h2s !== null &&
    readings.h2s > 0
  ) {
    recommendations.push(t('atmo.recLowO2H2s'))
  }

  return { safe, alerts, recommendations }
}
