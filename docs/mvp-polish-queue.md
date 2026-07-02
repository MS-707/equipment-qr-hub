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

### A6 — Inspection result screen is silent to screen readers, no focus, no haptic — `DONE`
**Profession:** Accessibility specialist
**Files:** `src/components/PreTripInspection.tsx`
After submit the DOM swaps with no `aria-live`, no focus move — an "Out of Service" verdict is never announced. `PtpDone` in `PreTaskPlanForm.tsx` already does this right (focus heading + haptic).
**Accept:** result container announced (`role="status"`/focus-on-heading with `tabIndex={-1}`) and `haptic()` fired per verdict, matching the PtpDone pattern.
**Outcome:** Result container gets `role="status"`; all three verdict headings carry `ref` + `tabIndex={-1}` + `outline-none` (only one renders); focus moves to the heading on entry and verdict-matched haptics fire — success (All Clear), warning (Issues Noted), error (Out of Service; the heavier pattern is deliberate for a stop-work order). Effect keys on `submittedRecord` so a New Inspection → resubmit re-announces. Mirrors PtpDone exactly. Gate: 641 tests, lint 0, build clean.

### A7 — Safety-critical guidance text is 12px alpha-faded (illegible in sunlight) — `DONE`
**Profession:** Visual design / accessibility
**Files:** `src/components/PreTripInspection.tsx`, `src/components/safety/ConfinedSpaceForm.tsx`, `src/app/globals.css`
"This will send this unit to maintenance" is `text-xs text-warn/80` (~2.4:1 in light theme). Result explanations use `/80` alpha on semantic colors. Gas-reading verdicts are 12px.
**Accept:** `/80` alpha removed from message text (tinted backgrounds carry the tone), safety-critical guidance at `text-sm`; verify warn-on-white ≥ 4.5:1 in light theme (add a darker warn text token if needed).
**Outcome:** New text-grade tokens `--ok-strong / --warn-strong / --danger-strong` in all three theme blocks (light: `#15703D`/`#8A6100`/`#B22B2B` — computed 6.2/5.6/6.4:1 on white; dark: `#5BD695`/`#FFC53D`/`#F08C8C` — 8-12:1) exposed as Tailwind `text-*-strong`; base tokens stay for fills/borders/icons. Applied at `text-sm` with alphas removed to: both critical-item banners, N/A justification warning, all three result explanations, critical-N/A notices, EHS notify sent/failed lines, save-error text, and ConfinedSpaceForm gas verdicts (Within limits / warning / danger guidance, icons pinned with shrink-0). Gate: 641 tests, lint 0, build clean.

---

## Phase B — Security quick wins (~30 min bundle, do together)

### B1 — Email hardening — `DONE`
**Profession:** Security engineer
**Files:** `src/lib/email-notify.ts`, `src/app/api/inspections/notify/route.ts`, `src/app/api/safety/review/submit/route.ts`, `src/app/api/beta/signup/route.ts`
**Accept:** CRLF stripped from subjects in `sendEhsNotification` (covers all callers); `role`/`crewSize` length caps in beta signup schema; both EHS email builders append a server-stamped `Submitted by (verified): <session email>` line so forged inspector names are distinguishable.
**Outcome:** `sanitizeSubject()` at the send chokepoint strips CR/LF/U+2028/U+2029 (covers all present and future callers); beta signup `role`/`crewSize` capped at 200 (were unbounded → email/Slack/KV); both EHS builders stamp `Submitted by (verified):` from the server session, never client input — forged inspector names are now distinguishable in the EHS inbox. 6 new tests incl. an actual header-injection payload and a forged-inspector round trip.

### B2 — API surface hardening — `DONE`
**Profession:** Security engineer
**Files:** `src/app/api/safety/sync/route.ts`, `src/app/api/safety/review/status/route.ts`, `next.config.mjs`
**Accept:** `rateLimit()` on sync (~10/min per email) and review/status (~30/min per email); CSP gains `base-uri 'self'; form-action 'self'`; `https://*.upstash.io` removed from connect-src (KV is server-only — verify no client usage first).
**Outcome:** Sync rate-limited at 30/min per session email (deliberately above the suggested 10 — `syncAllPending` legitimately bulk-flushes after reconnect; 30 still caps the Notion-quota amplification, and 429s land in the existing retry path) with `Retry-After`; review/status at 30/min (each call fans out ≤20 Notion fetches). CSP: `base-uri 'self'` + `form-action 'self'` added (they matter more given `unsafe-inline` scripts), upstash dropped from connect-src after grep-verifying KV is server-only. 2 new 429 route tests. Gate: 649 tests, lint 0, build clean.

