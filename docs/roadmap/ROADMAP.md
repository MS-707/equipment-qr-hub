# Roadmap to 10/10 × 7 — frozen 2026-07-06

Executed autonomously by `/loop /goal next` (see `HARNESS.md`). One milestone per iteration;
every gate green and every targeted criterion adversarially verified before a milestone closes.
Spanish support (dimension `spanish`, milestones ES-M*) was added 2026-07-06 after a design tournament
over the reverted June attempt — implementation spec in `docs/i18n/DESIGN.md`.

**28 milestones · 82 tasks · 40 criteria to flip · starting score 30/70**

## Execution order

### 1. LG-M1 — Make the privacy policy match actual data flows and retention
*Dimension: Legal · flips: LG-2, LG-3, LG-4, LG-5 · why here: false statements in a live privacy policy (signatures, AI PII, missing processors, wrong retention) are an active legal liability and pure doc edits; fix truthfulness before anything else.*

- [x] **LG-M1-T1** Rewrite the Digital Signatures and Resend sections of src/app/privacy/page.tsx to disclose that the pre-trip inspection signature is emailed to EHS as a PNG attachment via Resend (or, alternatively, stop attaching it in api/inspections/notify/route.ts).
  - *Acceptance:* grep -n 'not shared' src/app/privacy/page.tsx returns nothing about signatures; the Digital Signatures section names the EHS email attachment flow, or the notify route no longer attaches signatureDataUrl.
- [x] **LG-M1-T2** Reconcile the AI Features section with sage-context: either remove userName and supervisor name from contextToPrompt/summarizePtp in src/lib/sage-context.ts, or amend the privacy AI section to state worker names may be included in AI requests.
  - *Acceptance:* Either grep 'userName' src/lib/sage-context.ts shows it is no longer emitted into the prompt string, or the privacy AI Features section explicitly discloses names are sent; the two are consistent.
- [x] **LG-M1-T3** Add Sentry (error monitoring), Upstash Redis / Vercel KV (server-side storage of login emails, beta signups, review submissions), and Vercel (hosting) to the Third-Party Services list, and extend the Slack bullet to cover first-sign-in name/email notifications.
  - *Acceptance:* grep -in 'sentry' and grep -in 'upstash\|vercel' src/app/privacy/page.tsx each return hits inside the Third-Party Services section; the Slack bullet mentions sign-in notifications.
- [x] **LG-M1-T4** Rewrite the Data Retention section with the implemented periods (90-day local archive of synced records, 7-day draft prune, KV TTLs 90d/180d/7-30d) and add a docs/COMPLIANCE-RETENTION.md mapping incident reports (29 CFR 1904.33, 5 years), forklift training certification (29 CFR 1910.178(l)(6)), and daily inspections to app retention behavior, linked from the policy.
  - *Acceptance:* Privacy retention section states the 90-day archive and draft prune; docs/COMPLIANCE-RETENTION.md exists citing 1904.33 and 1910.178(l) and is referenced from the policy.

### 2. DM-M1 — First-run sign-in works out of the box
*Dimension: MVP Demo Readiness · flips: DM-6 · why here: a small auth-config change in src/lib/auth.ts that unblocks first-run sign-in for every subsequent local run, e2e spec, and demo rehearsal; verify jointly with BE-3.*

- [x] **DM-M1-T1** In src/lib/auth.ts, register the dev Credentials provider when Google OAuth is not configured in non-production (allowDevLogin = (ALLOW_DEV_LOGIN==='1' || (!hasGoogle && ALLOW_DEV_LOGIN !== '0')) && !isProduction), preserving the existing hard production gate, and add a unit test in src/lib/__tests__/auth.test.ts asserting the provider list is non-empty with GOOGLE_CLIENT_ID and ALLOW_DEV_LOGIN both unset in development.
  - *Acceptance:* With an empty .env.local and NODE_ENV=development, GET /api/auth/providers returns a 'dev' provider (or the new unit test proves providers includes id 'dev'); npm test exits 0; production behavior (NODE_ENV=production, no flags) still yields zero credentials providers.

### 3. DS-M5 — Eliminate fixed-width horizontal overflow at phone widths (DS-7)
*Dimension: Design · flips: DS-7 · why here: phone-width overflow on the sign-in gate is demo-visible and a one-file fix; slot it with the early cheap wins*

- [x] **DS-M5-T1** Fix AuthGate.tsx:143's literal w-[520px] h-[520px] glow (and every other DS-7 grep hit) to be viewport-safe: max-w-full, sm:/md: scoping, or an overflow-hidden ancestor — matching the beta page's contained-glow pattern.
  - *Acceptance:* DS-7 verify passes: every 3-digit-px w-[] hit (excluding min-w-/max-w-) is viewport-bounded; AuthGate renders without horizontal scroll at 360px width.

### 4. BE-M2 — Zod-validate every API request body
*Dimension: Backend · flips: BE-8 · why here: zod-validate every request body: correctness-of-data foundation that later hardening, logging, and audit claims all sit on; do before adding more API surface.*

- [x] **BE-M2-T1** Create zod schemas in src/lib for the safety-record bodies (safety/sync, review/submit — model on the existing manual checks: id<=100, known type, valid createdAt, optional notionPageId regex) and migrate both routes to .safeParse, deleting the 'as SafetyRecord' cast. Preserve existing status codes (400/403/413) so safety-sync-route.test.ts and review-submit-route.test.ts still pass.
  - *Acceptance:* grep -rn 'await req.json()) as' src/app/api returns nothing; both routes call safeParse; vitest run passes.
- [x] **BE-M2-T2** Add request-body zod schemas (with the current .trim/.slice caps expressed as .max) for the 9 Anthropic routes (sage/triage, parse-document, check-permits, suggest-jha/hazards/toolbox, analyze-atmosphere, analyze-incident, audit-ptp) and the beta signup/decide bodies; replace typed-let coercions with safeParse. Update route tests where error-message text changes.
  - *Acceptance:* grep -rn 'safeParse' src/app/api src/lib covers every body-reading route; grep -rn 'let body:' src/app/api returns nothing; all 69 test files pass.

