import { describe, it, expect } from 'vitest'
import { stripRegCitations } from '../strip-citations'

describe('stripRegCitations', () => {
  it('removes OSHA references', () => {
    expect(stripRegCitations('Guards required per OSHA 1910.212')).toBe('Guards required')
  })

  it('removes Cal/OSHA references', () => {
    expect(stripRegCitations('Inspect per Cal/OSHA T8 CCR 3314')).toBe('Inspect')
  })

  it('removes CFR references', () => {
    expect(stripRegCitations('Fall protection required per 29 CFR 1926.502')).toBe('Fall protection required')
  })

  it('removes section symbols with numbers', () => {
    expect(stripRegCitations('See § 3395 for water and shade')).toBe('See for water and shade')
  })

  it('removes NFPA references', () => {
    expect(stripRegCitations('Per NFPA 51 requirements')).toBe('Per requirements')
  })

  it('removes ANSI references', () => {
    const result = stripRegCitations('Install per ANSI 10.48 requirements')
    expect(result).not.toContain('ANSI')
    expect(result).not.toContain('10.48')
  })

  it('cleans up empty parentheses', () => {
    expect(stripRegCitations('Guards (OSHA 1910.212) required')).toBe('Guards required')
  })

  it('collapses multiple spaces', () => {
    expect(stripRegCitations('Check   the   guards')).toBe('Check the guards')
  })

  it('preserves practical safety content', () => {
    const input = 'Ensure all workers wear hard hats and safety glasses'
    expect(stripRegCitations(input)).toBe(input)
  })

  it('handles empty string', () => {
    expect(stripRegCitations('')).toBe('')
  })

  it('handles text with no citations', () => {
    const input = 'Check hydraulic fluid levels daily'
    expect(stripRegCitations(input)).toBe(input)
  })

  it('handles mixed citations in one string', () => {
    const input = 'Guards (per OSHA 1910.212) and lockout (29 CFR 1910.147) required'
    const result = stripRegCitations(input)
    expect(result).not.toContain('OSHA')
    expect(result).not.toContain('CFR')
    expect(result).toContain('Guards')
    expect(result).toContain('required')
  })
})
