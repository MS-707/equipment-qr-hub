import { describe, it, expect } from 'vitest'
import { getOfflineAnalysis } from '../incident-patterns'

describe('getOfflineAnalysis', () => {
  it('returns null for unrecognized descriptions', () => {
    expect(getOfflineAnalysis('other', 'some random event')).toBeNull()
  })

  it('matches laceration pattern', () => {
    const result = getOfflineAnalysis('injury', 'Worker received a cut from angle grinder')
    expect(result).not.toBeNull()
    expect(result!.rootCauses[0].category).toBe('equipment')
    expect(result!.correctiveActions.length).toBeGreaterThan(0)
  })

  it('matches fall pattern', () => {
    const result = getOfflineAnalysis('injury', 'Worker fell from scaffold')
    expect(result).not.toBeNull()
    expect(result!.rootCauses.some((rc) => rc.cause.includes('fall protection'))).toBe(true)
  })

  it('matches struck-by pattern', () => {
    const result = getOfflineAnalysis('injury', 'Worker was struck by falling object from crane')
    expect(result).not.toBeNull()
    expect(result!.correctiveActions.some((ca) => ca.controlLevel === 'engineering')).toBe(true)
  })

  it('matches burn/hot work pattern', () => {
    const result = getOfflineAnalysis('injury', 'Worker burned during welding operation')
    expect(result).not.toBeNull()
    expect(result!.correctiveActions.some((ca) => ca.action.includes('hot work permit'))).toBe(true)
  })

  it('matches electrical pattern', () => {
    const result = getOfflineAnalysis('injury', 'Electric shock from panel')
    expect(result).not.toBeNull()
    expect(result!.rootCauses.some((rc) => rc.cause.includes('de-energize'))).toBe(true)
  })

  it('matches caught-in/crush pattern', () => {
    const result = getOfflineAnalysis('injury', 'Worker was caught between conveyor rollers and crushed')
    expect(result).not.toBeNull()
    expect(result!.rootCauses.some((rc) => rc.cause.includes('guarding'))).toBe(true)
  })

  it('matches slip/trip pattern', () => {
    const result = getOfflineAnalysis('near-miss', 'Worker slipped on wet floor')
    expect(result).not.toBeNull()
    expect(result!.rootCauses[0].category).toBe('environment')
  })

  it('matches chemical exposure pattern', () => {
    const result = getOfflineAnalysis('injury', 'Worker inhalation exposure to silica dust')
    expect(result).not.toBeNull()
    expect(result!.correctiveActions.some((ca) => ca.action.includes('respiratory'))).toBe(true)
  })

  it('matches strain/ergonomic pattern', () => {
    const result = getOfflineAnalysis('injury', 'Back injury from overexertion lifting heavy materials')
    expect(result).not.toBeNull()
    expect(result!.correctiveActions.some((ca) => ca.action.includes('mechanical lifting'))).toBe(true)
  })

  it('matches heat illness pattern', () => {
    const result = getOfflineAnalysis('injury', 'Heat exhaustion and dehydration on site')
    expect(result).not.toBeNull()
    expect(result!.correctiveActions.some((ca) => ca.action.includes('water-rest-shade'))).toBe(true)
  })

  it('prefers pattern with higher keyword score', () => {
    const result = getOfflineAnalysis('injury', 'Worker fell from scaffold at height on ladder')
    expect(result).not.toBeNull()
    expect(result!.rootCauses[0].cause).toContain('fall protection')
  })

  it('boosts score with secondary keywords', () => {
    const result = getOfflineAnalysis('injury', 'Worker cut by circular saw blade')
    expect(result).not.toBeNull()
    expect(result!.rootCauses[0].category).toBe('equipment')
  })

  it('is case-insensitive', () => {
    const result = getOfflineAnalysis('INJURY', 'WORKER FELL FROM SCAFFOLD')
    expect(result).not.toBeNull()
  })

  it('returns root causes with why chains', () => {
    const result = getOfflineAnalysis('injury', 'Worker fell from ladder')
    expect(result).not.toBeNull()
    for (const rc of result!.rootCauses) {
      expect(rc.whyChain.length).toBeGreaterThan(0)
      expect(rc.category).toBeTruthy()
    }
  })

  it('returns corrective actions with control hierarchy', () => {
    const result = getOfflineAnalysis('injury', 'Worker slipped on wet surface')
    expect(result).not.toBeNull()
    const levels = result!.correctiveActions.map((ca) => ca.controlLevel)
    expect(levels.some((l) => ['elimination', 'substitution', 'engineering', 'administrative', 'ppe'].includes(l))).toBe(true)
  })

  it('returns corrective actions with priority', () => {
    const result = getOfflineAnalysis('injury', 'Electric shock')
    expect(result).not.toBeNull()
    const priorities = result!.correctiveActions.map((ca) => ca.priority)
    expect(priorities.every((p) => ['immediate', 'short-term', 'long-term'].includes(p))).toBe(true)
  })
})