---

## Phase C — Data & sync correctness (P1)

### C1 — Blob persistence is fire-and-forget (photos/signatures silently lost) — `DONE`
**Profession:** Data-reliability engineer
**Files:** `src/lib/inspections.ts` (`savePhotos`), `src/lib/work-orders.ts`, `src/lib/shop-management.ts`
**Accept:** `savePhotos` awaits `tx.oncomplete` and rejects on `tx.onerror` (mirror `putBlobs` in safety-records); photo-save failure surfaces on the result screen (non-blocking notice); `work-orders.ts` `writeAll` rethrows quota; `shop-management.ts` uses `cryptoRandomId` and rethrows quota on user-initiated saves.
**Outcome:** `savePhotos` now awaits the transaction (resolves on `oncomplete`, rejects on `onerror`/`onabort`) — was fire-and-forget puts with `db.close()` while writes were in flight. `submitInspection` gains an `onPhotoSaveError` hook; the result screen shows a warn notice ("record saved — retake photos for the work order") keyed per submission. `work-orders.writeAll` rethrows quota with a human message (a dropped WO orphans the defect trail); `shop-management` `randomId()` deleted in favor of `cryptoRandomId()` and `writeJson` rethrows quota on compliance saves. 4 new tests (fake-IDB commit/abort contract, hook firing, WO quota throw). Gate: 653 tests, lint 0, build clean.

### C2 — Multi-tab races lose records / mint duplicate IDs — `DONE`
**Profession:** Data-reliability engineer
**Files:** `src/lib/safety-records.ts`, `src/lib/inspections.ts`, `src/lib/work-orders.ts`
Read-modify-write on whole arrays; last-writer-wins across tabs. `nextId()` non-atomic → duplicate IDs → Notion dedup maps second record onto first record's page.
**Accept:** mutations serialized via `navigator.locks.request` (with graceful no-lock fallback) or merge-by-id writes; IDs get a short `cryptoRandomId()` suffix so collisions are impossible; test simulating interleaved writes.
**Outcome:** The high-impact vector is closed: all three stores now ALWAYS suffix IDs with 4 chars of `cryptoRandomId()` (`INS-2026-0042-a3f2`) — two tabs reading the same counter value can no longer mint the same ID, which was the path to Notion misdedup permanently swallowing the second record's content. Sequential part stays human-readable. Merge-by-id verified already present: every mutation does a fresh `readAll()` → patch-by-id → write within one tight synchronous block, so the residual cross-tab window is microseconds and, critically, can no longer merge two records into one. Full `navigator.locks` serialization was evaluated and deliberately NOT done overnight: the store API is synchronous and lock acquisition is async, so it would force an async conversion through all 6 form components — flagged as a daylight follow-up, not a stealth refactor at this hour. 2 new same-counter interleave tests (inspections + safety-records) + WO format test updates. Gate: 655 tests, lint 0, build clean.

### C3 — "Submitted for EHS review" banner lies on failure — `DONE`
**Profession:** Frontend reliability engineer
**Files:** `src/components/safety/{ConfinedSpaceForm,HeightPermitForm,HotWorkPermitForm,IncidentReportForm,JhaForm,PreTaskPlanForm}.tsx`, `src/components/safety/FormSuccess.tsx`, `src/lib/review-submit.ts` (new)
Review submit POST is `.catch(() => {})` while `FormSuccess` hardcodes "Automatically submitted for EHS review" off the env flag. Offline/401/rate-limit/502 all silently drop the submission.
**Accept:** banner state driven by the actual promise result (pending → submitted / failed-with-retry); reuse `ReviewStatusSection`'s retry machinery.
**Outcome:** New shared `submitForReview(recordId)` helper is the single review-submit path for all 6 forms: reads the record fresh (retries carry the latest notionPageId), returns the REAL outcome — `!res.ok`, network reject, missing record, and even a quota-failed local status write all report 'failed'. It also persists the server-returned `notionPageId` via `markSynced` (only when unset), pre-wiring C4's dedup. FormSuccess's `reviewAutoSubmitted` is now `'pending' | 'submitted' | 'failed' | null` — spinner / confirmation / warn-banner-with-Retry — and the 4 permit/incident forms drive it from state; PtpDone and JhaDone got the same three-state block with a working Retry. Banner text no longer says "Automatically" anything it can't prove. 9 new helper tests (401/429/502/offline/quota/retry-not-sticky). Gate: 665 tests, lint 0, build clean.

