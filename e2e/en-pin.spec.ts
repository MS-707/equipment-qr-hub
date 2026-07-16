import { test, expect } from '@playwright/test'
import { signInAsWorker } from './helpers'

/**
 * ES-M2-T5 (en side): a default device — no stored locale — must render the
 * canonical English strings on converted surfaces, byte-identical to the
 * pre-i18n app. This pins DM-10's demo assertions (and every English-reading
 * crew's UI) against locale-state regressions: no seeded key, no Spanish.
 */

test.describe('English pin (default devices)', () => {
  test('sign-in screen renders canonical English', async ({ page }) => {
    await page.goto('/safety')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByLabel(/full name/i)).toBeVisible()
    await expect(page.getByLabel(/company email/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible()
    await expect(page.getByText('By signing in you agree to our')).toBeVisible()
  })

  test('signed-in dashboard renders canonical English section headings and actions', async ({ page }) => {
    await signInAsWorker(page)
    await page.goto('/')
    await expect(page.getByText('Quick actions')).toBeVisible()
    await expect(page.getByText('Recent activity')).toBeVisible()
    await expect(page.getByRole('link', { name: /job hazard analysis/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /report incident/i })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('explicitly-stored en behaves identically to no stored locale', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sage-locale-v2', 'en'))
    await page.goto('/equipment')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { name: /equipment/i }).first()).toBeVisible()
  })
})
