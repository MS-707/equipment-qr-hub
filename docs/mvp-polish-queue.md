# MVP Polish Queue — Overnight Autonomous Run

> **Source of truth for the overnight /loop.** Worked top-to-bottom on branch
> `claude/construction-safety-audits-HC6MA`. One item at a time: mark it
> `IN-PROGRESS`, implement to AAA quality under the listed profession's lens,
> pass the gate (`npm run build` + `npm run lint` + `npx vitest run`), mark it
> `DONE` with an outcome note, commit, push. If blocked, mark `DEFERRED` with a
> reason and move on. Never stub, never half-ship: an item is DONE only when a
> skeptical reviewer of that profession would sign off.
>
> Findings come from a 5-agent audit (PWA, performance, mobile UX/a11y, data
> integrity, security) run 2026-07-02. File:line refs verified by the auditors.

## Standing rules

- Push only to `origin/claude/construction-safety-audits-HC6MA` (retry 4x, exponential backoff). No PRs.
- `cryptoRandomId()` — never raw `crypto.randomUUID()`.
- Every fetch checks `res.ok` before `res.json()`.
- Don't tag security@mytra.ai anywhere. "Sign on" terminology (not "sign-off"). No machine-translated safety content.
- Match existing design tokens (`bg-mytra-*`, `text-fg-*`, `ok/warn/danger`) and code patterns. `safety-records.ts` is the reference implementation for storage hardening.
- Add or extend a test whenever an item touches data integrity or an API contract.

---

## Phase A — Stop the bleeding (P0)

