import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createReviewToken, verifyReviewToken } from '../review-token'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-23T12:00:00.000Z'))
  vi.stubEnv('NEXTAUTH_SECRET', 'test-secret-for-review-tokens')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('createReviewToken', () => {
  it('creates a base64url token', () => {
    const token = createReviewToken('PTP-2026-0001', 'approve')
    expect(token).toBeTruthy()
    expect(token).not.toContain('+')
    expect(token).not.toContain('/')
  })

  it('creates different tokens for approve vs reject', () => {
    const approve = createReviewToken('PTP-2026-0001', 'approve')
    const reject = createReviewToken('PTP-2026-0001', 'reject')
    expect(approve).not.toBe(reject)
  })
})

describe('verifyReviewToken', () => {
  it('verifies a valid approve token', () => {
    const token = createReviewToken('PTP-2026-0001', 'approve')
    const result = verifyReviewToken(token)
    expect(result).not.toBeNull()
    expect(result!.recordId).toBe('PTP-2026-0001')
    expect(result!.action).toBe('approve')
  })

  it('verifies a valid reject token', () => {
    const token = createReviewToken('PTP-2026-0001', 'reject')
    const result = verifyReviewToken(token)
    expect(result).not.toBeNull()
    expect(result!.action).toBe('reject')
  })

  it('rejects token after 24 hours', () => {
    const token = createReviewToken('PTP-2026-0001', 'approve')
    vi.advanceTimersByTime(25 * 60 * 60 * 1000)
    expect(verifyReviewToken(token)).toBeNull()
  })

  it('accepts token just before 24 hours', () => {
    const token = createReviewToken('PTP-2026-0001', 'approve')
    vi.advanceTimersByTime(23 * 60 * 60 * 1000)
    expect(verifyReviewToken(token)).not.toBeNull()
  })

  it('rejects tampered token', () => {
    const token = createReviewToken('PTP-2026-0001', 'approve')
    const tampered = token.slice(0, -4) + 'XXXX'
    expect(verifyReviewToken(tampered)).toBeNull()
  })

  it('rejects garbage input', () => {
    expect(verifyReviewToken('not-a-token')).toBeNull()
    expect(verifyReviewToken('')).toBeNull()
  })

  it('rejects token with invalid action', () => {
    const decoded = Buffer.from('PTP-001:delete:12345:fakesig').toString('base64url')
    expect(verifyReviewToken(decoded)).toBeNull()
  })

  it('rejects token signed with wrong secret', () => {
    const token = createReviewToken('PTP-2026-0001', 'approve')
    vi.stubEnv('NEXTAUTH_SECRET', 'different-secret')
    expect(verifyReviewToken(token)).toBeNull()
  })
})

describe('missing secret', () => {
  it('throws when no secret is configured', () => {
    vi.stubEnv('NEXTAUTH_SECRET', '')
    delete process.env.REVIEW_TOKEN_SECRET
    expect(() => createReviewToken('PTP-001', 'approve')).toThrow('refusing to sign')
  })
})
