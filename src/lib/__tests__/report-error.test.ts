import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

import { captureException } from '@sentry/nextjs'
import { reportServerError } from '@/lib/report-error'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('reportServerError', () => {
  it('captures the error to Sentry with a scope tag', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('kv down')
    reportServerError('api/beta/signup', err)
    expect(captureException).toHaveBeenCalledWith(err, { tags: { scope: 'api/beta/signup' } })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('logs non-Error values without throwing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => reportServerError('api/x', 'plain string')).not.toThrow()
    expect(captureException).toHaveBeenCalledWith('plain string', { tags: { scope: 'api/x' } })
    spy.mockRestore()
  })

  it('never throws even when Sentry capture itself throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(captureException).mockImplementation(() => { throw new Error('sentry exploded') })
    expect(() => reportServerError('api/x', new Error('original'))).not.toThrow()
    spy.mockRestore()
  })
})
