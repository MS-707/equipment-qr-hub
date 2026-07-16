import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * ES-2: source-level invariants that killed the June i18n attempt or that
 * i18n must never regress. These are deliberate greps over checked-in source
 * (not behavior) — each one pins a line whose silent change would only be
 * discovered in production.
 */

const sw = readFileSync('src/app/sw.ts', 'utf8')
const layout = readFileSync('src/app/layout.tsx', 'utf8')

describe('service worker lifecycle (538a30e panic hack, never again)', () => {
  it('sw.ts never re-enables auto skipWaiting — updates stay user-gated', () => {
    expect(sw).not.toMatch(/skipWaiting:\s*true/)
  })

  it('the i18n kill switch is NetworkOnly (never cache-served)', () => {
    expect(sw).toContain('url.pathname.startsWith("/api/i18n")')
  })
})

describe('locale storage migration (sage-locale purge residue)', () => {
  it("layout's inline script no longer purges the v1 key on every load", () => {
    expect(layout).not.toContain("removeItem('sage-locale')")
  })

  it('nothing ever purges the v2 key (breaking changes bump to v3 instead)', () => {
    expect(layout).not.toContain("removeItem('sage-locale-v2')")
  })

  it('the inline head script stamps html lang from sage-locale-v2 pre-paint', () => {
    expect(layout).toMatch(/localStorage\.getItem\('sage-locale-v2'\)/)
    expect(layout).toMatch(/document\.documentElement\.lang='es'/)
  })

  it('sage-theme pre-paint stamping survives byte-for-byte in behavior (DS-2)', () => {
    expect(layout).toMatch(/localStorage\.getItem\('sage-theme'\)/)
    expect(layout).toMatch(/document\.documentElement\.dataset\.theme=t/)
    expect(layout).toMatch(/prefers-color-scheme:dark/)
  })

  it('<html> carries suppressHydrationWarning for the pre-paint lang/theme stamps', () => {
    expect(layout).toMatch(/<html[^>]*suppressHydrationWarning/)
  })
})

describe('legal English literals stay inline (LG-6 / LG-8 rubric greps)', () => {
  it('LG-6: signature attestation literals remain in their components', () => {
    const crewSig = readFileSync('src/components/safety/CrewSignatureBlock.tsx', 'utf8')
    expect(crewSig).toContain('By signing below, you acknowledge this safety plan')
    const incident = readFileSync('src/components/safety/IncidentReportForm.tsx', 'utf8')
    expect(incident).toContain('By signing you certify this report is accurate')
  })

  it('LG-8: AI advisory disclaimers remain in their components', () => {
    const triage = readFileSync('src/components/SageTriage.tsx', 'utf8')
    expect(triage).toContain('not a substitute for a competent safety professional')
    const jha = readFileSync('src/components/safety/JhaForm.tsx', 'utf8')
    expect(jha).toMatch(/advisory and not a substitute for a competent safety assessment/)
  })
})

describe('QR deep links keep locale out of routes (UX-7 / DM-3)', () => {
  it('no nav href carries an /es or /en locale prefix', () => {
    const nav = readFileSync('src/lib/nav.ts', 'utf8')
    const hrefs = Array.from(nav.matchAll(/href:\s*'([^']+)'/g), (m) => m[1])
    expect(hrefs.length).toBeGreaterThan(0)
    const prefixed = hrefs.filter((h) => /^\/(es|en)(\/|$)/.test(h))
    expect(prefixed).toEqual([])
  })

  it('the locale provider never touches routing (pure device preference)', () => {
    const i18n = readFileSync('src/lib/i18n.tsx', 'utf8')
    expect(i18n).not.toMatch(/useRouter|usePathname|router\.push/)
  })
})

describe('dark-phase guarantee (ES-M1: infra ships, exposure does not)', () => {
  it('UserMenu has no language toggle yet (ES-10 ships it, not ES-M1)', () => {
    const userMenu = readFileSync('src/components/UserMenu.tsx', 'utf8')
    expect(userMenu).not.toMatch(/Español|setLocale/)
  })
})
