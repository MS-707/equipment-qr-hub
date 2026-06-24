import { describe, it, expect } from 'vitest'
import { matchFaq } from '../sage-faq'

describe('matchFaq', () => {
  it('matches PTP/pre-task patterns', () => {
    const answer = matchFaq('How do I start a PTP?')
    expect(answer).toContain('Pre-Task Plans')
  })

  it('matches incident/injury patterns', () => {
    expect(matchFaq('I need to report an injury')).toContain('Incident Report')
    expect(matchFaq('there was an accident')).toContain('Incident Report')
    expect(matchFaq('near miss happened')).toContain('Incident Report')
  })

  it('matches height permit patterns', () => {
    expect(matchFaq('Do I need a harness?')).toContain('Work-at-Height Permit')
    expect(matchFaq('working at height today')).toContain('Work-at-Height Permit')
  })

  it('matches hot work patterns', () => {
    expect(matchFaq('I need to weld')).toContain('Hot Work Permit')
    expect(matchFaq('fire watch requirements')).toContain('Hot Work Permit')
  })

  it('matches confined space patterns', () => {
    expect(matchFaq('confined space entry')).toContain('Confined Space')
    expect(matchFaq('who is the attendant?')).toContain('Confined Space')
  })

  it('matches LOTO patterns', () => {
    expect(matchFaq('lockout tagout procedure')).toContain('LOTO')
    expect(matchFaq('how to do loto')).toContain('LOTO')
  })

  it('matches PPE patterns', () => {
    expect(matchFaq('what ppe do I need?')).toContain('PPE requirements')
    expect(matchFaq('do I need gloves?')).toContain('PPE requirements')
  })

  it('matches emergency patterns', () => {
    expect(matchFaq('where is the muster point?')).toContain('emergency')
    expect(matchFaq('fire in the building')).toContain('emergency')
  })

  it('matches stop work authority patterns', () => {
    expect(matchFaq('can I refuse unsafe work?')).toContain('right to stop work')
    expect(matchFaq('this feels dangerous')).toContain('right to stop work')
  })

  it('matches fatigue patterns', () => {
    expect(matchFaq('I am tired')).toContain('Fatigue')
    expect(matchFaq('overtime hours')).toContain('Fatigue')
  })

  it('matches training patterns', () => {
    expect(matchFaq('am I certified for this?')).toContain('training status')
  })

  it('matches work order patterns', () => {
    expect(matchFaq('preventive maintenance schedule')).toContain('Work Orders')
  })

  it('is case-insensitive', () => {
    expect(matchFaq('PPE REQUIREMENTS')).toContain('PPE')
    expect(matchFaq('LOCKOUT TAGOUT')).toContain('LOTO')
  })

  it('returns null for unrecognized queries', () => {
    expect(matchFaq('what is the meaning of life?')).toBeNull()
    expect(matchFaq('')).toBeNull()
  })

  it('returns first matching FAQ when multiple match', () => {
    const answer = matchFaq('How do I start a PTP for a height permit?')
    expect(answer).toContain('Pre-Task Plans')
  })
})
