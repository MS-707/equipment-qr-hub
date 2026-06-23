import { describe, it, expect } from 'vitest'
import { analyzeAtmosphere, type AtmoReading } from '../atmo-check'

function readings(overrides: Partial<AtmoReading> = {}): AtmoReading {
  return { oxygen: 20.9, lel: 0, co: 0, h2s: 0, ...overrides }
}

describe('analyzeAtmosphere — oxygen', () => {
  it('flags normal O2 (20.9%) as safe', () => {
    const result = analyzeAtmosphere(readings({ oxygen: 20.9 }))
    const o2 = result.alerts.find((a) => a.gas === 'O2')
    expect(o2?.severity).toBe('safe')
    expect(result.safe).toBe(true)
  })

  it('flags low O2 (19.0%) as warning', () => {
    const result = analyzeAtmosphere(readings({ oxygen: 19.0 }))
    const o2 = result.alerts.find((a) => a.gas === 'O2')
    expect(o2?.severity).toBe('warning')
  })

  it('flags O2 at 17.5% as danger', () => {
    const result = analyzeAtmosphere(readings({ oxygen: 17.5 }))
    const o2 = result.alerts.find((a) => a.gas === 'O2')
    expect(o2?.severity).toBe('danger')
    expect(result.safe).toBe(false)
  })

  it('flags O2 below 16% as IDLH', () => {
    const result = analyzeAtmosphere(readings({ oxygen: 14.0 }))
    const o2 = result.alerts.find((a) => a.gas === 'O2')
    expect(o2?.severity).toBe('idlh')
    expect(o2?.guidance).toContain('EVACUATE')
  })

  it('flags high O2 (24%) as warning', () => {
    const result = analyzeAtmosphere(readings({ oxygen: 24.0 }))
    const o2 = result.alerts.find((a) => a.gas === 'O2')
    expect(o2?.severity).toBe('warning')
  })

  it('flags very high O2 (26%) as danger', () => {
    const result = analyzeAtmosphere(readings({ oxygen: 26.0 }))
    const o2 = result.alerts.find((a) => a.gas === 'O2')
    expect(o2?.severity).toBe('danger')
  })

  it('boundary: O2 at 19.5% is safe', () => {
    const result = analyzeAtmosphere(readings({ oxygen: 19.5 }))
    const o2 = result.alerts.find((a) => a.gas === 'O2')
    expect(o2?.severity).toBe('safe')
  })

  it('boundary: O2 at 23.5% is safe', () => {
    const result = analyzeAtmosphere(readings({ oxygen: 23.5 }))
    const o2 = result.alerts.find((a) => a.gas === 'O2')
    expect(o2?.severity).toBe('safe')
  })
})

describe('analyzeAtmosphere — LEL', () => {
  it('flags 0% LEL as safe', () => {
    const result = analyzeAtmosphere(readings({ lel: 0 }))
    const lel = result.alerts.find((a) => a.gas === 'LEL')
    expect(lel?.severity).toBe('safe')
  })

  it('flags 12% LEL as warning', () => {
    const result = analyzeAtmosphere(readings({ lel: 12 }))
    const lel = result.alerts.find((a) => a.gas === 'LEL')
    expect(lel?.severity).toBe('warning')
  })

  it('flags 30% LEL as danger', () => {
    const result = analyzeAtmosphere(readings({ lel: 30 }))
    const lel = result.alerts.find((a) => a.gas === 'LEL')
    expect(lel?.severity).toBe('danger')
  })

  it('flags 50%+ LEL as IDLH', () => {
    const result = analyzeAtmosphere(readings({ lel: 55 }))
    const lel = result.alerts.find((a) => a.gas === 'LEL')
    expect(lel?.severity).toBe('idlh')
    expect(lel?.guidance).toContain('EVACUATE')
  })
})