### 5. BE-M4 — Standards-compliant 429 responses on every rate-limited route (BE-2)
*Dimension: Backend · flips: BE-2 · why here: same route files as BE-M2's validation pass; one-line-per-route fix while the context is loaded*

- [x] **BE-M4-T1** Add a Retry-After header to every rate-limited 429 response (src/app/api/beta/signup/route.ts:15 confirmed missing; sweep all 15 rate-limited routes). Prefer a shared helper in src/lib/rate-limit.ts so future routes inherit it. Extend route tests to assert the header.
  - *Acceptance:* BE-2 verify passes: every 429 response across rate-limited routes carries Retry-After; route tests assert it for beta/signup and at least two others.

### 6. BE-M3 — Resilience: guard KV calls and time-bound outbound fetches
*Dimension: Backend · flips: BE-9 · why here: KV guards and outbound-fetch timeouts: makes the data path resilient so subsequent e2e and demo work isn't chasing flaky 500s/hangs.*

- [x] **BE-M3-T1** Wrap the unguarded KV awaits in route handlers — addSignup (beta/signup:58), updateSignupStatus/getAllSignups (beta/decide:26,42), storeReviewSubmission (review/submit:122), getReviewSubmission/decideReview (review/decide:39,55) — so a KV throw returns a 503 JSON error (and reports via BE-M1's helper). Extend the corresponding route tests with a kv-throws case.
  - *Acceptance:* Route tests mocking kv.set/kv.get to throw assert a JSON 503 (not an unhandled rejection) for all four routes; vitest run passes.
- [x] **BE-M3-T2** Add a fetchWithTimeout helper (AbortSignal.timeout, ~10s default, existing error mapping unchanged) and use it for every server-side fetch to api.notion.com, api.resend.com, and the Slack webhook across safety/sync, review/submit, review/status, review/decide, email-notify.ts, slack-notify.ts. Timeout must surface as the existing 'failed'/502 degraded path.
  - *Acceptance:* grep -rn 'AbortSignal.timeout\|fetchWithTimeout' src shows every external fetch call site covered (grep for 'fetch(' in those files finds no bare external fetch); vitest run passes.

### 7. BE-M1 — Wire server-side Sentry error capture end to end
*Dimension: Backend · flips: BE-10 · why here: wire server Sentry (instrumentation.ts + captureException); do immediately before EN-M3 since they edit the same catch blocks.*

- [x] **BE-M1-T1** Add src/instrumentation.ts with register() importing sentry.server.config.ts (and sentry.edge.config.ts for the edge runtime) and export onRequestError = Sentry.captureRequestError, per @sentry/nextjs v10 + Next 14 requirements. Keep it a no-op when NEXT_PUBLIC_SENTRY_DSN is unset.
  - *Acceptance:* find src -name 'instrumentation.ts' returns the file; it contains register() loading the server config and an onRequestError export; npx tsc --noEmit and npm run build succeed.
- [x] **BE-M1-T2** Add a shared reportServerError(scope, err) helper in src/lib (console.error + Sentry.captureException, safe when DSN unset) and call it from every catch block in src/app/api/**/route.ts and in email-notify.ts / slack-notify.ts failure paths. Add a unit test asserting the helper calls captureException when DSN is set.
  - *Acceptance:* grep -rn 'captureException\|reportServerError' src/app/api src/lib shows every route catch block covered; vitest run passes including the new helper test.

### 8. EN-M3 — Observability and audit trail: structured logs + privileged-action log
*Dimension: Enterprise Readiness · flips: EN-7, EN-8 · why here: structured logger + privileged-action audit log in the same route-file pass as BE-M1; one shared helper satisfies BE-10, EN-7, EN-8 together.*

- [x] **EN-M3-T1** Add src/lib/log.ts exporting log(level, event, fields) that JSON.stringify's one line {ts, level, event, route?, actor?, outcome?, ...fields} to console; unit-test it (valid JSON, no secret fields).
  - *Acceptance:* vitest passes a new log.test.ts asserting JSON.parse-able single-line output containing event and level keys.
- [x] **EN-M3-T2** Migrate every console.* call in src/app/api/**/route.ts (10 files, incl. safety/sync, review/submit, review/decide, sage/triage, all AI suggest routes) and src/lib server modules used by routes (rate-limit.ts, slack-notify.ts, auth.ts) to the shared logger with event + route fields.
  - *Acceptance:* `grep -rn 'console\.' src/app/api --include=route.ts` returns zero matches; test suite and build pass.
- [x] **EN-M3-T3** Add src/lib/audit-log.ts (appendAudit({actor, action, target}) → LPUSH to KV key 'audit:log' with LTRIM cap ~1000, fail-open); call it from api/beta/decide POST (actor = session email, action = beta-approved/rejected, target = signup id) and api/safety/review/decide (actor = reviewer identity from token, action = review-approved/rejected, target = recordId).
  - *Acceptance:* Grep confirms appendAudit called in both routes; new vitest file covers append shape and fail-open on KV error.
- [x] **EN-M3-T4** Add GET /api/admin/audit returning the newest N audit entries, gated exactly like /api/admin/health (session + isAdmin, 401 otherwise); route test for the 401 path and the happy path with mocked KV.
  - *Acceptance:* EN-8 check passes: non-admin GET returns 401, admin GET returns JSON array of {actor, action, target, at}; tests green.

### 9. EN-M4 — RBAC: three-role model, server-enforced and documented
*Dimension: Enterprise Readiness · flips: EN-9 · why here: implement the three-role RBAC (EN-9) now so the docs milestone can describe reality; also the moment to address the shared-code impersonation gap.*

- [x] **EN-M4-T1** Extend src/lib/admin.ts (or new src/lib/roles.ts) with resolveRole(email): 'admin' | 'ehs' | 'worker' using ADMIN_EMAILS and new EHS_EMAILS env allowlists; expose session.user.role in the NextAuth session callback alongside isAdmin; add the type augmentation and unit tests for precedence (admin wins over ehs) and case-insensitivity.
  - *Acceptance:* vitest passes roles tests; session callback in src/lib/auth.ts sets session.user.role; .env.example documents EHS_EMAILS.
- [x] **EN-M4-T2** Enforce the ehs role server-side on at least one route: require role ehs-or-admin on api/safety/review/decide's session-fallback path (or add the check to review/status detail access), returning 403 for workers; keep the HMAC email-link path working. Add a route test for the 403.
  - *Acceptance:* A worker-role session hitting the guarded route gets 403 in the new test; admin/ehs sessions succeed; existing review tests still pass.
- [x] **EN-M4-T3** Rewrite README 'Authorization Scope' (line ~244) into a role table (admin / ehs / worker with their capabilities) removing the 'does not implement role-based access control' sentence, and note server-side enforcement points.
  - *Acceptance:* grep 'does not implement role-based access control' README.md returns nothing; README lists all three roles.
- [x] **EN-M4-TX1** Harden email-code login identity assurance: the single shared EMAIL_LOGIN_CODE currently lets anyone holding it sign in as ANY allowed-domain address (including ADMIN_EMAILS) with a freeform name (src/lib/auth.ts). Minimum: block ADMIN_EMAILS and elevated-role addresses from shared-code login (require OAuth or per-user code). Note the chosen approach in docs/SSO.md.
  - *Acceptance:* A test proves an ADMIN_EMAILS address cannot authenticate via the shared email code; non-admin domain logins still work. This also protects LG-7's server-verified-identity claim.

### 10. EN-M2 — Enterprise documentation pack: retention, SSO path, runbooks
*Dimension: Enterprise Readiness · flips: EN-6, EN-10 · why here: enterprise doc pack (retention/SSO/runbook) after RBAC exists and reusing LG-M1's retention inventory; drop its duplicated EN-9 task.*

- [x] **EN-M2-T1** Write docs/DATA-RETENTION.md enumerating every store (localStorage safety/inspection/work-order records, IndexedDB signature/photo blobs, Upstash KV keys by prefix — beta:, rl:, review:, health:probe — Notion databases, Resend/Slack notification payloads) each with a concrete retention period or deletion trigger, citing Cal/OSHA record-keeping horizons where relevant; update the vague sentence in src/app/privacy/page.tsx Data Retention section to state the concrete policy and link it.
  - *Acceptance:* EN-6 check passes: the doc names localStorage, IndexedDB, KV/Redis, Notion, and email/Slack payloads each with a period or trigger; privacy page no longer says only 'follow your organization's retention policies'.
- [x] **EN-M2-T2** Write docs/SSO.md: how identity works today (Google Workspace OIDC, domain allowlist, JWT sessions), then step-by-step Okta and Microsoft Entra ID provider addition — exact providers-array insertion point in src/lib/auth.ts, env var names (OKTA_CLIENT_ID/SECRET/ISSUER, ENTRA_CLIENT_ID/SECRET/TENANT_ID), callback URLs /api/auth/callback/okta and /api/auth/callback/azure-ad, and how emailAllowed + isAdmin keep applying. Link from README Authentication section.
  - *Acceptance:* grep -i 'okta' docs/SSO.md and grep -i 'entra' docs/SSO.md both hit; doc cites src/lib/auth.ts and both callback URLs; README links to it.
- [x] **EN-M2-T3** Write docs/RUNBOOKS.md with (a) numbered incident-response steps (detect via Sentry/health endpoint, contain by rotating NEXTAUTH_SECRET / revoking KV token / disabling env flags on Vercel, notify per SECURITY.md, post-mortem) and (b) backup/restore: add scripts/backup-kv.mjs that dumps review:*/beta:* keys to JSON via @upstash/redis SCAN, plus documented Notion export/restore steps and localStorage device-loss caveats.
  - *Acceptance:* EN-10(b) check passes: runbook has restore sections for both KV (citing scripts/backup-kv.mjs, which runs with KV_REST_API_URL/TOKEN set) and Notion with a concrete command/path each; incident-response section has numbered steps.

### 11. LG-M2 — Close consent and AI-disclaimer gaps on capture surfaces
*Dimension: Legal · flips: LG-6, LG-8, LG-9 · why here: consent text at signature pads, AI disclaimers, beta-form privacy link: small UI strings closing real legal exposure on capture surfaces.*

- [x] **LG-M2-T1** Add an intent/consent sentence above the reporter SignaturePad in IncidentReportForm.tsx (e.g. 'By signing you certify this report is accurate; your signature is stored on this device for recordkeeping').
  - *Acceptance:* grep -in 'By signing\|certify' src/components/safety/IncidentReportForm.tsx returns a line adjacent to the SignaturePad render (~line 668).
- [x] **LG-M2-T2** Add the standard advisory disclaimer ('AI suggestions are not a substitute for a competent safety assessment') to JhaForm.tsx near the Sage document-parse and suggest-jha result UI.
  - *Acceptance:* grep -in 'not a substitute\|advisory' src/components/safety/JhaForm.tsx returns at least one hit in the Sage sections.
- [x] **LG-M2-T3** Add a privacy-policy link/notice to the public beta signup form near the submit button in src/app/beta/page.tsx.
  - *Acceptance:* grep -n '/privacy' src/app/beta/page.tsx returns a link rendered within the signup form.

### 12. UX-M1 — Landmark structure and skip navigation
*Dimension: UX · flips: UX-8 · why here: skip link + landmark structure: cheap, and must land before the axe suite so UX-M3's scans pass first try.*

- [x] **UX-M1-T1** Add a visually-hidden-until-focused skip link as the first element inside <body> in src/app/layout.tsx (e.g. 'Skip to content' targeting #main), styled with the existing focus-visible ring tokens.
  - *Acceptance:* grep -riE 'skip.?(to|content)' src/app/layout.tsx returns the link; tabbing once on any route focuses it and activating it moves focus to the main landmark.
- [x] **UX-M1-T2** Give every page route exactly one <main id="main"> landmark: wrap SafetyDashboard, all /safety/* pages (ptp, jha, incident, permits/*, history, record/[id], review/action), /inspections, /beta, /admin/beta content in <main>, and add id="main" to the existing mains (equipment, work-orders, inspect, terms, privacy, labels, ~offline, not-found, error).
  - *Acceptance:* For each src/app/**/page.tsx (excluding api), grep '<main' in the page or its top-level rendered component returns exactly one match; no route renders two mains (check EquipmentProfile/InspectLanding are not double-wrapped).

### 13. UX-M2 — Offline identity continuity beyond 72 hours
*Dimension: UX · flips: UX-9 · why here: extend/degrade the offline identity window: one-module change that the airplane-mode spec depends on (a locked-out identity fails offline capture).*

- [x] **UX-M2-T1** Extend IDENTITY_TTL_MS in src/lib/identity.ts to 30 days and add a 'verify when online' soft-stale state (e.g. isIdentityAging() after 72h) that AuthGate renders as a warning banner while still allowing offline capture; update identity.test.ts for both windows.
  - *Acceptance:* grep IDENTITY_TTL_MS src/lib/identity.ts shows >=7-day TTL; npx vitest run src/lib/__tests__/identity.test.ts passes with a case asserting a 5-day-old identity is usable offline; AuthGate offline branch renders children (with warning) rather than the lockout screen for aged-but-valid identity.

### 14. UX-M3 — Automated accessibility and airplane-mode regression suite
*Dimension: UX · flips: UX-10 · why here: build the Playwright harness (axe scans + airplane-mode spec); this is the shared e2e foundation for the demo spec.*

- [x] **UX-M3-T1** Add playwright.config.ts (webServer: next build+start or dev, mobile viewport project e.g. Pixel 7) and an e2e/ directory; add @axe-core/playwright devDependency and a package.json script test:e2e.
  - *Acceptance:* npx playwright test --list succeeds and package.json contains a test:e2e script.
- [x] **UX-M3-T2** Write e2e/a11y.spec.ts running AxeBuilder against /, /equipment, /safety/ptp, and one /inspect/[id] page (using dev sign-in or the unauthenticated equipment routes) asserting zero serious/critical violations.
  - *Acceptance:* npm run test:e2e passes; grep AxeBuilder e2e/a11y.spec.ts hits all four routes and the assertion filters impact serious|critical.
- [x] **UX-M3-T3** Write e2e/offline.spec.ts: load a form page, call context.setOffline(true), fill and submit a pre-trip inspection or PTP, and assert the record exists in localStorage with pending sync status and the pending-sync badge appears in the tab bar.
  - *Acceptance:* npm run test:e2e passes; the spec contains setOffline(true), a form submit, and a localStorage assertion on the persisted record's pending state.
- [x] **UX-M3-TX1** Wire the new Playwright suites (axe scans, airplane-mode spec, and later DM-M3's demo spec) into .github/workflows/ci.yml so they gate merges alongside tsc/lint/test/build.
  - *Acceptance:* ci.yml contains a job running the Playwright specs; the workflow file parses (yaml) and references the same npm script the criteria use.

### 15. DM-M3 — Machine-rehearsable inspection happy path
*Dimension: MVP Demo Readiness · flips: DM-10 · why here: machine-rehearsable inspection happy path reusing UX-M3's harness; asserts the notify banner including the 'skipped' no-key path.*

- [ ] **DM-M3-T1** Add scripts/demo/rehearse-inspection.mjs (core playwright, same pattern as record-demo.mjs but WITHOUT the failure-swallowing safe() wrapper): dev sign-in -> goto /inspect/<pre-trip id> -> fill inspector name -> Start Inspection -> tap Pass on every checklist item -> draw on the SignaturePad canvas via mouse events -> Submit -> assert the 'All Clear' result heading and a notifyStatus outcome (sent/skipped banner) appear; exit 1 on any missing element. Document the run command in scripts/demo/README.md.
  - *Acceptance:* Against `ALLOW_DEV_LOGIN=1 npm run dev`, `node scripts/demo/rehearse-inspection.mjs` exits 0 after asserting the result screen; killing any step (e.g. wrong selector) makes it exit non-zero (DM-10 howToVerify passes).

### 16. DM-M2 — Presenter demo runbook in docs/
*Dimension: MVP Demo Readiness · flips: DM-9 · why here: presenter demo runbook written only after DM-M1/DM-M3 finalize the exact flows and env flags it documents.*

- [ ] **DM-M2-T1** Write docs/DEMO-SCRIPT.md: (1) pre-demo checklist — env flags to set (ALLOW_DEV_LOGIN=1, NEXT_PUBLIC_AI_ASSIST=1 + ANTHROPIC_API_KEY, RESEND_API_KEY + EHS_NOTIFY_EMAIL), how to reset device state via UserMenu 'Delete all local data', and which /inspect/[id] QR/URL to preload; (2) a numbered 15-minute step sequence: sign in -> dashboard -> scan pre-trip QR (/inspect/[id]) -> equipment profile -> checklist with one staged critical fail -> signature -> result + 'EHS has been notified' -> /inspections history + CSV export -> /admin/labels print view -> Sage triage question -> airplane-mode submit + reconnect sync; (3) a recovery section covering refresh (draft restores), failed EHS email (queued banner wording), and wrong-tap back-navigation. Link it from README's demo row.
  - *Acceptance:* docs/DEMO-SCRIPT.md exists, contains '/inspect/', names all four env flag groups, has a numbered step list covering QR->equipment->inspection->signature->EHS email->admin/history, and a recovery section with >= 3 mid-demo recovery actions (DM-9 howToVerify passes).

### 17. ES-M1 — Dark infra: hardened provider, storage migration, gates, kill switch
*Dimension: Spanish Language Support · flips: ES-1, ES-2, ES-3, ES-4 · why here: dark i18n infra lands after the Playwright harness exists (UX-M3) so leakage specs can follow immediately; zero user-visible change*

- [ ] **ES-M1-T1** Restore src/lib/i18n.tsx from d20573d with fixes: split/join interpolation (all occurrences), Intl.PluralRules .one/.other variant selection, dev-only missing-key/unreplaced-var console.warn, t(key, vars, defaultEn?) overload, STORAGE_KEY='sage-locale-v2', useState('en') + useLayoutEffect storage read (synchronous pre-paint re-render — no initializer localStorage read, no one-frame English flash; fall back to useEffect only if jank is measured on low-end devices).
- [ ] **ES-M1-T2** Edit src/app/layout.tsx inline head script: delete removeItem('sage-locale') and add pre-paint document.documentElement.lang stamping from sage-locale-v2; add suppressHydrationWarning to <html>; keep sage-theme logic behaviorally identical (DS-2).
- [ ] **ES-M1-T3** Add scripts/gen-i18n-keys.mjs generating src/lib/i18n-keys.d.ts union type from en.json; wire t()'s key param to it.
- [ ] **ES-M1-T4** Create src/messages/en.json re-extracted from HEAD for cluster-1 keys only (seed key names from d20573d map; verify strings against current components — 'returned by EHS', 'SDS Library'); es.json with identical key set, values pending ES-M2 (gate allows empty catalogs only via an explicit 'pending-translation' manifest that must be empty by ES-M2).
- [ ] **ES-M1-T5** Add /api/i18n/status route returning {esEnabled, suppressedNamespaces[]} from Upstash KV (keys i18n:es-enabled default true, i18n:suppressed-namespaces default [], no console.*) + NetworkOnly matcher entry in sw.ts + provider fetch on mount AND on visibilitychange/foreground (field PWAs stay open whole shifts) with localStorage last-known-good 'sage-i18n-flag-v1'.
- [ ] **ES-M1-T6** Add src/lib/__tests__/i18n-catalog.test.ts (parity, zero-placeholder, var-parity, plural-parity, keygen freshness) and sw-i18n-invariants.test.ts (no skipWaiting:true; no removeItem('sage-locale-v2'); theme stamping present; LG-6/LG-8 literal greps; no locale prefix in NAV_ITEMS hrefs).
- [ ] **ES-M1-T7** Add .eslintrc.json overrides scaffold with no-restricted-syntax JSXText rule and an empty files glob (ratchet starts closed).
- [ ] **ES-M1-T8** Wire I18nProvider into layout.tsx providers with NO toggle anywhere; add unit tests for resolve/interpolate/plural fallback chains.

*Milestone acceptance:* npm run lint && tsc && vitest && next build all green; grep -c "sage-locale'" src/app/layout.tsx returns 0 and grep 'sage-locale-v2' src/app/layout.tsx returns the lang-stamp line; grep -rn 'skipWaiting: true' src/app/sw.ts returns nothing; grep -rn 'Español\|setLocale' src/components/UserMenu.tsx returns nothing (toggle absent); Playwright smoke: rendered pages byte-identical English, html[lang='en'].

### 18. ES-M2 — Glossary + pipeline + cluster 1 (shell/nav/auth/offline/errors/dashboard) translated dark
*Dimension: Spanish Language Support · flips: ES-5 · why here: glossary + pipeline + first cluster dark; proves the translation machinery before safety-critical content*

- [ ] **ES-M2-T1** Author docs/i18n/glossary.json (~100 term pairs MINED FROM THE ACTUAL APP SURFACE — src/data/*, safety components: fire watch, tie-off, guardrail, lockout/tagout etc. — mapped to mandated neutral-LatAm Spanish; register rules: usted, imperative, <=6th-grade reading; forbidden regionalisms/Iberian forms; do-not-translate list: regRefs, OSHA/Cal-OSHA, brand, model numbers) via generation agent + 5-lens adversarial review; write docs/i18n/review/glossary.json evidence; generate the bilingual sign-off packet and a PENDING entry in docs/i18n/signoff.json — owner counter-signs asynchronously; sign-off gates ONLY the '(beta)' label removal, never milestone or criterion acceptance.
- [ ] **ES-M2-T2** Extract cluster-1 strings from HEAD (nav.ts, BottomTabBar, NavHeader, TabNav, UserMenu, AuthGate, SwUpdateBanner, SyncToast, StorageAlert, PullToRefresh, ConfirmDialog, error.tsx, not-found.tsx, ~offline/page.tsx, SafetyDashboard) into en.json; convert components to t()/labelKey (text nodes only — no className/htmlFor/min-h churn per UX-2/UX-4/DS-4).
- [ ] **ES-M2-T3** Translate cluster-1 es.json per pipeline; commit docs/i18n/review/{common,nav,user,dashboard,sync,update,confirm}.json with zero FAILs; empty the pending-translation manifest.
- [ ] **ES-M2-T4** Encode the pipeline termination rule in docs/i18n/PIPELINE.md and tests: max 3 regenerate/re-review rounds per key; after 3 failures the key stays as exact English fallback and is logged in docs/i18n/blocked-keys.json (size-capped, adversarially audited) — a blocked key either blocks its namespace's exposure or lives in the documented leakage-spec allowlist, never both silently.
- [ ] **ES-M2-T5** Widen eslint override glob to the converted files; add playwright/es-leakage.spec.ts (addInitScript sage-locale-v2='es') covering /, /safety, error and offline pages + en-pin.spec.ts protecting DM-10's English assertions.
- [ ] **ES-M2-T6** Route SwUpdateBanner/SyncToast/StorageAlert strings through t() while keeping the 'offline as {name}' interpolation var intact (UX-6).
- [ ] **ES-M2-T7** Add dark-invariance snapshot tests: converted components render byte-identical English before/after t() wiring while the toggle is absent (turns 'dark means invisible' from a claim into an asserted invariant).

*Milestone acceptance:* vitest catalog tests green with zero es placeholders and full parity; docs/i18n/review/*.json exist, cover every cluster-1 key, contain zero FAIL; docs/i18n/signoff.json has a dated glossary packet entry (pending or signed — sign-off never blocks); playwright es-leakage.spec passes on cluster-1 routes (html[lang='es'], zero English sentinels) AND en-pin.spec passes; production UI still shows no toggle (grep UserMenu for setLocale returns nothing).

### 19. ES-M3 — Safety forms + checklist data lookasides + record locale stamping (dark)
*Dimension: Spanish Language Support · flips: ES-6 · why here: safety forms are the highest-value Spanish surface; still dark, sign-off packets flow asynchronously*

- [ ] **ES-M3-T1** Convert PreTaskPlanForm, JhaForm, FormStepper, FormSuccess, HazardTable, ChipMultiSelect, PPESelector, CrewSignatureBlock, SignaturePad, ValidationSummary, LastUsedChip, IncidentReportForm + the three permit forms + PermitChecklist/PermitTimer/PermitStatusBadge to t(), keeping LG-6 signature-consent English literals inline via the defaultEn overload.
- [ ] **ES-M3-T2** Create src/messages/data/{inspections,permits,ppe,hazards}.es.json id-keyed lookasides; render checklist/permit labels by id at render time; add mapEs() insertion-time translation for PTP_HAZARD_LIBRARY and HEIGHT_ACCESS_METHODS/HOT_WORK_TYPES/CONFINED_SPACE_HAZARDS (no schema change).
- [ ] **ES-M3-T3** Translate all client validation messages and atmo-check.ts gas-reading messages.
- [ ] **ES-M3-T4** Stamp record.locale at signing in inspections.ts and the safety form submit paths; extend the orphan-id vitest to the new lookasides.
- [ ] **ES-M3-T5** Run pipeline + commit review evidence for ptp/jha/permits/incident/hazard/validation namespaces; generate the bilingual sign-off packet and a PENDING entry in docs/i18n/signoff.json — owner counter-signs asynchronously; sign-off gates ONLY the '(beta)' label removal, never milestone or criterion acceptance. Add the strict-equality vitest anchor: en catalog values for signature-consent and AI-disclaimer keys must === the exported English constants remaining in CrewSignatureBlock/Sage source (stronger LG-6/LG-8 guard than grep).
- [ ] **ES-M3-T6** Widen eslint glob; extend es-leakage.spec to /safety/ptp, /safety/jha, /safety/permits/*, /safety/incident.

*Milestone acceptance:* vitest green including packet-integrity test (every safety namespace has committed review evidence whose hash matches its catalog content; owner signature NOT required for acceptance); grep -n 'By signing' src/components/safety/CrewSignatureBlock.tsx still matches (LG-6 preserved); es-leakage.spec green on all safety form routes; UX-2/UX-4 verifies unaffected (grep min-h-\[44px\] and htmlFor counts unchanged vs pre-milestone snapshot recorded in the review evidence).

### 20. ES-M4 — Inspections, equipment/work-orders/training UI, records/history/share, dates, bilingual QR labels (dark)
*Dimension: Spanish Language Support · flips: ES-7 · why here: inspection flow + records + dates + bilingual QR labels complete the worker-facing surface dark*

- [ ] **ES-M4-T1** Convert PreTripInspection, InspectLanding, inspections/inspect pages; render checklist item labels by id in the viewer's locale for live flow and in record.locale for saved records.
- [ ] **ES-M4-T2** Convert RecordView, SafetyHistory, SafetyRecordCard, ReviewStatusSection/Badge, SyncQueuePanel + history/record/review pages; RecordView renders in record.locale; localize record-share.ts text and replace its hardcoded en-US dates.
- [ ] **ES-M4-T3** Replace the 16 hardcoded en-US toLocale* call sites with a locale-aware src/lib/datetime helper (Intl.DateTimeFormat(locale)); add a non-hook getT(locale) for lib code (ptpDayLabel, record-share).
- [ ] **ES-M4-T4** Convert EquipmentProfile, EquipmentCard, PMSchedule, PmTracker, WorkOrderBoard/Card, TrainingTracker/Info, ComplianceInfo, StatusToggle + pages; make QRLabel print static bilingual EN/ES text ('SCAN BEFORE OPERATING / ESCANEE ANTES DE OPERAR') with URLs unchanged.
- [ ] **ES-M4-T5** Pipeline + review evidence + pending sign-off packets for inspect/record/history/review/types namespaces; widen eslint glob; extend both Playwright specs to /inspect/[id], /equipment/[id], /work-orders, /safety/history.

*Milestone acceptance:* es-leakage.spec green on inspection/equipment/record routes; grep -rn '/es/' src/lib/nav.ts src/app returns nothing and /inspect/[id] still uses generateStaticParams with zero client fetch (UX-7/DM-3 re-verified); vitest asserts a record saved with locale:'es' renders its checklist labels from the es lookaside while an en record renders English; QRLabel snapshot test contains both languages.

### 21. ES-M5 — Sage locale, FAQ/pattern Spanish matching, equipment.ts prose batch (dark)
*Dimension: Spanish Language Support · flips: ES-8 · why here: Sage AI + canned content + equipment prose; the long-tail translation batch*

- [ ] **ES-M5-T1** Add locale to the Sage triage request and one SYSTEM_PROMPT line (src/app/api/sage/triage/route.ts:13: respond in the user's app language); pass locale to suggest-hazards/suggest-jha/audit-ptp so inserted form text matches form locale; document that AI-inserted Spanish falls under the review pipeline via a runtime 'AI-generated' provenance already implied by LG-8 disclaimers.
- [ ] **ES-M5-T2** Translate sage-faq.ts 12 canned answers + add Spanish keyword pattern arrays; add incident-patterns.ts Spanish keyword arrays + translated root-cause/why-chain/corrective-action display strings via lookaside; vitest asserts every en pattern has a non-empty es keyword set.
- [ ] **ES-M5-T3** Translate src/messages/data/equipment.es.json — 46 items x ~9 PM/Cal-OSHA fields keyed by itemNumber+field, batched ≤50 strings through the full 5-lens pipeline; whole-card English fallback when an item id is missing (never per-field mixing: fallback granularity is the full item).
- [ ] **ES-M5-T4** Convert onboarding tour engine strings (ModuleTourEngine, OnboardingTour, HelpButton) or explicitly defer with an eslint-glob exclusion note in docs/i18n/coverage.md.
- [ ] **ES-M5-T5** Pending sign-off packets for sage/equipment-prose namespaces (async, non-blocking); record bundle-size delta (next build output) in the review evidence.

*Milestone acceptance:* vitest green: es keyword sets non-empty for all sage-faq/incident patterns; equipment lookaside orphan-id test green with zero placeholders; grep -n 'locale' src/app/api/sage/triage/route.ts matches the prompt line; EN-7 guard green (no console.* in src/app/api); gzipped main-bundle delta recorded and < 60KB vs ES-M1 baseline.

### 22. ES-M6 — Exposure: full leakage sweep, complete sign-off, ship the toggle
*Dimension: Spanish Language Support · flips: ES-9, ES-10 · why here: exposure only after the full-fleet leakage sweep is green; toggle ships as Español (beta) pending owner counter-signature*

- [ ] **ES-M6-T1** Extend es-leakage.spec to EVERY route in src/app (worker-facing) with the sentinel allowlist (regRefs, brand, legal pages excluded as documented English-canonical); run full suite.
- [ ] **ES-M6-T2** Verify review-packet coverage is complete for all safety-critical namespaces (the packet-coverage vitest enumerates them); generate the final consolidated bilingual audit packet docs/i18n/review/final-audit.md for the owner's asynchronous counter-signature.
- [ ] **ES-M6-T3** Add the locale toggle to UserMenu ('English' / 'Español (beta)' — native-language labels, aria-labels translated), rendered only when the runtime flag is enabled; add a one-time non-blocking '¿Prefiere español?' prompt for navigator.language es* users; add the beta-guard vitest: the '(beta)' suffix may only be removed when docs/i18n/signoff.json fully covers the safety-critical namespace manifest (owner sign-off gates the label, not the loop).
- [ ] **ES-M6-T4** Write docs/i18n/OPERATIONS.md with the FOUR-tier rollback runbook: (1) global KV kill switch i18n:es-enabled=false (minutes, no deploy); (2) per-namespace suppression via i18n:suppressed-namespaces (one bad permit string drops only that surface to English); (3) per-key retreat (delete the es key — exact tested en fallback, no component changes); (4) fix-forward regenerate→5-lens re-review→re-packet. Plus storage-key versioning policy (v3 ignores v2; never another purge-on-every-load).
- [ ] **ES-M6-T5** Final /goal review sweep: confirm DM-10/UX-10 en-pin specs, DS-2, UX-2/UX-4, LG-1/LG-6/LG-8, UX-7 verifies all still pass.

*Milestone acceptance:* playwright es-leakage.spec green on ALL worker-facing routes and en-pin.spec green; packet-coverage vitest green (every safety namespace has audited review evidence); beta-guard vitest green; grep -n 'Español (beta)' src/components/UserMenu.tsx matches; Playwright: toggle to es persists across reload via sage-locale-v2, html[lang='es'] pre-paint, KV flag=false hides toggle and forces English on next foreground.

### 23. EN-M1 — Dependency hygiene: triage and document supply-chain posture
*Dimension: Enterprise Readiness · flips: EN-3 · why here: dependency audit triage once the dependency set has stabilized (after Playwright/axe additions), so the audit doc doesn't immediately go stale.*

- [ ] **EN-M1-T1** Run `npm audit fix` (non-breaking) to clear the fixable prod advisories (brace-expansion in @serwist), commit the updated package-lock.json, and re-run `npm run test` + `npm run build` to confirm no regression.
  - *Acceptance:* `npm audit --omit=dev` no longer lists brace-expansion; vitest suite and next build pass.
- [ ] **EN-M1-T2** Create docs/DEPENDENCY-AUDIT.md: a table of every remaining high/critical GHSA id from `npm audit --omit=dev` (the next@14.2.35 advisory set, next-auth/uuid chain) with dated risk-acceptance rationale (Vercel-managed hosting mitigations, no self-hosted image optimizer, upgrade plan to Next 15/16) and a review-by date. Link it from SECURITY.md.
  - *Acceptance:* Every GHSA id printed by `npm audit --omit=dev` at high/critical severity appears in docs/DEPENDENCY-AUDIT.md with a date; SECURITY.md references the file.

### 24. LG-M3 — Third-party license notices artifact
*Dimension: Legal · flips: LG-10 · why here: third-party license notices generated from the same final dependency tree as EN-M1; automate with a license checker.*

- [ ] **LG-M3-T1** Add THIRD_PARTY_NOTICES.md at repo root listing all 11 production dependencies with license identifier and copyright line (optionally generated by a small scripts/ generator reading package.json + node_modules).
  - *Acceptance:* THIRD_PARTY_NOTICES.md exists at repo root and its dependency list matches Object.keys(package.json dependencies) exactly; no GPL-family license appears.

### 25. DS-M1 — Tokenize every screen color (kill raw hex and default-palette classes)
*Dimension: Design · flips: DS-3 · why here: tokenize all remaining raw colors; must precede any further visual polish and finishes with an axe contrast re-run.*

- [ ] **DS-M1-T1** Retheme src/app/safety/review/action/page.tsx from 36 hardcoded dark hex classnames to token classes (bg-mytra-bg, text-fg, inputCls from src/lib/form-styles), removing the off-token hover:bg-[#4722CC] in favor of bg-mytra-purple/hover token, so the page renders correctly in light theme.
  - *Acceptance:* grep -En '\[#[0-9A-Fa-f]{3,8}\]' src/app/safety/review/action/page.tsx returns 0 lines; page renders with correct fg/bg in both data-theme values.
- [ ] **DS-M1-T2** Replace the 10 default-palette classes in IncidentReportForm.tsx (CATEGORY_COLORS/CONTROL_LEVEL_COLORS text-blue-400 etc.) with CSS-variable-backed tokens added to globals.css with values in both dark and light blocks; also replace AuthGate.tsx:143 bg-[#572DFF] with bg-mytra-purple and :174 text-gray-900 with a token.
  - *Acceptance:* Both DS-3 greps (arbitrary hex + default palette) over src/app+src/components excluding beta/QRLabel/SignaturePad return 0 lines.

### 26. DS-M2 — Type scale and shared button primitive
*Dimension: Design · flips: DS-4, DS-6 · why here: unified type scale + shared Button primitive on top of the completed token layer.*

- [ ] **DS-M2-T1** Pick one page-title scale (recommend text-xl font-bold text-fg, the SafetyDashboard/inspections pattern) and apply it to every top-level page h1: equipment, work-orders, admin/labels, privacy, terms, error, not-found, ~offline, safety/review/action, admin/beta.
  - *Acceptance:* grep -rEon '<h1 className="[^"]*"' src/app src/components --include='*.tsx' | grep -v beta/page | size-class tally yields exactly 1 variant.
- [ ] **DS-M2-T2** Add btnPrimaryCls/btnSecondaryCls exports to src/lib/form-styles.ts (or a src/components/ui/Button.tsx) encoding the canonical primary button (bg-mytra-purple text-white hover:bg-mytra-purple-hover rounded-lg min-h-[44px] press-scale + focus ring).
  - *Acceptance:* grep -n 'btnPrimaryCls' src/lib/form-styles.ts returns the export; npx tsc --noEmit passes.
- [ ] **DS-M2-T3** Migrate the 31 files with inline 'bg-mytra-purple ... text-white' button literals to the shared primitive (mechanical sweep; keep per-site width/margin additions as appended classes).
  - *Acceptance:* grep -rn 'bg-mytra-purple' src --include='*.tsx' | grep 'text-white' hits only src/lib/form-styles.ts (or Button.tsx).

### 27. DS-M3 — Printable signed pre-trip inspection record
*Dimension: Design · flips: DS-9 · why here: printable signed pre-trip record; benefits from DS-M2's primitives and pairs with the (recommended) server-side inspection persistence gap work.*

- [ ] **DS-M3-T1** Add a completed-inspection record view (route e.g. src/app/inspections/record/[id]/page.tsx or a post-submit record panel in PreTripInspection) that renders the signed inspection with the existing print-doc-header/print-doc-meta/print-sig-row classes from globals.css and a Print button calling window.print(), mirroring RecordView.tsx:269-272.
  - *Acceptance:* grep -rln 'window.print' src --include='*.tsx' includes an inspections surface; completing an inspection then printing shows the formal header, checklist results, operator signature, and sig lines in print preview.

### 28. DS-M4 — Branded link previews (OG/Twitter)
*Dimension: Design · flips: DS-10 · why here: OG/Twitter branded previews: pure external polish with zero dependencies, safe to do last.*

- [ ] **DS-M4-T1** Add openGraph (title, description, siteName, type) and twitter (card: summary_large_image) fields to the metadata export in src/app/layout.tsx, plus src/app/opengraph-image.tsx using next/og ImageResponse with the Sage wordmark, EHS badge, and token colors (#0A0A0A bg, #572DFF accent). Optionally a beta-specific one under src/app/beta/.
  - *Acceptance:* grep -n 'openGraph' src/app/layout.tsx returns the field; find src/app -name 'opengraph-image*' returns the file; next build emits the /opengraph-image route.

## Beyond the rubrics — backlog (owner decision needed to promote)

The completeness critic found material workstreams outside the frozen rubrics. Impersonation hardening
was folded into EN-M4-TX1, CI enforcement into UX-M3-TX1, and Spanish support was PROMOTED into the
`spanish` dimension. The rest need a product/owner decision before the loop may touch them:

- Identity assurance / impersonation: src/lib/auth.ts (lines 74-85) lets anyone holding the single shared EMAIL_LOGIN_CODE sign in as ANY allowed-domain email — including an ADMIN_EMAILS address — with a freeform name. This undermines LG-7's 'server-verified submitter' claim on signed OSHA inspections and makes EN-9 RBAC spoofable (roles resolve from a self-asserted email). No criterion requires per-user credentials, email verification, or admin-login step-up. Absorb into ENTERPRISE (new criterion alongside EN-9/EN-10) with a LEGAL note on LG-7's wording.
- Server-side durability of inspection records: pre-trip inspections live only in device localStorage (src/lib/inspections.ts) plus a one-shot email PNG — there is no Notion/KV sync path like safety records have (src/lib/safety-sync.ts covers safety records only). A cleared browser or lost phone destroys OSHA daily-inspection history, and EHS has no fleet-wide inspection view across devices. EN-5's CSV export only exports the local device's data. Absorb into BACKEND (sync inspections server-side) with ENTERPRISE retention implications.
- Cross-device data model for work orders / PM / training: src/lib/work-orders.ts and shop-management.ts are localStorage-only, so a work order created on one mechanic's phone is invisible to everyone else — an embarrassing discovery in any multi-user pilot demo. No criterion in any dimension tests multi-device visibility of operational records. Absorb into BACKEND (or explicitly document single-device scope in README/demo script if deferred).
- PWA service-worker update lifecycle: no criterion covers how deployed updates reach installed clients (skipWaiting/clients.claim/update-available prompt). A stale Serwist SW can pin field devices to an old checklist or broken code after a fix ships — directly undermines the 10/10 loop since fixes may never reach the verifying client. Absorb into UX (offline/PWA area) or DEMO.
- Prompt-injection and AI-output handling: JhaForm's parse-document feeds user-uploaded file content into Anthropic prompts and pipes suggestions back into safety-critical form fields; no criterion covers injection hardening, output length/schema constraints on what gets written into records, or sanitization of AI text rendering. LG-8 covers disclaimers only. Absorb into BACKEND (Sage/parse-document routes).
- PII hygiene in telemetry and Slack: no criterion verifies that worker names, emails, or signature data are excluded/scrubbed from Sentry events (client and server), Slack notifications, and the structured logs EN-7 will introduce — EN-7 as written could even increase PII in logs. Absorb into ENTERPRISE (EN-7 should specify PII-safe field allowlist) with LEGAL cross-reference in LG-4.
- Data-subject deletion / worker offboarding: the app stores worker PII in KV (known-users), Notion pages, Resend/Slack archives, and devices, but no criterion requires an actual deletion procedure or endpoint when an employee leaves or requests erasure — the privacy policy rewrite (LG-M1) will otherwise promise rights with no implementation. Absorb into LEGAL (policy truthfulness) + ENTERPRISE runbook (EN-10 could add a deletion procedure).
- CI as an enforced gate: .github/workflows/ci.yml exists and runs tsc/lint/test/build, but no criterion pins it — nothing requires the new Playwright suites (UX-10, DM-10) to run in CI, or branch protection so the autonomous loop can't merge a red build. Absorb into DEMO (extend DM-1) so the loop's own changes stay verified.
- Spanish-language support: US construction crews are heavily Spanish-speaking and OSHA expects training/safety communication in a language workers understand; the app is English-only with no i18n criterion anywhere. Absorb into UX as an explicitly-scoped post-pilot criterion (or a documented exclusion) so the roadmap makes a conscious decision rather than an omission.  [PROMOTED 2026-07-06 → dimension `spanish`, milestones ES-M1..M6]
