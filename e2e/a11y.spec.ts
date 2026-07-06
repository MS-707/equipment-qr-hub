import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { signInAsWorker } from './helpers'

/**
 * UX-10(a): axe-core scans asserting zero serious/critical violations on the
 * daily field path. Gated routes sign in first; /equipment and /inspect/[id]
 * are public by design (QR deep links).
 */

async function expectNoSeriousViolations(page: import('@playwright/test').Page) {
  // Next streams the <head>; make sure the title landed before scanning
  // (otherwise axe flakes on document-title during hydration). One reload
  // tolerated — harness flake, not app behavior (SSR always emits the title).
  try {
    await expect(page).toHaveTitle(/.+/, { timeout: 10_000 })
  } catch {
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page).toHaveTitle(/.+/)
  }
  // The Serwist SW can take control and trigger one navigation shortly
  // after first load — let it settle, and tolerate a single mid-scan
  // navigation by retrying once.
  await page
    .waitForFunction(() => !navigator.serviceWorker || !!navigator.serviceWorker.controller, undefined, { timeout: 8_000 })
    .catch(() => {})
  await page.waitForLoadState('networkidle')
  let results
  try {
    results = await new AxeBuilder({ page }).analyze()
  } catch {
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    results = await new AxeBuilder({ page }).analyze()
  }
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  )
  expect(
    serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} nodes — ${v.helpUrl}`)
  ).toEqual([])
}

test('/ (dashboard) has no serious/critical a11y violations', async ({ page }) => {
  await signInAsWorker(page)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expectNoSeriousViolations(page)
})

test('/equipment has no serious/critical a11y violations', async ({ page }) => {
  await page.goto('/equipment')
  await page.waitForLoadState('networkidle')
  await expectNoSeriousViolations(page)
})

test('/safety/ptp has no serious/critical a11y violations', async ({ page }) => {
  await signInAsWorker(page)
  await page.goto('/safety/ptp')
  await page.waitForLoadState('networkidle')
  await expectNoSeriousViolations(page)
})

test('/inspect/24 has no serious/critical a11y violations', async ({ page }) => {
  await page.goto('/inspect/24')
  await page.waitForLoadState('networkidle')
  await expectNoSeriousViolations(page)
})