describe('analyzeAtmosphere — CO', () => {
  it('flags 0 ppm CO as safe', () => {
    const result = analyzeAtmosphere(readings({ co: 0 }))
    const co = result.alerts.find((a) => a.gas === 'CO')
    expect(co?.severity).toBe('safe')
  })

  it('flags 28 ppm CO as warning (ACGIH TLV)', () => {
    const result = analyzeAtmosphere(readings({ co: 28 }))
    const co = result.alerts.find((a) => a.gas === 'CO')
    expect(co?.severity).toBe('warning')
  })

  it('flags 40 ppm CO as danger (NIOSH REL)', () => {
    const result = analyzeAtmosphere(readings({ co: 40 }))
    const co = result.alerts.find((a) => a.gas === 'CO')
    expect(co?.severity).toBe('danger')
  })

  it('flags 1200+ ppm CO as IDLH', () => {
    const result = analyzeAtmosphere(readings({ co: 1500 }))
    const co = result.alerts.find((a) => a.gas === 'CO')
    expect(co?.severity).toBe('idlh')
  })
})

describe('analyzeAtmosphere — H2S', () => {
  it('flags 0 ppm H2S as safe', () => {
    const result = analyzeAtmosphere(readings({ h2s: 0 }))
    const h2s = result.alerts.find((a) => a.gas === 'H2S')
    expect(h2s?.severity).toBe('safe')
  })

  it('flags 12 ppm H2S as warning', () => {
    const result = analyzeAtmosphere(readings({ h2s: 12 }))
    const h2s = result.alerts.find((a) => a.gas === 'H2S')
    expect(h2s?.severity).toBe('warning')
  })

  it('flags 25 ppm H2S as danger', () => {
    const result = analyzeAtmosphere(readings({ h2s: 25 }))
    const h2s = result.alerts.find((a) => a.gas === 'H2S')
    expect(h2s?.severity).toBe('danger')
  })

  it('flags 100+ ppm H2S as IDLH', () => {
    const result = analyzeAtmosphere(readings({ h2s: 150 }))
    const h2s = result.alerts.find((a) => a.gas === 'H2S')
    expect(h2s?.severity).toBe('idlh')
  })
})

describe('analyzeAtmosphere — null readings', () => {
  it('skips gases with null readings', () => {
    const result = analyzeAtmosphere({ oxygen: null, lel: null, co: null, h2s: null })
    expect(result.alerts).toHaveLength(0)
    expect(result.safe).toBe(true)
  })

  it('analyzes only gases with non-null readings', () => {
    const result = analyzeAtmosphere({ oxygen: 20.9, lel: null, co: null, h2s: null })
    expect(result.alerts).toHaveLength(1)
    expect(result.alerts[0].gas).toBe('O2')
  })
})

describe('analyzeAtmosphere — cross-gas recommendations', () => {
  it('warns about multiple elevated readings', () => {
    const result = analyzeAtmosphere(readings({ oxygen: 17.5, co: 40 }))
    expect(result.recommendations.some((r) => r.includes('Multiple elevated readings'))).toBe(true)
  })

  it('warns about enriched O2 fire risk', () => {
    const result = analyzeAtmosphere(readings({ oxygen: 24.0 }))
    expect(result.recommendations.some((r) => r.includes('fire/explosion risk'))).toBe(true)
  })

  it('warns about LEL + enriched O2 combination', () => {
    const result = analyzeAtmosphere(readings({ oxygen: 24.0, lel: 5 }))
    expect(result.recommendations.some((r) => r.includes('extreme explosion risk'))).toBe(true)
  })

  it('warns about low O2 + H2S displacement', () => {
    const result = analyzeAtmosphere(readings({ oxygen: 18.0, h2s: 5 }))
    expect(result.recommendations.some((r) => r.includes('toxic gas may be displacing oxygen'))).toBe(true)
  })

  it('warns about zero sensor readings with chemical hazards', () => {
    const result = analyzeAtmosphere(readings({ h2s: 0 }), 'tank', ['Chemical storage'])
    expect(result.recommendations.some((r) => r.includes('verify sensor calibration'))).toBe(true)
  })
})

describe('analyzeAtmosphere — alert sorting', () => {
  it('sorts alerts by severity descending (most dangerous first)', () => {
    const result = analyzeAtmosphere(readings({ oxygen: 14.0, lel: 12, co: 0, h2s: 0 }))
    expect(result.alerts[0].severity).toBe('idlh')
    expect(result.alerts[1].severity).toBe('warning')
  })
})
