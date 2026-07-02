# MVP Polish — Overnight Run Report

**Run completed:** 2026-07-02 (overnight autonomous run)
**Branch:** `claude/construction-safety-audits-HC6MA` (feeds PR #25)
**Scope:** all 24 items from `docs/mvp-polish-queue.md`, sourced from a 5-agent
readiness audit (PWA, performance, mobile UX/a11y, data integrity, security)
**Final gate:** 686 tests across 69 files (up from 596 at run start — 90 new
tests), lint 0 errors, production build clean.

Every item below shipped as its own commit with the full gate
(build + lint + tests) passing. Detailed per-item outcome notes live inline in
`docs/mvp-polish-queue.md`; this is the executive summary.

---

## Phase A — Stop the bleeding (P0)

| # | What was broken | What shipped | Verified by |
|---|---|---|---|
| A1 | EHS notify route schema rejected **every** real inspection (string vs number `equipmentId`, non-nullable `workOrderId`) while the UI claimed "EHS has been notified" | Schema extracted to `lib/inspection-notify-schema.ts` and fixed; client tracks the real outcome (sent/queued/failed) and never claims undelivered notifications; root cause was a self-referential test fixture — replaced with real-payload round-trip tests | 9 round-trip tests building the exact client payload |
| A2 | Inspection writes swallowed quota errors → success screen for unsaved records; no backup, no corruption recovery, duplicate IDs on full devices | Full safety-records hardening pattern ported: backup-key write-first, quota rethrow, corruption restore, record-first submit ordering (zero half-state on failure), save-error UI | 10 store tests incl. quota-throw ordering |
| A3 | Zod validation silently **deleted** legal records on schema drift (filtered array written back to primary + backup) | Unreadable records quarantined (deduped, capped 50) instead of dropped; `AuditEvent.action` enum loosened; dismissible "set aside — nothing deleted" banner | 8 tests incl. the filtered write-back deletion vector |
| A4 | Permit closures/revocations/review outcomes never re-synced; the 90-day archiver deleted the only copy | All 6 mutations re-queue (`synced → pending`); sync route PATCHes existing Notion pages (append-only snapshots); belt-and-braces archiver guard for legacy data | 11 tests incl. archive-after-heal |
| A5 | A gloved diagonal swipe on the pre-trip tab called `router.back()` mid-inspection, dropping un-debounced answers | Swipe fully suspended during an active checklist (prop signal + `data-no-swipe` + tightened thresholds with a 400ms flick cap) | 7 swipe-classifier tests |
| A6 | "Out of Service" verdict was silent to screen readers, no focus, no haptic | `role="status"`, focus-on-heading, severity-matched haptics (PtpDone pattern) | Pattern parity + gate |
| A7 | Safety-critical guidance was 12px alpha-faded text (~2.4:1 in sunlight) | New `--*-strong` text tokens (5.6–12:1 computed contrast, both themes) at `text-sm` across all critical messaging incl. gas-reading verdicts | Contrast computed per token |

## Phase B — Security quick wins

| # | Shipped |
|---|---|
| B1 | `sanitizeSubject()` strips CR/LF/U+2028/29 at the email chokepoint; beta signup `role`/`crewSize` capped; both EHS emails stamp `Submitted by (verified): <session email>` server-side — forged inspector names are now distinguishable. 6 tests incl. a live header-injection payload. |
| B2 | Rate limits on `/api/safety/sync` (30/min — headroom for bulk reconnect flush) and `/api/safety/review/status` (30/min; each call fans out ≤20 Notion fetches); CSP gains `base-uri`/`form-action`, drops unused upstash connect-src. |

## Phase C — Data & sync correctness

| # | Shipped |
|---|---|
| C1 | `savePhotos` awaits the IndexedDB transaction (photos are the only copy of defect evidence); failure surfaces on the result screen; work-order and shop-management stores rethrow quota; `cryptoRandomId()` rule violation fixed. |
| C2 | All three stores mint collision-proof IDs (`INS-2026-0042-a3f2`) — two tabs can no longer merge onto one Notion page. Full Web-Locks serialization deliberately deferred (requires async store API through 6 forms) — flagged for daylight. |
| C3 | New `submitForReview()` helper: review banners driven by the **real** POST outcome (pending/submitted/failed-with-retry) across all 6 forms — offline/401/429/5xx no longer show "submitted". 9 tests. |
| C4 | Review pipeline closed: submit route dedups by record ID (no more duplicate pages from the sync race); email-link decisions PATCH the Notion page so device polling sees them; KV fallback by record id un-strands email/Slack-only deployments. 7 tests. |
| C5 | Offline EHS notify queue (capped, 3-attempt, poison-pill-safe, flushes on reconnect) with a "queued — will send" result state; **Export CSV** button on the inspections page (records were previously trapped in one browser). 7 tests. |

## Phase D — PWA / offline shell

| # | Shipped |
|---|---|
| D1 | Page caches: 30-day last-used expiry (24h default bricked weekend-offline crews) + 4s network timeout (flaky connections hung); `skipWaiting` removed — deploys wait for the update banner instead of force-reloading mid-inspection. Compiled SW verified. |
| D2 | `navigator.storage.persist()` requested once real records exist; sync queue panel stays visible during the 503 backoff with "retrying in N min" instead of vanishing. 5 tests. |

## Phase E — Field UX

| # | Shipped |
|---|---|
| E1 | 13 sub-44pt controls on the daily path brought to ≥44pt (Add Photo, photo-X, Shift selector, Sage chips, record actions, tour close, retry buttons…) + aria-labels; Pass/Fail/N/A bumped to `text-sm font-semibold`. Playwright-measured at 390px, zero overflow. |
| E2 | No sync status is color-only anymore: icon+text badges on history rows, sr-only text on quiet dots and the tab-bar counter. |
| E3 | StatusToggle is a real `<button>` (keyboard users can mark gear Out of Service); stepper jumps land visible; ConfirmDialog announces its question; UserMenu arrow-key nav; crew datalist wins over iOS autofill. |
| E4 | Tour overlays are real dialogs: `role="dialog" aria-modal`, per-step focus (announced with the crossfade), Tab trap, focus restored on Esc/finish. Verified in-browser. |
| ~~ | (Prior session, same branch: tour crossfade animation fix, Sage chip persistence.) |

## Phase F — Performance

| # | Shipped |
|---|---|
| F1 | Gated pages paint **optimistically** from the fresh cached identity instead of blocking on the session round-trip — removes one network RTT from every cold page open; `getProviders()` only fetched when unauthenticated. Verified via Playwright (content paints pre-resolution, reconciles correctly, no leak without cache). |
| F2 | Record-store reads cached on the raw string (dashboard was re-zod-validating everything 5×/load); copy-on-read; invalidated on write/cross-tab/clear. 3 tests. |
| F3 | Five tab panels lazy-loaded on the QR-scan landing route. Honest A/B: 182→180 kB first-load, 10.9→8.4 kB route JS — below the audit's estimate; kept for deferred parse. Verified in production. |
| F4 | Signature strokes draw incrementally (was O(points²) full-canvas replay per pointermove). 200-point synthetic stroke verified continuous in production. |
| F5 | Inspection draft flushes on `pagehide`/`visibilitychange` — locking the phone right after a tap no longer loses it. Verified: answer → background → reload restores. |

## Phase G — Install polish

| # | Shipped |
|---|---|
| G1 | 5 missing iOS splash profiles generated (iPhone 12-14/mini/XR/Pro Max, iPad Pro 12.9 — 11 profiles total); maskable 192 icon; portrait orientation lock removed for jobsite iPad mounts. |

---

## Deferred — needs your decision (unchanged from the queue)

1. **Shared email-login code can impersonate the admin** — excluding admin emails from the credentials provider could lock you out if Google isn't configured in prod. Decide: per-user codes, `ALLOW_EMAIL_LOGIN=0`, or accept for beta.
2. **KV must be connected in production** — rate limiting is a no-op without it (in-memory fallback resets per serverless instance). Check `/api/admin/health` shows `kv: connected` before debut.
3. **Full inspection cloud sync** (`syncToNotion` stub) — design decision: where do inspections live server-side? The C5 notify queue covers the alerting gap meanwhile.
4. **Sentry-enabled bundle size** — needs `NEXT_PUBLIC_SENTRY_DSN` set to measure (+25-40 kB gz expected); consider lazy `Sentry.init`.
5. **zod → zod/mini swap** (~15 kB gz off every page) — touches legal-record validation; daylight work.
6. **navigator.locks store serialization** (from C2) — full cross-tab write serialization requires converting the store API to async through all six forms.

## Notes for review

- Two schema/UX claims from the audit were verified false-positive-free before fixing; one audit estimate (F3 bundle savings) measured well below its projection and is documented honestly in the queue.
- The E1 sweep caught an A7 straggler (indentation dodged a replace) — worth a skim of `text-warn/80` usages elsewhere if you extend the token work.
- Browser verification used a session-mock harness (Playwright route fulfillment) since the sandbox has no OAuth; real-device smoke of sign-in, splash screens, and SW update flow is recommended before debut.
