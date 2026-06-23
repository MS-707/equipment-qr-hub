import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toLocalInput, toIso, localToday, defaultValidityWindow } from '../datetime'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-23T15:30:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('toLocalInput', () => {
  it('formats a Date as datetime-local value', () => {
    const d = new Date('2026-06-23T15:30:00.000Z')
    const result = toLocalInput(d)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it('pads single-digit months and days', () => {
    const d = new Date(2026, 0, 5, 9, 3)
    const result = toLocalInput(d)
    expect(result).toContain('-01-05T09:03')
  })
})

describe('toIso', () => {
  it('converts datetime-local string to ISO', () => {
    const result = toIso('2026-06-23T15:30')
    expect(result).toContain('2026-06-23')
    expect(result).toContain('T')
  })

  it('falls back to now for unparseable input', () => {
    const result = toIso('not-a-date')
    expect(result).toBe(new Date().toISOString())
  })

  it('falls back to now for empty string', () => {
    const result = toIso('')
    expect(result).toBe(new Date().toISOString())
  })
})

describe('localToday', () => {
  it('returns YYYY-MM-DD format', () => {
    const result = localToday()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('defaultValidityWindow', () => {
  it('returns from/until with default 8 hour span', () => {
    const { from, until } = defaultValidityWindow()
    expect(from).toBeDefined()
    expect(until).toBeDefined()
    const fromDate = new Date(from)
    const untilDate = new Date(until)
    const diffMs = untilDate.getTime() - fromDate.getTime()
    const diffHours = diffMs / (60 * 60 * 1000)
    expect(diffHours).toBe(8)
  })

  it('supports custom hour span', () => {
    const { from, until } = defaultValidityWindow(4)
    const fromDate = new Date(from)
    const untilDate = new Date(until)
    const diffHours = (untilDate.getTime() - fromDate.getTime()) / (60 * 60 * 1000)
    expect(diffHours).toBe(4)
  })
})
