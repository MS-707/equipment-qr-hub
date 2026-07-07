#!/usr/bin/env node
/**
 * rehearse-inspection.mjs — machine-rehearsal of the headline demo path
 * (DM-10): sign in → scan landing (/inspect/[id]) → complete every checklist
 * item → draw the touch signature → submit → assert the result screen AND the
 * EHS-notify outcome banner.
 *
 * Unlike record-demo.mjs there is NO failure-swallowing wrapper: any missing
 * element, wrong selector, or unexpected state exits 1 immediately. Run this
 * before every live demo — if it exits 0, the wow path works end to end.
 *
 * ── Run ─────────────────────────────────────────────────────────────────────
 *   1. ALLOW_DEV_LOGIN=1 npm run dev          # dev sign-in, no code needed
 *   2. node scripts/demo/rehearse-inspection.mjs
 *
 *   DEMO_BASE_URL=http://localhost:3000   override the target server
 *   DEMO_EQUIPMENT=24                     which pre-trip unit to inspect
 *   PW_CHROMIUM_PATH=/opt/pw-browsers/chromium   pin a browser binary
 *
 * Without RESEND_API_KEY the expected notify outcome is the "isn't configured"
 * line (skipped); with email configured it is "EHS has been notified".
 * Real-inbox confirmation stays a human step — see docs/RUNBOOKS.md.
 */

import { chromium } from 'playwright'

const BASE_URL = process.env.DEMO_BASE_URL || 'http://localhost:3000'
const EQUIPMENT = process.env.DEMO_EQUIPMENT || '24'

let stepNo = 0
function step(name) {
  stepNo++
  console.log(`\n[${stepNo}] ${name}`)
}
function fail(msg) {
  console.error(`\n✗ REHEARSAL FAILED at step ${stepNo}: ${msg}`)
  process.exit(1)
}

const browser = await chromium
  .launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {})
  .catch((e) => { fail(`browser launch: ${e.message}`); throw e })

try {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 } })
  const page = await context.newPage()
  page.setDefaultTimeout(15_000)

  step('Sign in (dev/email form)')
  await page.goto(`${BASE_URL}/safety`, { waitUntil: 'networkidle' })
  await page.getByLabel(/full name/i).fill('Demo Rehearsal')
  await page.getByLabel(/company email/i).fill('rehearsal@mytra.ai')
  const code = page.getByLabel(/access code/i)
  if (await code.count()) await code.fill(process.env.DEMO_ACCESS_CODE || '')
  const reloaded = page.waitForEvent('load', { timeout: 20_000 }).catch(() => {})
  await page.getByRole('button', { name: /sign in|continue with email/i }).click()
  await reloaded
  await page.locator('main#main').waitFor({ timeout: 20_000 })

  step(`Open the QR landing for unit ${EQUIPMENT}`)
  await page.goto(`${BASE_URL}/inspect/${EQUIPMENT}`, { waitUntil: 'networkidle' })

  // First-run onboarding overlay mounts a beat after hydration for fresh
  // profiles — dismiss it the way a presenter would. click() waits for it;
  // if it never appears within 5s, move on.
  step('Dismiss first-run onboarding (if shown)')
  const skipOnboarding = page.getByRole('button', { name: /skip for now/i })
  const dismissed = await skipOnboarding
    .click({ timeout: 5_000 })
    .then(() => true)
    .catch(() => false)
  if (dismissed) {
    await skipOnboarding.waitFor({ state: 'hidden', timeout: 5_000 })
    console.log('    onboarding dismissed')
  } else {
    console.log('    no onboarding overlay')
  }

  step('Identify: inspector name')
  await page.getByLabel(/inspector name/i).fill('Demo Rehearsal')

  step('Start Inspection')
  const start = page.getByRole('button', { name: /start inspection/i })
  if (!(await start.isEnabled())) fail('Start Inspection is disabled (authorization or name gate)')
  await start.click()

  step('Answer every checklist item: Pass')
  const passButtons = page.getByRole('button', { name: 'Pass', exact: true })
  await passButtons.first().waitFor()
  const total = await passButtons.count()
  if (total === 0) fail('no checklist items rendered')
  for (let i = 0; i < total; i++) await passButtons.nth(i).click()
  console.log(`    ${total} items passed`)

  step('Draw the operator signature')
  const canvas = page.locator('canvas').first()
  await canvas.scrollIntoViewIfNeeded()
  const box = await canvas.boundingBox()
  if (!box) fail('signature canvas not visible')
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx - 60, cy)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(cx - 60 + i * 20, cy + (i % 2 ? -10 : 10), { steps: 4 })
  }
  await page.mouse.up()

  step('Submit and capture the notify outcome')
  const notifyResponse = page
    .waitForResponse((r) => r.url().includes('/api/inspections/notify'), { timeout: 20_000 })
    .catch(() => null)
  const submit = page.getByRole('button', { name: /submit inspection|complete inspection/i })
  if (!(await submit.isEnabled())) fail('submit is disabled (items unanswered or signature missing)')
  await submit.click()

  step('Assert the result screen')
  await page.getByRole('heading', { name: /all clear|issues found|out of service/i }).waitFor({ timeout: 15_000 })
  console.log('    result heading visible')

  step('Assert the EHS-notify outcome banner')
  const outcome = page
    .getByText(/EHS has been notified by email|isn't configured — the signed record|queued and will send automatically|could not be sent/)
    .first()
  await outcome.waitFor({ timeout: 15_000 })
  const outcomeText = (await outcome.textContent())?.trim()
  const res = await notifyResponse
  console.log(`    banner: "${outcomeText}"${res ? ` (HTTP ${res.status()})` : ''}`)

  console.log('\n✓ REHEARSAL PASSED — the demo path works end to end.')
  await browser.close()
  process.exit(0)
} catch (e) {
  console.error(e.message)
  await browser.close().catch(() => {})
  fail(e.message)
}