### A1 — Fix EHS notify route schema (currently rejects EVERY inspection) — `DONE`
**Profession:** Backend/API engineer
**Files:** `src/app/api/inspections/notify/route.ts`, `src/components/PreTripInspection.tsx`
`equipmentId` is `z.string()` but records carry a number (`types.ts` — `equipment.itemNumber`); `workOrderId: z.string().optional()` rejects `null` (every passing inspection). Route 400s on essentially all real submissions while the UI claims "EHS has been notified."
**Accept:** schema accepts real record shape (number + nullable); client reads `res.ok` and the `emailed` field and shows a visible non-blocking "EHS notification could not be sent" state on failure; round-trip test that validates an actual `submitInspection`-shaped payload against the Zod schema.
**Outcome:** Schema extracted to `src/lib/inspection-notify-schema.ts` (route files can't export symbols) with `equipmentId: z.number()`, `workOrderId` nullable, notes cap raised 1000→2000 to match the client textarea. Client now tracks notify outcome (`pending/sent/skipped/failed`); result screen shows "EHS has been notified by email" only on confirmed send, a warn banner on failure, and the static critical-N/A copy no longer claims delivery ("flagged for EHS review"). Root cause of the shipped bug found in the old route test fixture: it used `equipmentId: 'EQ-001'`, validating the schema against itself instead of the real payload — fixture fixed, plus 9 new round-trip tests in `inspection-notify-schema.test.ts`. Gate: 605 tests pass, build + lint clean.

### A2 — Inspection store hardening (silent data loss with a green checkmark) — `DONE`
**Profession:** Data-reliability engineer
**Files:** `src/lib/inspections.ts`, `src/components/PreTripInspection.tsx`
`writeAll` swallows quota errors → `submitInspection` returns success and UI shows the result screen for a record that was never persisted. No backup key, no corruption recovery (`readAll` returns `[]` and next write overwrites the blob), non-array JSON crashes `.filter` callers, `nextId()` swallows counter write failure with no fallback (duplicate INS IDs).
**Accept:** mirror `safety-records.ts` pattern — backup-key write-first, quota rethrow with human message, `Array.isArray` guard, `eqr:storage-corruption` event dispatch, counter fallback suffix via `cryptoRandomId()`; `handleSubmit` catches and shows a save-error state instead of the result screen; tests for quota-throw path and corrupt-JSON recovery.
**Outcome:** Full safety-records pattern ported: backup-key write-first with restore-on-corruption, quota rethrow ("Device storage is full…"), `Array.isArray` + per-entry shape guard, corruption event with store key, `cryptoRandomId()` suffix when the counter can't persist. `submitInspection` restructured record-first: the inspection is durable BEFORE the work order / out-of-service flip, so a quota throw leaves zero half-state (verified by test — `createWorkOrder` never called on failed write); WO creation is now best-effort with the link written back separately. `handleSubmit` catches into a `role="alert"` danger banner ("Inspection NOT saved… answers are still here") instead of the success screen. StorageAlert now names the affected store via `detail.key`. 10 new tests in `inspections-store.test.ts`. Gate: 615 tests, lint 0 errors, build clean.

### A3 — Zod validation drop destroys legal records on schema drift — `DONE`
**Profession:** Data-reliability engineer
**Files:** `src/lib/schemas.ts`, `src/lib/safety-records.ts`, `src/components/StorageAlert.tsx`
Records failing strict validation are silently dropped from reads; the next write persists the filtered array to primary AND backup → permanent deletion. Old/new app version drift (e.g. `AuditEvent.action` enum, missing fields) erases OSHA records.
**Accept:** failed records quarantined to `eqr-safety-records-quarantine` (append, capped) instead of discarded; `AuditEvent.action` loosened to `z.string()`; user-visible banner when quarantine is non-empty; test: a record with an unknown field/action survives a read-write cycle (or lands in quarantine, never silently vanishes).
**Outcome:** New `partitionSafetyRecords()` separates readable/unreadable records (null = whole-blob corrupt → backup path unchanged); `readAll` quarantines drifted records (deduped by record id or djb2 content fingerprint for id-less garbage, capped at 50, quota-tolerant) BEFORE any write-back can erase them. `AuditEvent.action` loosened to `z.string().max(100)` so unknown actions from other app versions parse clean. `eqr:records-quarantined` event fires only on newly added ids; StorageAlert shows a dismissible warn banner ("set aside — nothing was deleted") with sessionStorage dismissal that re-arms when the count grows; GDPR `clearAllLocalData` clears the quarantine too. Side fix: a raw `[]` store no longer false-positives the corruption path. 8 new tests incl. the filtered write-back deletion vector. Gate: 623 tests, build + lint clean.

### A4 — Archiver deletes the only copy of post-sync mutations — `DONE`
**Profession:** Sync/backend engineer
**Files:** `src/lib/safety-records.ts`, `src/lib/safety-sync.ts`, `src/app/api/safety/sync/route.ts`
`closePermit`/`revokePermit`/review mutations leave `syncStatus: 'synced'` and never re-queue; Notion holds only the creation-time snapshot; `archiveOldSyncedRecords` then deletes local records after 90 days — destroying closure/revocation/review history. Server permit stays "active" forever.
**Accept (minimum safe):** mutations set `syncStatus: 'pending'`; sync path updates the existing page when `notionPageId` exists (Status property + refreshed JSON) OR archiver excludes records whose latest audit event postdates last sync. No record with unsynced mutations is ever archived. Test the archiver guard.
**Outcome:** All three layers fixed. (1) All 6 post-creation mutations (closePermit, revokePermit, markSubmittedForReview, markReviewApproved/Rejected/Recalled) flip `synced → pending` via `dirtySyncStatus()` so they re-queue automatically on load/online. (2) `attemptSync`'s notionPageId short-circuit removed; the sync route now takes an UPDATE path when the page exists (client pageId or dedup query): PATCHes queryable properties (Status, Severity, new `EHS Review`) and APPENDS a timestamped snapshot — prior snapshots preserved as audit trail; stale pageId 404 falls through to create. (3) Belt-and-braces archiver guard: exported `hasUnsyncedMutations()` keeps any record whose events postdate its last 'synced' event — protects legacy records mutated under the old code. Updated the one sync test asserting the old skip behavior; 11 new tests (re-queue per mutation, legacy-shape detection, archive-after-heal). Gate: 634 tests, lint 0, build clean.

### A5 — Horizontal swipe exits an in-progress inspection (data loss on the daily path) — `DONE`
**Profession:** Mobile UX engineer
**Files:** `src/components/EquipmentProfile.tsx`, `src/hooks/useSwipe.ts`, `src/components/PreTripInspection.tsx`
Tab panel spreads `useSwipe`; pre-trip is the first tab so swipe-right calls `router.back()` — SPA nav, so `beforeunload` never fires and the 2s draft debounce loses the last answers. Gloved diagonal scroll triggers at 50px.
**Accept:** checklist area excluded from swipe (`data-no-swipe` supported by the hook) or swipe disabled while `step === 'checklist'`; `router.back()` never fires from a swipe during an active inspection; swipe thresholds tightened so diagonal scrolls don't trigger.
**Outcome:** Three layers. (1) New `onChecklistActiveChange` prop: PreTripInspection reports `step === 'checklist'` (covers draft-restore entry, cleared on unmount); EquipmentProfile stops spreading the swipe handlers entirely while active AND guards `goNext/goPrev` — `router.back()` can no longer fire from a swipe mid-inspection. (2) `data-no-swipe` on the checklist container as a structural guard. (3) Thresholds tuned for gloves: MIN_DISTANCE 50→70px, MAX_RATIO 0.6→0.45, new 400ms max duration so slow drags never navigate; classifier extracted as pure `evaluateSwipe()`. 7 new tests (diagonal scroll, slow drag, flicks both directions). Gate: 641 tests, lint 0, build clean.

### A6 — Inspection result screen is silent to screen readers, no focus, no haptic — `TODO`
**Profession:** Accessibility specialist
**Files:** `src/components/PreTripInspection.tsx`
After submit the DOM swaps with no `aria-live`, no focus move — an "Out of Service" verdict is never announced. `PtpDone` in `PreTaskPlanForm.tsx` already does this right (focus heading + haptic).
**Accept:** result container announced (`role="status"`/focus-on-heading with `tabIndex={-1}`) and `haptic()` fired per verdict, matching the PtpDone pattern.

### A7 — Safety-critical guidance text is 12px alpha-faded (illegible in sunlight) — `TODO`
**Profession:** Visual design / accessibility
**Files:** `src/components/PreTripInspection.tsx`, `src/components/safety/ConfinedSpaceForm.tsx`, `src/app/globals.css`
"This will send this unit to maintenance" is `text-xs text-warn/80` (~2.4:1 in light theme). Result explanations use `/80` alpha on semantic colors. Gas-reading verdicts are 12px.
**Accept:** `/80` alpha removed from message text (tinted backgrounds carry the tone), safety-critical guidance at `text-sm`; verify warn-on-white ≥ 4.5:1 in light theme (add a darker warn text token if needed).

---

## Phase B — Security quick wins (~30 min bundle, do together)

### B1 — Email hardening — `TODO`
**Profession:** Security engineer
**Files:** `src/lib/email-notify.ts`, `src/app/api/inspections/notify/route.ts`, `src/app/api/safety/review/submit/route.ts`, `src/app/api/beta/signup/route.ts`
**Accept:** CRLF stripped from subjects in `sendEhsNotification` (covers all callers); `role`/`crewSize` length caps in beta signup schema; both EHS email builders append a server-stamped `Submitted by (verified): <session email>` line so forged inspector names are distinguishable.

### B2 — API surface hardening — `TODO`
**Profession:** Security engineer
**Files:** `src/app/api/safety/sync/route.ts`, `src/app/api/safety/review/status/route.ts`, `next.config.mjs`
**Accept:** `rateLimit()` on sync (~10/min per email) and review/status (~30/min per email); CSP gains `base-uri 'self'; form-action 'self'`; `https://*.upstash.io` removed from connect-src (KV is server-only — verify no client usage first).

---

## Phase C — Data & sync correctness (P1)

### C1 — Blob persistence is fire-and-forget (photos/signatures silently lost) — `TODO`
**Profession:** Data-reliability engineer
**Files:** `src/lib/inspections.ts` (`savePhotos`), `src/lib/work-orders.ts`, `src/lib/shop-management.ts`
**Accept:** `savePhotos` awaits `tx.oncomplete` and rejects on `tx.onerror` (mirror `putBlobs` in safety-records); photo-save failure surfaces on the result screen (non-blocking notice); `work-orders.ts` `writeAll` rethrows quota; `shop-management.ts` uses `cryptoRandomId` and rethrows quota on user-initiated saves.

### C2 — Multi-tab races lose records / mint duplicate IDs — `TODO`
**Profession:** Data-reliability engineer
**Files:** `src/lib/safety-records.ts`, `src/lib/inspections.ts`, `src/lib/work-orders.ts`
Read-modify-write on whole arrays; last-writer-wins across tabs. `nextId()` non-atomic → duplicate IDs → Notion dedup maps second record onto first record's page.
**Accept:** mutations serialized via `navigator.locks.request` (with graceful no-lock fallback) or merge-by-id writes; IDs get a short `cryptoRandomId()` suffix so collisions are impossible; test simulating interleaved writes.

### C3 — "Submitted for EHS review" banner lies on failure — `TODO`
**Profession:** Frontend reliability engineer
**Files:** `src/components/safety/{ConfinedSpaceForm,HeightPermitForm,HotWorkPermitForm,IncidentReportForm,JhaForm,PreTaskPlanForm}.tsx`, `src/components/safety/FormSuccess.tsx`
Review submit POST is `.catch(() => {})` while `FormSuccess` hardcodes "Automatically submitted for EHS review" off the env flag. Offline/401/rate-limit/502 all silently drop the submission.
**Accept:** banner state driven by the actual promise result (pending → submitted / failed-with-retry); reuse `ReviewStatusSection`'s retry machinery.

### C4 — Review pipeline: duplicate Notion pages + decisions never reach the device — `TODO`
**Profession:** Backend/sync engineer
**Files:** `src/app/api/safety/review/submit/route.ts`, `src/app/api/safety/review/decide/route.ts`, `src/app/api/safety/review/status/route.ts`, form submit sequencing
Review submit has no dedup query (unlike `/api/safety/sync`) and races the concurrent `trySyncRecord`; email-link decisions write KV only, never PATCH Notion, so the device poller shows "Awaiting sign-off" forever.
**Accept:** review submit dedups by record ID (same query pattern as sync route) and returned `notionPageId` is persisted; decide route PATCHes the Notion `EHS Review` property (and `Reviewed By`); status route falls back to KV by recordId when Notion is unconfigured.

### C5 — Inspections: offline notify queue + CSV export surfaced in UI — `TODO`
**Profession:** Offline-first engineer
**Files:** `src/lib/inspections.ts`, `src/components/PreTripInspection.tsx`, `src/app/inspections/page.tsx`
Notify POST fires once and is gone if offline; `exportInspectionsToCsv` has zero UI callers — records are trapped in one browser.
**Accept:** failed/offline notify payloads queue in localStorage and flush on `online` (mirror `installSyncListeners` pattern); an "Export CSV" affordance exists (inspections page or admin) producing a download of all inspections.

---

## Phase D — PWA / offline shell

### D1 — Service worker: 24h page expiry bricks weekend-offline app; forced mid-task reloads — `TODO`
**Profession:** PWA engineer
**Files:** `src/app/sw.ts`, `src/components/SwUpdateBanner.tsx`
Default cache expires pages after 24h without `maxAgeFrom: 'last-used'`; no `networkTimeoutSeconds` on navigations (hangs on flaky connections); `skipWaiting: true` makes the update banner dead code and force-reloads every client mid-task on deploy.
**Accept:** custom document/RSC runtime-cache entries ahead of `defaultCache` with 30-day `maxAgeFrom: 'last-used'` and `networkTimeoutSeconds: 4`; `skipWaiting: true` removed so the existing banner + `SKIP_WAITING` message flow works as designed; production build produces a working SW.

### D2 — Storage persistence + sync visibility — `TODO`
**Profession:** PWA engineer
**Files:** `src/components/providers/SyncProvider.tsx`, `src/components/safety/SyncQueuePanel.tsx`
IndexedDB/localStorage evictable under pressure (this is the system of record); after one 503 the pending-sync panel disappears for 5 minutes instead of saying "sync unavailable."
**Accept:** `navigator.storage.persist()` requested once after first record save (log grant result); SyncQueuePanel shows an explicit "sync unavailable, will retry" state during backoff instead of vanishing.

---

## Phase E — Field UX sweep

### E1 — Touch-target sweep (gloved hands, daily path) — `TODO`
**Profession:** Mobile UX engineer
**Files:** `PreTripInspection.tsx` (Add Photo ~33px, photo-X 28px, Shift selector ~38px), `SageTriage.tsx` chips (~30px), `LastUsedChip.tsx` (~26px), `RecordView.tsx` header actions (~30px), `ModuleTourEngine.tsx`/`OnboardingTour.tsx` close (32px), `SyncQueuePanel.tsx` retry (36px), `ValidationSummary.tsx` (36px), `IncidentReportForm.tsx` photo-X + analysis dismiss
**Accept:** every listed control ≥44pt tap area (`min-h-[44px]`/`w-11 h-11` or padded hit area), `aria-label` on all icon-only buttons touched; Pass/Fail/N/A labels bumped `text-xs → text-sm font-semibold`; check layouts don't break at 390px width.

### E2 — Sync/status indicators are color-only 6px dots — `TODO`
**Profession:** Accessibility specialist
**Files:** `PreTripInspection.tsx` history rows, `SafetyRecordCard.tsx`, `BottomTabBar.tsx`
**Accept:** failed-sync state uses the existing icon+text badge pattern (`SafetyRecordCard.tsx:100-107`); tab-bar pending dot gets `sr-only` text (count included); no status conveyed by color alone on any record row.

### E3 — Interaction correctness bundle — `TODO`
**Profession:** Frontend engineer
**Files:** `StatusToggle.tsx` (span role=button, no keyboard), `IncidentReportForm.tsx` dismiss, `FormStepper.tsx` (scroll under sticky chrome), `ConfirmDialog.tsx` (no aria-labelledby), `UserMenu.tsx` (no arrow keys), `CrewSignatureBlock.tsx` (autofill fights datalist)
**Accept:** StatusToggle is a real `<button>`; stepper jumps land visible (`scroll-mt` on `[data-step]` or `block:'center'`); ConfirmDialog title/body wired via `aria-labelledby`/`aria-describedby`; UserMenu supports ArrowUp/Down/Escape/Home/End; crew name input gets `autoComplete="off"`.

### E4 — Tour overlays lack dialog semantics — `TODO`
**Profession:** Accessibility specialist
**Files:** `ModuleTourEngine.tsx`, `OnboardingTour.tsx`
Fixed-position divs with no `role="dialog"`, no `aria-modal`, no focus management — Tab lands on obscured page content; SRs never hear tooltips. ConfirmDialog/SageTriage use native `<dialog>` correctly.
**Accept:** tooltips get `role="dialog" aria-modal="true"` with labelled title, focus moves into the tooltip on step change and returns on finish; Tab cycles within tooltip controls.

---

## Phase F — Performance (felt on old iPhones / LTE)

### F1 — AuthGate blocks first paint on a network round-trip — `TODO`
**Profession:** Performance engineer
**Files:** `src/components/AuthGate.tsx`, `src/components/providers/AuthProvider.tsx`
Every page shows "Checking your sign-in…" until `/api/auth/session` resolves, even with a fresh cached identity. Also fetches `/api/auth/providers` on every mount regardless of auth state.
**Accept:** children render optimistically when `getCurrentIdentity()` is fresh while the session check completes in background (offline branch already trusts the cache — extend the pattern); `getProviders()` called only when `status === 'unauthenticated'`; behavior verified signed-in, signed-out, and offline.

### F2 — Full zod re-validation of the record store on every read — `TODO`
**Profession:** Performance engineer
**Files:** `src/lib/safety-records.ts`
`readAll` re-parses + re-validates hundreds of records 4-5x per dashboard load, on every safety-change event.
**Accept:** module-level cache keyed on the raw localStorage string, invalidated in `writeAll` and the cross-tab `storage` listener; corruption-recovery path unchanged; existing store tests pass unmodified.

### F3 — `/equipment/[id]` statically bundles all 8 tab panels (QR-scan landing route, 175 kB) — `TODO`
**Profession:** Performance engineer
**Files:** `src/components/EquipmentProfile.tsx`
**Accept:** non-default tab panels behind `next/dynamic` (keep pre-trip static — primary field flow); route first-load drops measurably; tab switch shows skeleton not blank.

### F4 — SignaturePad full-canvas redraw per pointermove — `TODO`
**Profession:** Graphics/perf engineer
**Files:** `src/components/SignaturePad.tsx`
**Accept:** active stroke appends segments incrementally (`lineTo` new segment only); full redraw only on resize/clear/restore; stroke rendering visually unchanged.

### F5 — Inspection draft loses last answers when app backgrounds within 2s debounce — `TODO`
**Profession:** Reliability engineer
**Files:** `src/components/PreTripInspection.tsx`
**Accept:** `pagehide`/`visibilitychange` flush mirroring `use-draft.ts:60-70`; backgrounding immediately after a tap preserves that answer.

---

## Phase G — Install polish (best-effort)

### G1 — Manifest + splash gaps — `TODO`
**Profession:** PWA engineer
**Files:** `public/manifest.json`, `src/app/layout.tsx`, `public/splash/*`
Missing splash profiles for iPhone 12-14/mini/XR/Pro Max and iPad Pro 12.9 (blank flash at launch); no maskable 192 icon; `orientation: portrait-primary` locks landscape iPad.
**Accept:** splash set covers the missing common profiles (generate programmatically — solid bg + centered icon is acceptable; if no image tooling available, mark DEFERRED with exact specs needed); maskable 192 added; orientation lock removed or justified; manifest validates.

---

## Deferred — needs a morning decision (do NOT auto-fix)

- **Shared email-login code can impersonate the admin** (`auth.ts:74-85` + `admin.ts:13-23`): excluding `ADMIN_EMAILS` from the credentials provider could lock YOU out if Google isn't configured in prod. Decide: per-user codes, `ALLOW_EMAIL_LOGIN=0`, or accept for beta.
- **KV as hard launch requirement**: rate limiting is a no-op without it (in-memory fallback resets per serverless instance). Verify `/api/admin/health` shows `kv: connected` in the production env before debut.
- **Full inspection Notion sync** (`syncToNotion` stub): real design work — where do inspections live server-side? (The offline notify queue in C5 covers the alerting gap meanwhile.)
- **Sentry-enabled build size**: needs `NEXT_PUBLIC_SENTRY_DSN` set to measure; expect +25-40 kB gz. Consider lazy `Sentry.init`.
- **zod → zod/mini swap** (~15 kB gz off every page): touches legal-record validation; do it in daylight with review, not overnight.

## Completion protocol

When every item above is `DONE` or `DEFERRED`: run the full gate one final time,
write `docs/mvp-polish-report.md` (per-item summary: what changed, files, how
verified), commit + push it, then delete the overnight cron job and stop.
