import { test, expect } from '@playwright/test'
import { signInAsWorker } from './helpers'
import es from '../src/messages/es.json'

/**
 * ES-M2-T5 (es side): a device with the stored es preference must see the
 * converted cluster-1 surfaces in Spanish — the ENGLISH forms of converted
 * strings are leakage failures. Assertions read the live es catalog, so the
 * spec follows the translations rather than pinning stale literals.
 * (Full-fleet sweep with sentinel-regex + allowlist arrives with ES-9.)
 *
 * Unconverted surfaces (equipment pages, date lines, onboarding) legitimately
 * stay English until their cluster — this spec asserts ONLY cluster-1 strings.
 */

const seedEs = { name: 'seed', script: () => localStorage.setItem('sage-locale-v2', 'es') }

// Deactivates itself the moment real translations land in es.json — until
// then the catalog mirrors English (pending-translation manifest) and there
// is nothing to leak-test.
const TRANSLATED = es.auth.fullName !== 'Full name'

test.describe('es leakage — cluster 1', () => {
  test.skip(!TRANSLATED, 'es catalog still mirrors English (pre-translation dark phase)')

  test('sign-in screen renders Spanish with zero converted-English leakage', async ({ page }) => {
    await page.addInitScript(seedEs.script)
    await page.goto('/safety')
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    // Spanish present (from the live catalog)…
    await expect(page.getByText(es.auth.intro)).toBeVisible()
    await expect(page.getByLabel(es.auth.fullName)).toBeVisible()
    await expect(page.getByLabel(es.auth.companyEmail)).toBeVisible()
    // …and the English forms of converted strings are gone.
    for (const leaked of ['Full name', 'Company email', 'Sign in with your company account', 'By signing in you agree']) {
      await expect(page.getByText(leaked)).toHaveCount(0)
    }
  })

  test('signed-in dashboard + nav render Spanish with zero converted-English leakage', async ({ page }) => {
    // Sign in under English defaults (the helper's selectors are English),
    // then flip the stored locale and reload — same as a worker whose device
    // already carries the preference.
    await signInAsWorker(page)
    await page.evaluate(() => localStorage.setItem('sage-locale-v2', 'es'))
    await page.goto('/')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    await expect(page.getByText(es.dashboard.quickActions)).toBeVisible()
    await expect(page.getByText(es.dashboard.recentActivity)).toBeVisible()
    await expect(page.getByRole('link', { name: es.dashboard.reportIncident })).toBeVisible()
    // Mobile tab bar labels come from nav.*.label
    await expect(page.getByText(es.nav.preTrip.label).first()).toBeVisible()
    for (const leaked of ['Quick actions', 'Recent activity', 'Report Incident', 'Job Hazard Analysis']) {
      await expect(page.getByText(leaked, { exact: true })).toHaveCount(0)
    }
  })

  test('404 page renders Spanish', async ({ page }) => {
    await page.addInitScript(seedEs.script)
    await page.goto('/this-route-does-not-exist')
    await expect(page.getByText(es.errors.notFoundTitle)).toBeVisible()
    await expect(page.getByText(es.common.backHome)).toBeVisible()
    await expect(page.getByText('Page not found')).toHaveCount(0)
  })

  test('kill switch off forces English despite a stored es preference (one KV write, no deploy)', async ({ page }) => {
    await page.addInitScript(seedEs.script)
    // Simulate the fleet-wide pull: the status endpoint says Spanish is off.
    await page.route('**/api/i18n/status', (route) =>
      route.fulfill({ json: { esEnabled: false, suppressedNamespaces: [] } })
    )
    await page.goto('/safety', { waitUntil: 'networkidle' })
    // effectiveLocale(es, {esEnabled:false}) === 'en' — provider must land on
    // English for lang AND copy, overriding the device preference.
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByLabel('Full name')).toBeVisible()
    await expect(page.getByText(es.auth.intro)).toHaveCount(0)
  })
})
