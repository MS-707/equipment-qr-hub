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

function checkOxygen(reading: number): AtmoAlert {
  if (reading < 16) {
    return {
      gas: 'O2',
      reading,
      threshold: '<16%',
      severity: 'idlh',
      guidance: `O2 at ${reading}% is Immediately Dangerous to Life — EVACUATE, emergency rescue only with SCBA`,
    }
  }
  if (reading < 18) {
    return {
      gas: 'O2',
      reading,
      threshold: '<18%',
      severity: 'danger',
      guidance: `O2 at ${reading}% is dangerously low — DO NOT ENTER, ventilate immediately`,
    }
  }
  if (reading > 25) {
    return {
      gas: 'O2',
      reading,
      threshold: '>25%',
      severity: 'danger',
      guidance: `O2 at ${reading}% is dangerously elevated — DO NOT ENTER, oxygen-enriched atmosphere increases fire/explosion risk`,
    }
  }
  if (reading < 19.5) {
    return {
      gas: 'O2',
      reading,
      threshold: '19.5%',
      severity: 'warning',
      guidance: `O2 at ${reading}% is below the safe minimum of 19.5% — increase ventilation and retest`,
    }
  }
  if (reading > 23.5) {
    return {
      gas: 'O2',
      reading,
      threshold: '23.5%',
      severity: 'warning',
      guidance: `O2 at ${reading}% exceeds the safe maximum of 23.5% — identify oxygen source, ventilate and retest`,
    }
  }
  return {
    gas: 'O2',
    reading,
    threshold: '19.5–23.5%',
    severity: 'safe',
    guidance: 'Within safe limits',
  }
}

function checkLel(reading: number): AtmoAlert {
  if (reading >= 50) {
    return {
      gas: 'LEL',
      reading,
      threshold: '>=50%',
      severity: 'idlh',
      guidance: `LEL at ${reading}% is Immediately Dangerous to Life — EVACUATE, explosive atmosphere, emergency rescue only with SCBA`,
    }
  }
  if (reading >= 25) {
    return {
      gas: 'LEL',
      reading,
      threshold: '25%',
      severity: 'danger',
      guidance: `LEL at ${reading}% is dangerously elevated — DO NOT ENTER, ventilate immediately`,
    }
  }
  if (reading >= 10) {
    return {
      gas: 'LEL',
      reading,
      threshold: '10%',
      severity: 'warning',
      guidance: `LEL at ${reading}% exceeds the safe limit of 10% — increase ventilation and retest`,
    }
  }
  return {
    gas: 'LEL',
    reading,
    threshold: '<10%',
    severity: 'safe',
    guidance: 'Within safe limits',
  }
}

function checkCo(reading: number): AtmoAlert {
  if (reading >= 1200) {
    return {
      gas: 'CO',
      reading,
      threshold: '>=1200 ppm',
      severity: 'idlh',
      guidance: `CO at ${reading} ppm is Immediately Dangerous to Life — EVACUATE, emergency rescue only with SCBA`,
    }
  }
  if (reading >= 35) {
    return {
      gas: 'CO',
      reading,
      threshold: '35 ppm (NIOSH REL)',
      severity: 'danger',
      guidance: `CO at ${reading} ppm exceeds the NIOSH REL of 35 ppm — DO NOT ENTER, ventilate immediately`,
    }
  }
  if (reading >= 25) {
    return {
      gas: 'CO',
      reading,
      threshold: '25 ppm (ACGIH TLV)',
      severity: 'warning',
      guidance: `CO at ${reading} ppm exceeds the action level of 25 ppm — increase ventilation and retest before entry`,
    }
  }
  return {
    gas: 'CO',
    reading,
    threshold: '<25 ppm',
    severity: 'safe',
    guidance: 'Within safe limits',
  }
}

function checkH2s(reading: number): AtmoAlert {
  if (reading >= 100) {
    return {
      gas: 'H2S',
      reading,
      threshold: '>=100 ppm',
      severity: 'idlh',
      guidance: `H2S at ${reading} ppm is Immediately Dangerous to Life — EVACUATE, emergency rescue only with SCBA`,
    }
  }
  if (reading >= 20) {
    return {
      gas: 'H2S',
      reading,
      threshold: '20 ppm',
      severity: 'danger',
      guidance: `H2S at ${reading} ppm is dangerously elevated — DO NOT ENTER, ventilate immediately`,
    }
  }
  if (reading >= 10) {
    return {
      gas: 'H2S',
      reading,
      threshold: '10 ppm',
      severity: 'warning',
      guidance: `H2S at ${reading} ppm exceeds the safe limit of 10 ppm — increase ventilation and retest`,
    }
  }
  return {
    gas: 'H2S',
    reading,
    threshold: '<10 ppm',
    severity: 'safe',
    guidance: 'Within safe limits',
  }
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
): AtmoAnalysis {
  const alerts: AtmoAlert[] = []

  if (readings.oxygen !== null) alerts.push(checkOxygen(readings.oxygen))
  if (readings.lel !== null) alerts.push(checkLel(readings.lel))
  if (readings.co !== null) alerts.push(checkCo(readings.co))
  if (readings.h2s !== null) alerts.push(checkH2s(readings.h2s))

  alerts.sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity])

  const safe = alerts.every((a) => a.severity === 'safe')
  const recommendations: string[] = []

  const elevatedCount = alerts.filter((a) => a.severity !== 'safe').length
  if (elevatedCount >= 2) {
    recommendations.push('Multiple elevated readings suggest active atmospheric hazard — do not enter')
  }

  if (readings.oxygen !== null && readings.oxygen > 23.5) {
    recommendations.push('Enriched oxygen atmosphere — fire/explosion risk, remove all ignition sources')
  }

  const hazardLower = (hazards ?? []).map((h) => h.toLowerCase())
  if (
    hazardLower.some((h) => h.includes('chemical')) &&
    readings.h2s !== null &&
    readings.h2s === 0
  ) {
    recommendations.push('Chemical hazard listed but H2S is 0 — verify sensor calibration')
  }

  if (
    hazardLower.some((h) => h.includes('chemical')) &&
    readings.co !== null &&
    readings.co === 0
  ) {
    recommendations.push('Chemical hazard listed but CO is 0 — verify sensor calibration')
  }

  if (
    readings.lel !== null &&
    readings.lel > 0 &&
    readings.oxygen !== null &&
    readings.oxygen > 23.5
  ) {
    recommendations.push('Flammable gas detected in oxygen-enriched atmosphere — extreme explosion risk')
  }

  if (
    readings.oxygen !== null &&
    readings.oxygen < 19.5 &&
    readings.h2s !== null &&
    readings.h2s > 0
  ) {
    recommendations.push('Low oxygen with H2S present — toxic gas may be displacing oxygen, do not enter without SCBA')
  }

  return { safe, alerts, recommendations }
}
