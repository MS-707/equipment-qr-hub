import { test, expect } from '@playwright/test'
import { signInAsWorker } from './helpers'

/**
 * ES-M1 dark-phase smoke (user stories, prod build):
 * the i18n infrastructure is live but INVISIBLE — every user sees byte-
 * identical English, html[lang] behaves, and no toggle exists anywhere.
 * The seeded-locale story proves the pre-paint stamp works for the day the
 * toggle ships, without exposing anything today.
 */

test.describe('i18n dark infra', () => {
  test('a fresh device gets pure English with html[lang=en] and no language UI', async ({ page }) => {
    await page.goto('/equipment')
    await expect(page.locator('main#main')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    // No exposure: the toggle string exists nowhere in the rendered page.
    await expect(page.getByText(/Español/)).toHaveCount(0)
    // Sentinel copy still English.
    await expect(page.getByRole('heading', { name: /equipment/i }).first()).toBeVisible()
  })

  test('a device that already chose es gets the pre-paint lang stamp with NO toggle exposed', async ({ page }) => {
    // Converted surfaces now legitimately render Spanish for a seeded es
    // preference (es-leakage.spec owns those assertions); what stays dark
    // until ES-M6 is the EXPOSURE: no language toggle exists anywhere, and
    // the pre-paint stamp must land before DOMContentLoaded (no flash).
    await page.addInitScript(() => localStorage.setItem('sage-locale-v2', 'es'))
    await page.goto('/equipment', { waitUntil: 'domcontentloaded' })
    const preHydration = await page.locator('html').getAttribute('lang')
    expect(preHydration, 'pre-paint lang stamp must land before DOMContentLoaded').toBe('es')
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    await expect(page.locator('main#main')).toBeVisible()
    await expect(page.getByText(/Español/)).toHaveCount(0)
  })

  test('a worker signs in and works a normal English shift (lang=en end to end)', async ({ page }) => {
    await signInAsWorker(page)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByText(/Español/)).toHaveCount(0)
  })

  test('the kill switch endpoint serves its contract and is never cacheable', async ({ request }) => {
    const res = await request.get('/api/i18n/status')
    expect(res.status()).toBe(200)
    expect(res.headers()['cache-control']).toBe('no-store')
    const body = await res.json()
    expect(body).toEqual({ esEnabled: true, suppressedNamespaces: [] })
  })
})