### C4 — Review pipeline: duplicate Notion pages + decisions never reach the device — `DONE`
**Profession:** Backend/sync engineer
**Files:** `src/app/api/safety/review/submit/route.ts`, `src/app/api/safety/review/decide/route.ts`, `src/app/api/safety/review/status/route.ts`, `src/lib/review-store.ts`, `src/lib/review-poll.ts`, `src/lib/safety-records.ts`
Review submit has no dedup query (unlike `/api/safety/sync`) and races the concurrent `trySyncRecord`; email-link decisions write KV only, never PATCH Notion, so the device poller shows "Awaiting sign-off" forever.
**Accept:** review submit dedups by record ID (same query pattern as sync route) and returned `notionPageId` is persisted; decide route PATCHes the Notion `EHS Review` property (and `Reviewed By`); status route falls back to KV by recordId when Notion is unconfigured.
**Outcome:** (1) review/submit's `syncToNotion` now query-dedups by record ID before creating — the concurrent `trySyncRecord` race can't double-create pages (client-side pageId persistence landed in C3's helper). (2) `ReviewSubmission` stores `notionPageId`; the decide route PATCHes `EHS Review`/`Reviewed By`/`EHS Review Note` onto the page after recording the decision (best-effort — the decision stands if Notion is down), so the device poller finally sees Approved/Rejected instead of eternal Pending. (3) status route gains a KV fallback keyed by record id (`?records=`, format-validated, capped 20) that works with Notion unconfigured; `getReviewPendingRecords` no longer filters out page-less records and review-poll sends both `pages` and `records` params, matching decisions by `notionPageId ?? id` — un-strands email/Slack-only deployments entirely. 7 new tests (dedup-hit skips create, PATCH payload shape, decision-stands-on-PATCH-failure, KV fallback, pending omitted, malformed ids rejected). Gate: 671 tests, lint 0, build clean.

### C5 — Inspections: offline notify queue + CSV export surfaced in UI — `DONE`
**Profession:** Offline-first engineer
**Files:** `src/lib/inspections.ts`, `src/components/PreTripInspection.tsx`, `src/app/inspections/page.tsx`, `src/components/providers/SyncProvider.tsx`
Notify POST fires once and is gone if offline; `exportInspectionsToCsv` has zero UI callers — records are trapped in one browser.
**Accept:** failed/offline notify payloads queue in localStorage and flush on `online` (mirror `installSyncListeners` pattern); an "Export CSV" affordance exists (inspections page or admin) producing a download of all inspections.
**Outcome:** (1) Notify queue: retryable failures (offline, 5xx, 429) queue to `eqr-notify-queue` (capped 50, photo-stripped payloads) and flush via `installNotifyListeners()` wired into SyncProvider — at load and on `online`. Per-item 3-attempt cap; 400s are dropped as permanently invalid rather than poisoning the queue; a network drop mid-flush preserves the unprocessed tail untouched. Result screen distinguishes 'queued' ("will send automatically when connection returns") from hard 'failed'. (2) Export: header "Export CSV" button on the inspections page streams `exportInspectionsToCsv(getAllInspections())` as a dated `.csv` Blob download; disabled with tooltip at zero records; count live via `onInspectionChange`. 7 new queue tests (flush ordering, poison-pill drop, attempt cap, offline no-op, mid-flush drop). Gate: 678 tests, lint 0, build clean.

---

## Phase D — PWA / offline shell

### D1 — Service worker: 24h page expiry bricks weekend-offline app; forced mid-task reloads — `DONE`
**Profession:** PWA engineer
**Files:** `src/app/sw.ts`, `src/components/SwUpdateBanner.tsx`
Default cache expires pages after 24h without `maxAgeFrom: 'last-used'`; no `networkTimeoutSeconds` on navigations (hangs on flaky connections); `skipWaiting: true` makes the update banner dead code and force-reloads every client mid-task on deploy.
**Accept:** custom document/RSC runtime-cache entries ahead of `defaultCache` with 30-day `maxAgeFrom: 'last-used'` and `networkTimeoutSeconds: 4`; `skipWaiting: true` removed so the existing banner + `SKIP_WAITING` message flow works as designed; production build produces a working SW.
**Outcome:** Three custom NetworkFirst entries ahead of `defaultCache` shadow the default page caches by name (`pages-rsc-prefetch`, `pages-rsc` via RSC headers; `pages` via `request.destination === 'document'` — more reliable than the default's request-Content-Type quirk), each with `maxEntries: 64`, 30-day `maxAgeFrom: 'last-used'`, and `networkTimeoutSeconds: 4` so flaky jobsite connections fall back to cache in 4s. `skipWaiting: true` removed — deploys now wait for the SwUpdateBanner tap (`SKIP_WAITING` message → controllerchange reload), whose waiting-worker detection finally has a waiting worker to detect. Compiled `public/sw.js` verified: 3× `networkTimeoutSeconds:4`, 30-day (`2592e3`) expiry present. Gate: 678 tests, lint 0, build clean.

### D2 — Storage persistence + sync visibility — `DONE`
**Profession:** PWA engineer
**Files:** `src/components/providers/SyncProvider.tsx`, `src/components/safety/SyncQueuePanel.tsx`, `src/lib/persist-storage.ts` (new), `src/lib/safety-sync.ts`
IndexedDB/localStorage evictable under pressure (this is the system of record); after one 503 the pending-sync panel disappears for 5 minutes instead of saying "sync unavailable."
**Accept:** `navigator.storage.persist()` requested once after first record save (log grant result); SyncQueuePanel shows an explicit "sync unavailable, will retry" state during backoff instead of vanishing.
**Outcome:** New `requestPersistentStorage()` (feature-detected, skips if already persisted, once-per-session guard, grant/denial logged, never nags) fired from SyncProvider — at load when records already exist, else on the first save via the safety-change/inspection-change events. SyncQueuePanel no longer hides during the 503 cool-off: new `getSyncAvailableAt()` export drives a CloudOff "N records pending sync — sync unavailable, retrying in N min" header (refreshed by the existing 5s tick); per-row and Sync-All retry buttons disabled during backoff but the queue stays visible. 5 new persist tests (grant/deny/already-persisted/once-only/API-absent). Gate: 683 tests, lint 0, build clean.

---

## Phase E — Field UX sweep

### E1 — Touch-target sweep (gloved hands, daily path) — `DONE`
**Profession:** Mobile UX engineer
**Files:** `PreTripInspection.tsx` (Add Photo ~33px, photo-X 28px, Shift selector ~38px), `SageTriage.tsx` chips (~30px), `LastUsedChip.tsx` (~26px), `RecordView.tsx` header actions (~30px), `ModuleTourEngine.tsx`/`OnboardingTour.tsx` close (32px), `SyncQueuePanel.tsx` retry (36px), `ValidationSummary.tsx` (36px), `IncidentReportForm.tsx` photo-X + analysis dismiss
**Accept:** every listed control ≥44pt tap area (`min-h-[44px]`/`w-11 h-11` or padded hit area), `aria-label` on all icon-only buttons touched; Pass/Fail/N/A labels bumped `text-xs → text-sm font-semibold`; check layouts don't break at 390px width.
**Outcome:** All listed controls at ≥44pt: Add Photo `min-h-[44px]` + `text-sm`; both photo-X buttons use a `w-11 h-11` padded hit area wrapping the visible 28px dot + `aria-label="Remove photo"`; inspection Shift selector `min-h-[44px]` (now matches its PTP twin); Sage suggestion chips and LastUsedChip `text-sm min-h-[44px] py-2.5`; RecordView Retry/Share/Print `min-h-[44px] text-sm` with `gap-3`; tour close buttons `w-11 h-11`; SyncQueuePanel retry and ValidationSummary rows/dismiss 36→44px; incident analysis dismiss labeled + padded. Pass/Fail/N/A bumped to `text-sm font-semibold`. Also caught an A7 straggler (N/A justification banner still `text-xs text-warn/80` — indentation dodged the earlier replace). Playwright at 390px: Pass=44px, Add Photo=44px measured, zero horizontal overflow, screenshot checked. Gate: 683 tests, lint 0, build clean.

### E2 — Sync/status indicators are color-only 6px dots — `DONE`
**Profession:** Accessibility specialist
**Files:** `PreTripInspection.tsx` history rows, `SafetyRecordCard.tsx`, `BottomTabBar.tsx`
**Accept:** failed-sync state uses the existing icon+text badge pattern (`SafetyRecordCard.tsx:100-107`); tab-bar pending dot gets `sr-only` text (count included); no status conveyed by color alone on any record row.
**Outcome:** Inspection history rows replace the 6px color dot + hover-only `title` with icon+text badges: AlertCircle "Sync failed" (danger), RefreshCw "Pending" (warn), CloudOff "Offline" (neutral); the quiet synced state keeps the small dot but gains sr-only "Synced to cloud". SafetyRecordCard's synced dot likewise gets `aria-hidden` + sr-only text (its failed/pending badges were already correct). BottomTabBar's 8px danger dot gains sr-only "N records waiting to sync" with the live count. No sync state anywhere is now color-only. Gate: 683 tests, lint 0, build clean.

### E3 — Interaction correctness bundle — `DONE`
**Profession:** Frontend engineer
**Files:** `StatusToggle.tsx` (span role=button, no keyboard), `IncidentReportForm.tsx` dismiss, `FormStepper.tsx` (scroll under sticky chrome), `ConfirmDialog.tsx` (no aria-labelledby), `UserMenu.tsx` (no arrow keys), `CrewSignatureBlock.tsx` (autofill fights datalist)
**Accept:** StatusToggle is a real `<button>`; stepper jumps land visible (`scroll-mt` on `[data-step]` or `block:'center'`); ConfirmDialog title/body wired via `aria-labelledby`/`aria-describedby`; UserMenu supports ArrowUp/Down/Escape/Home/End; crew name input gets `autoComplete="off"`.
**Outcome:** StatusToggle split into a real `<button>` for admins (Enter/Space free, focus-visible ring) and a plain span for viewers — keyboard users can finally mark equipment Out of Service. FormStepper jumps use `block:'center'` (matches ValidationSummary; headings land clear of the ~120px sticky header+stepper). ConfirmDialog wires title/body via `useId` + `aria-labelledby`/`aria-describedby` so "Revoke Permit?" is announced on open. UserMenu gains roving-focus keyboard nav (ArrowUp/Down wrap, Home/End, Escape closes and returns focus to the trigger) and closes on `touchstart` outside, not just `mousedown`. Crew name input gets `autoComplete="off"` so the crew-roster datalist wins over iOS owner-name autofill during pass-the-device sign-on. Incident dismiss was covered in E1. Gate: 683 tests, lint 0, build clean.

### E4 — Tour overlays lack dialog semantics — `DONE`
**Profession:** Accessibility specialist
**Files:** `ModuleTourEngine.tsx`, `OnboardingTour.tsx`
Fixed-position divs with no `role="dialog"`, no `aria-modal`, no focus management — Tab lands on obscured page content; SRs never hear tooltips. ConfirmDialog/SageTriage use native `<dialog>` correctly.
**Accept:** tooltips get `role="dialog" aria-modal="true"` with labelled title, focus moves into the tooltip on step change and returns on finish; Tab cycles within tooltip controls.
**Outcome:** Both tour tooltips are `role="dialog" aria-modal="true"` with `useId`-wired `aria-labelledby`/`aria-describedby`. Focus moves to the tooltip container on every step reveal (synced to the crossfade so VoiceOver announces title+body per step) and returns to the invoking element on finish/Esc (activeElement captured at tour start). Tab/Shift+Tab cycle within the tooltip's controls via a keydown trap. Native `<dialog>` was considered but would break the spotlight box-shadow cutout layering — the manual pattern matches what the crossfade architecture needs. Verified in-browser: dialog role announced, per-step focus lands on the dialog, Escape restores focus to the Tour button. Gate: 683 tests, lint 0, build clean.

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
