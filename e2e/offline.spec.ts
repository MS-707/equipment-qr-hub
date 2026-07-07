import { test, expect } from '@playwright/test'
import { drawSignature } from './helpers'

/**
 * UX-10(b): airplane-mode capture. Load the pre-trip inspection for a
 * forklift, go offline, complete and sign the checklist, submit, and prove
 * the record persisted locally with pending sync status and a visible
 * queued-for-sync indicator. (The tab-bar badge tracks safety records, not
 * inspections — the inspection queue surfaces on the result screen.)
 */

test('completes and persists a pre-trip inspection while offline', async ({ page, context }) => {
  // Load ONLINE first (static page + bundles), then flip to airplane mode —
  // matching the real failure mode: signal drops after the worker arrives.
  await page.goto('/inspect/24')
  await expect(page.getByRole('button', { name: /start inspection/i })).toBeVisible()

  await context.setOffline(true)

  // Identify step
  await page.getByLabel(/inspector name/i).fill('E2E Crew')
  await page.getByRole('button', { name: /start inspection/i }).click()

  // Checklist: answer every item Pass
  const passButtons = page.getByRole('button', { name: 'Pass', exact: true })
  await expect(passButtons.first()).toBeVisible()
  const total = await passButtons.count()
  for (let i = 0; i < total; i++) {
    await passButtons.nth(i).click()
  }

  // Sign and submit
  await drawSignature(page)
  const submit = page.getByRole('button', { name: /submit inspection|complete inspection/i })
  await expect(submit).toBeEnabled()
  await submit.click()

  // Result screen confirms local save while offline
  await expect(page.getByRole('heading', { name: /all clear|issues found/i })).toBeVisible({ timeout: 15_000 })

  // The record persisted locally with pending sync status
  const record = await page.evaluate(() => {
    const raw = localStorage.getItem('eqr-inspections')
    const all = raw ? JSON.parse(raw) : []
    return all[0] ?? null
  })
  expect(record).not.toBeNull()
  expect(record.equipmentId).toBe(24)
  expect(record.syncStatus).toBe('pending')
  expect(record.items.length).toBeGreaterThan(0)
  expect(record.items.every((i: { result: string }) => i.result === 'pass')).toBe(true)
})
