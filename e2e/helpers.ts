import { Page, expect } from '@playwright/test'

/**
 * Sign in as a worker through the email-code form AuthGate renders in
 * production builds (ALLOW_EMAIL_LOGIN=1 + EMAIL_LOGIN_CODE, worker-role
 * addresses only — elevated roles are OAuth-only by design).
 */
export async function signInAsWorker(page: Page, name = 'E2E Crew', email = 'crew@mytra.ai') {
  await page.goto('/safety')
  // AuthGate's dev/email form
  await page.getByLabel(/full name/i).fill(name)
  await page.getByLabel(/company email/i).fill(email)
  const code = page.getByLabel(/access code/i)
  if (await code.count()) await code.fill('e2e-access-code')
  // Credentials sign-in sets the session then calls location.reload(). The
  // session broadcast can render the app BEFORE the reload lands, so wait for
  // the reload's load event too — otherwise it interrupts the caller's next
  // goto() mid-navigation.
  const reloaded = page.waitForEvent('load', { timeout: 20_000 }).catch(() => {})
  await page.getByRole('button', { name: /sign in|continue with email/i }).click()
  await reloaded
  await expect(page.locator('main#main')).toBeVisible({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')
}

/** Draw a short stroke on the signature canvas so sign-off unlocks. */
export async function drawSignature(page: Page) {
  const canvas = page.locator('canvas').first()
  await canvas.scrollIntoViewIfNeeded()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('signature canvas not visible')
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx - 60, cy)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(cx - 60 + i * 20, cy + (i % 2 ? -10 : 10), { steps: 4 })
  }
  await page.mouse.up()
}
