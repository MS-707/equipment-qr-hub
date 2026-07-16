import { describe, it, expect, vi, afterEach } from 'vitest'

/**
 * ES-1: hardened i18n core — every June failure mode gets a regression pin:
 * first-match-only interpolation, '(s)' plural hacks, silent key misses,
 * storage-key reuse. getT() is the non-hook translator the provider wraps,
 * so the fallback/interpolation/plural chains are testable without React.
 */

import { getT, LOCALE_STORAGE_KEY, FLAG_STORAGE_KEY, type I18nFlags } from '@/lib/i18n-core'
import type { MessageKey } from '@/lib/i18n-keys'

const flags = (over: Partial<I18nFlags> = {}): I18nFlags => ({
  esEnabled: true,
  suppressedNamespaces: [],
  ...over,
})

// Casts for deliberately-invalid keys — the union type would (correctly)
// reject them at compile time, which is itself ES-1 behavior.
const missing = 'nope.not.a.key' as MessageKey

afterEach(() => vi.restoreAllMocks())

describe('storage-key versioning (June rollback residue)', () => {
  it("uses sage-locale-v2 — v1 'sage-locale' is purged by legacy cleanup and must never return", () => {
    expect(LOCALE_STORAGE_KEY).toBe('sage-locale-v2')
    expect(FLAG_STORAGE_KEY).toBe('sage-i18n-flag-v1')
  })
})

describe('resolve + fallback chain (locale → en → defaultEn → key)', () => {
  it('resolves a nested key from the en catalog', () => {
    expect(getT('en')('nav.home')).toBe('Home')
  })

  it('falls back to the key itself when nothing matches', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(getT('en')(missing)).toBe('nope.not.a.key')
  })

  it('prefers the defaultEn overload over the raw key (keeps LG-6/LG-8 literals inline)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(getT('en')(missing, undefined, 'By signing below')).toBe('By signing below')
  })

  it('warns in dev on a missing key (silent key misses sank the June attempt)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    getT('en')(missing)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('missing key'))
  })
})

describe('kill switch + namespace suppression', () => {
  it('esEnabled:false forces English regardless of chosen locale', () => {
    const t = getT('es', flags({ esEnabled: false }))
    expect(t('nav.home')).toBe('Home')
  })

  it('a suppressed namespace serves English while others stay on locale', () => {
    const t = getT('es', flags({ suppressedNamespaces: ['nav'] }))
    expect(t('nav.home')).toBe('Home')
  })
})

describe('interpolation (split/join — all occurrences, no regex escaping)', () => {
  it('replaces every occurrence of a variable, not just the first', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const t = getT('en')
    expect(t(missing, { n: 3 }, '{n} of {n} done')).toBe('3 of 3 done')
  })

  it('is immune to regex-special characters in values ($&, $1, backslash)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const t = getT('en')
    expect(t(missing, { name: 'a$&b\\1' }, 'Hi {name}')).toBe('Hi a$&b\\1')
  })

  it('interpolates real catalog strings', () => {
    expect(getT('en')('common.mAgo', { n: 7 })).toBe('7m ago')
  })

  it('warns in dev when a {var} survives interpolation', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    getT('en')('common.mAgo', { wrong: 1 })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unreplaced variable'))
  })
})

describe("plurals via Intl.PluralRules (kills the '(s)' hack)", () => {
  it('selects .one for count 1 in English', () => {
    expect(getT('en')('sync.recordsSynced', { count: 1 })).toBe('1 record synced')
  })

  it('selects .other for count 0 and many in English', () => {
    const t = getT('en')
    expect(t('sync.recordsSynced', { count: 0 })).toBe('0 records synced')
    expect(t('sync.recordsSynced', { count: 12 })).toBe('12 records synced')
  })

  it('selects variants for the safety-critical EHS revision banner', () => {
    const t = getT('en')
    expect(t('dashboard.needsRevision', { count: 1 })).toBe('1 record needs revision — returned by EHS')
    expect(t('dashboard.needsRevision', { count: 3 })).toBe('3 records need revision — returned by EHS')
  })

  it('uses the locale plural rules when Spanish is active', () => {
    // es values are English fallbacks until ES-M2 lands translations; the
    // selection machinery (PluralRules('es')) is what this pins.
    const t = getT('es')
    expect(t('sync.recordsSynced', { count: 1 })).toBe('1 record synced')
    expect(t('sync.recordsSynced', { count: 2 })).toBe('2 records synced')
  })

  it('non-plural keys ignore a count var gracefully', () => {
    expect(getT('en')('nav.home', { count: 5 })).toBe('Home')
  })
})
