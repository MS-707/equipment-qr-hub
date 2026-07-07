import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveRole, isEhsOrAdmin } from '@/lib/roles'

// roles.ts reads EHS_EMAILS lazily per call, so stubEnv works without
// module-cache resets. ADMIN_EMAILS defaults to mark.starr@mytra.ai.

beforeEach(() => {
  vi.unstubAllEnvs()
})

describe('resolveRole', () => {
  it('defaults to worker for allowed-domain users on no allowlist', () => {
    expect(resolveRole('crew@mytra.ai')).toBe('worker')
  })

  it('resolves ehs from EHS_EMAILS', () => {
    vi.stubEnv('EHS_EMAILS', 'safety@mytra.ai, lead@mytra.ai')
    expect(resolveRole('safety@mytra.ai')).toBe('ehs')
    expect(resolveRole('lead@mytra.ai')).toBe('ehs')
  })

  it('admin wins over ehs (precedence)', () => {
    vi.stubEnv('EHS_EMAILS', 'mark.starr@mytra.ai')
    expect(resolveRole('mark.starr@mytra.ai')).toBe('admin')
  })

  it('is case- and whitespace-insensitive', () => {
    vi.stubEnv('EHS_EMAILS', 'Safety@Mytra.AI')
    expect(resolveRole('  SAFETY@mytra.ai ')).toBe('ehs')
  })

  it('null/undefined resolve to worker', () => {
    expect(resolveRole(null)).toBe('worker')
    expect(resolveRole(undefined)).toBe('worker')
  })
})

describe('isEhsOrAdmin', () => {
  it('true for admin and ehs, false for worker', () => {
    vi.stubEnv('EHS_EMAILS', 'safety@mytra.ai')
    expect(isEhsOrAdmin('mark.starr@mytra.ai')).toBe(true)
    expect(isEhsOrAdmin('safety@mytra.ai')).toBe(true)
    expect(isEhsOrAdmin('crew@mytra.ai')).toBe(false)
  })
})
