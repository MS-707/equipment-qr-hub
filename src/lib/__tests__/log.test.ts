import { describe, it, expect, vi } from 'vitest'
import { log } from '@/lib/log'

describe('log', () => {
  it('emits single-line parseable JSON with level and event', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    log('info', 'test-event', { route: 'api/x', outcome: 'ok' })
    expect(spy).toHaveBeenCalledTimes(1)
    const line = spy.mock.calls[0][0] as string
    expect(line).not.toContain('\n')
    const parsed = JSON.parse(line)
    expect(parsed.level).toBe('info')
    expect(parsed.event).toBe('test-event')
    expect(parsed.route).toBe('api/x')
    expect(parsed.outcome).toBe('ok')
    expect(typeof parsed.ts).toBe('string')
    spy.mockRestore()
  })

  it('routes error level to console.error and warn to console.warn', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    log('error', 'boom')
    log('warn', 'careful')
    expect(JSON.parse(err.mock.calls[0][0] as string).event).toBe('boom')
    expect(JSON.parse(warn.mock.calls[0][0] as string).event).toBe('careful')
    err.mockRestore(); warn.mockRestore()
  })

  it('does not leak fields that were not passed (no secrets by default)', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    log('info', 'bare')
    const parsed = JSON.parse(spy.mock.calls[0][0] as string)
    expect(Object.keys(parsed).sort()).toEqual(['event', 'level', 'ts'])
    spy.mockRestore()
  })
})
