/**
 * record-demo.mjs — auto-record a 30-second Sage EHS feature demo.
 *
 * Drives the app through a scripted 6-beat storyboard and records video in BOTH
 * portrait (1080×1920) and landscape (1920×1080). Deterministic and repeatable —
 * re-run after any UI change to regenerate a clean clip.
 *
 * ── Prerequisites ────────────────────────────────────────────────────────────
 *   1. npm i -D playwright            # the core library (not @playwright/test)
 *   2. npx playwright install chromium
 *   3. Run the app locally with the passwordless dev sign-in enabled:
 *
 *        ALLOW_DEV_LOGIN=1 NEXT_PUBLIC_SDS_MODULE=1 npm run dev
 *
 *      To also capture the AI "Ask Sage" beat, add:
 *        NEXT_PUBLIC_AI_ASSIST=1 ANTHROPIC_API_KEY=sk-ant-...   (the beat is
 *      skipped gracefully if Sage isn't enabled).
 *
 * ── Run ──────────────────────────────────────────────────────────────────────
 *      node scripts/demo/record-demo.mjs
 *      DEMO_BASE_URL=https://your-preview.vercel.app node scripts/demo/record-demo.mjs
 *
 *   Videos land in scripts/demo/out/portrait.webm and out/landscape.webm.
 *
 * ── Convert to mp4 (for editing / social) ────────────────────────────────────
 *      ffmpeg -i scripts/demo/out/portrait.webm  -vf "scale=1080:1920" -r 30 portrait.mp4
 *      ffmpeg -i scripts/demo/out/landscape.webm -vf "scale=1920:1080" -r 30 landscape.mp4
 */

import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync, renameSync, existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, 'out')
const BASE_URL = process.env.DEMO_BASE_URL || 'http://localhost:3000'

// Pacing — generous dwells so the clip is watchable. Tune to hit ~30s total.
const BEAT = 2200          // dwell on a feature
const SHORT = 900          // small transition pause
const TYPE_DELAY = 70      // per-keystroke, so typing reads naturally on camera

const ORIENTATIONS = [
  { name: 'portrait', viewport: { width: 540, height: 960 }, video: { width: 1080, height: 1920 } },
  { name: 'landscape', viewport: { width: 1280, height: 720 }, video: { width: 1920, height: 1080 } },
]

/** Run a beat but never let a missing element abort the whole recording. */
async function safe(label, fn) {
  try {
    await fn()
  } catch (e) {
    console.warn(`  ⚠︎ beat "${label}" skipped: ${e.message.split('\n')[0]}`)
  }
}

async function recordOrientation({ name, viewport, video }) {
  console.log(`\n▶ Recording ${name} (${video.width}×${video.height})…`)
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    isMobile: name === 'portrait',
    hasTouch: name === 'portrait',
    recordVideo: { dir: OUT_DIR, size: video },
    reducedMotion: 'no-preference',
  })
  const page = await context.newPage()
  page.setDefaultTimeout(8000)

  // ── Beat 0 — Sign in (passwordless dev login) ──────────────────────────────
  await safe('login', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    // AuthGate redirects unauthenticated users to /safety with the sign-in form.
    const nameInput = page.getByPlaceholder('Your name')
    await nameInput.waitFor({ timeout: 12000 })
    await nameInput.fill('Mark Starr')
    await page.getByPlaceholder('Your company email').fill('demo@mytra.ai')
    await page.waitForTimeout(SHORT)
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(BEAT)
  })

  // ── Beat 1 — Home / dashboard ──────────────────────────────────────────────
  await safe('home', async () => {
    await page.goto(`${BASE_URL}/safety`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(BEAT)
  })

  // ── Beat 2 — Pocket SDS: library → filter → detail ─────────────────────────
  await safe('sds-library', async () => {
    await page.goto(`${BASE_URL}/sds`, { waitUntil: 'networkidle' })
    // First visit seeds the 78-chemical library from /sds/seed.json (async).
    await page.locator('a[href^="/sds/"]').first().waitFor({ timeout: 12000 })
    await page.waitForTimeout(BEAT)
    // Filter by a GHS hazard class (chip label, e.g. "Flammable (n)").
    await safe('sds-filter', async () => {
      await page.getByRole('button', { name: /flammable/i }).first().click()
      await page.waitForTimeout(BEAT)
      await page.getByRole('button', { name: /flammable/i }).first().click() // clear
      await page.waitForTimeout(SHORT)
    })
    // Open the first chemical's detail page.
    await page.locator('a[href^="/sds/"]').first().click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(BEAT)
    // Slow scroll to reveal pictograms → hazards → PPE → sections.
    for (const y of [300, 650, 1000]) {
      await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'smooth' }), y)
      await page.waitForTimeout(SHORT)
    }
    await page.waitForTimeout(SHORT)
  })

  // ── Beat 3 — Ask Sage (AI assistant) — skipped if not enabled ──────────────
  await safe('sage', async () => {
    await page.goto(`${BASE_URL}/safety`, { waitUntil: 'networkidle' })
    const fab = page.getByRole('button', { name: /open safety assistant/i })
    await fab.waitFor({ timeout: 4000 })
    await fab.click()
    await page.waitForTimeout(SHORT)
    const box = page.locator('dialog textarea, dialog input[type="text"]').first()
    await box.waitFor({ timeout: 4000 })
    await box.click()
    await box.type('What PPE do I need for muriatic acid?', { delay: TYPE_DELAY })
    await page.waitForTimeout(SHORT)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(BEAT * 2) // let the answer stream in
    await page.getByRole('button', { name: /^close$/i }).first().click().catch(() => {})
  })

  // ── Beat 4 — Report anything (incident / near-miss) ────────────────────────
  await safe('incident', async () => {
    await page.goto(`${BASE_URL}/safety/incident`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /^near-miss$/i }).click()
    await page.waitForTimeout(SHORT)
    await page.getByRole('button', { name: /^moderate$/i }).click()
    await page.waitForTimeout(BEAT) // dwell on the "report everything" message
    await page.locator('#ir-location').fill('Aisle 12 — pick station')
    await page.locator('#ir-what').fill('Pallet shifted on the AS/RS shuttle; no contact, area cleared and flagged.')
    await page.waitForTimeout(BEAT)
  })

  // ── Beat 5 — Outro ─────────────────────────────────────────────────────────
  await safe('outro', async () => {
    await page.goto(`${BASE_URL}/safety`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(BEAT)
  })

  // Grab the video handle BEFORE closing (page is gone after close()).
  const videoHandle = page.video()
  // Finalize: video is flushed to disk on context.close().
  await context.close()
  await browser.close()

  // Rename the hashed video file to a stable name.
  const produced = videoHandle ? await videoHandle.path().catch(() => null) : null
  const target = join(OUT_DIR, `${name}.webm`)
  if (produced && existsSync(produced)) {
    renameSync(produced, target)
    console.log(`  ✓ ${target}`)
  } else {
    console.log(`  ✓ video written to ${OUT_DIR} (${name})`)
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  console.log(`Recording Sage EHS demo against ${BASE_URL}`)
  for (const o of ORIENTATIONS) {
    await recordOrientation(o)
  }
  console.log('\nDone. See scripts/demo/out/ for portrait.webm and landscape.webm.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
