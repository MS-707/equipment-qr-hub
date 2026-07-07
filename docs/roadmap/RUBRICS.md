# Frozen Scoring Rubrics — 2026-07-06

Sixty binary criteria (10 per dimension) define what 10/10 means. **Score = count of met
criteria — no curving.** Authored by six independent reviewer agents, adversarially audited
(2 claims overturned, 7 criteria refined for objectivity — marked *refined*), then frozen.
Criteria change only via `/goal review` with a logged justification.

## UX (`ux`) — 7/10 at freeze

### UX-1 ✅
Offline-first capture on every field form: all six safety forms and the pre-trip inspection persist submissions to device storage synchronously (no network dependency), and sync/notify listeners are installed in the root layout so queued records upload on the 'online' event from any route.

**Verify:** Confirm src/app/layout.tsx mounts SyncProvider wrapping all children, and src/components/providers/SyncProvider.tsx calls installSyncListeners() and installNotifyListeners(); confirm submit paths in safety forms/PreTripInspection write to local stores (safety-records.ts / inspections.ts) before any fetch.

### UX-2 ✅ *(refined)*
Glove-friendly touch targets: the bottom tab bar reserves >=56px row height (--tab-bar-h in globals.css used by BottomTabBar), and every <button>, <a>, and <select> rendered inside PreTripInspection.tsx, ConfirmDialog.tsx, WorkOrderBoard.tsx, FormStepper.tsx, and the six safety form components declares an effective hit area >=44px in both axes via min-h-[44px]/min-w, explicit w-11 h-11 (or larger), or padding that computes to >=44px — verified by enumerating each interactive element in those files, not by grep count alone.

**Verify:** Enumerate every <button>, <a>, <select> in PreTripInspection.tsx, ConfirmDialog.tsx, WorkOrderBoard.tsx, FormStepper.tsx and the six safety form components; each has an effective >=44px hit area in both axes (min-h-[44px]+min-w, w-11/h-11 or larger, or padding that computes to >=44px). Also confirm --tab-bar-h >= 56px in globals.css and its use in BottomTabBar.tsx. Grep count alone is insufficient.

### UX-3 ✅
Draft persistence on all long forms: the six safety forms use useFormDraft (debounced save + pagehide/visibilitychange flush + restore banner with dismiss) and the pre-trip inspection has an equivalent per-equipment draft mechanism, so an interrupted worker never retypes a form.

**Verify:** grep useFormDraft over src/components — HotWork, Height, ConfinedSpace, JHA, PTP, IncidentReport forms all call it; src/lib/use-draft.ts flushes on pagehide and visibilitychange; PreTripInspection.tsx defines its own draft: key with the same flush behavior.

### UX-4 ✅
Mobile form ergonomics: numeric/decimal/search inputs declare inputMode, all six safety forms have programmatic label association (htmlFor/id) on their inputs, and a coarse-pointer CSS rule forces >=16px input font-size to block iOS focus zoom.

**Verify:** grep inputMode over src (hits in permit/PTP/inspection/search inputs); grep -c htmlFor per file in src/components/safety returns >0 for all six form files; globals.css contains the @media (pointer: coarse) input font-size: max(16px, 1em) rule.

### UX-5 ✅
No blank or dead-end screens: a root error.tsx with reset action, not-found.tsx and ~offline fallback page each link back into the app; every list view (equipment directory, work-order board, safety history) renders an explicit empty state with next-step guidance; client pages show skeletons before hydration.

**Verify:** Open src/app/error.tsx, not-found.tsx, ~offline/page.tsx and confirm recovery actions; confirm empty-state branches in equipment/page.tsx, WorkOrderBoard.tsx, SafetyHistory.tsx; confirm Skeleton usage in equipment page, SafetyDashboard, SafetyHistory, RecordView, EquipmentProfile.

### UX-6 ✅
Connectivity and sync state are always visible: the header shows an offline chip driven by online/offline events, the tab bar shows a pending-sync badge with screen-reader text, sync outcomes surface via an aria-live toast, and AuthGate shows an 'offline as {name}' banner when working on cached identity.

**Verify:** Inspect NavHeader.tsx offline listener + WifiOff chip; BottomTabBar.tsx pendingSyncCount dot with sr-only text; SyncToast.tsx role=status/alert with aria-live; AuthGate.tsx offline-with-cached-identity banner branch.

### UX-7 ✅
Scan-to-action speed: every pre-trip-required unit's /inspect/[id] page is statically generated at build (generateStaticParams), renders the checklist immediately from bundled data with zero client data fetch, warns when the unit is Out of Service, and non-inspectable units redirect to their profile instead of 404ing.

**Verify:** Confirm generateStaticParams in src/app/inspect/[id]/page.tsx filtered by requiresPreTrip; confirm InspectLanding renders PreTripInspection synchronously from props; confirm the Out of Service banner and the redirect(`/equipment/${id}`) branch.

### UX-8 ❌
Bypass blocks and landmarks (WCAG 2.4.1/1.3.1): the root layout renders a skip-to-content link as the first focusable element targeting the page's main landmark, and every page route exposes exactly one <main> landmark (directly or via its top-level component).

**Verify:** grep -riE 'skip.?(to|link|content)' src returns a skip link in layout.tsx; for each src/app/**/page.tsx (excluding api), grep '<main' in the page or its top-level rendered component returns exactly one match.

### UX-9 ❌
Offline identity continuity: a worker who signed in once is never locked out of safety forms by time alone while offline — the cached-identity window is >=7 days (or stale identity degrades to a warning state that still allows capture), verified by identity tests.

**Verify:** grep IDENTITY_TTL_MS src/lib/identity.ts shows a TTL >= 7 days, or AuthGate.tsx renders children (with a verify-when-online warning) when offline with a stale cached identity; src/lib/__tests__/identity.test.ts asserts the extended window.

**Autonomy note:** Default to the degrade-to-warning branch (still allows capture, smaller security surface); note the >=7-day-TTL alternative for the owner.

### UX-10 ❌
Automated UX regression guard: a Playwright config plus specs exist and run via an npm script — (a) an axe-core scan of at least /, /equipment, /safety/ptp and one /inspect/[id] page asserting zero serious/critical violations, and (b) an airplane-mode spec that submits a form with the browser context offline and asserts the record persists locally and queues for sync.

**Verify:** ls playwright.config.* at repo root succeeds; grep AxeBuilder and setOffline(true) in e2e specs; package.json contains a test:e2e script that runs them.

**Autonomy note:** Playwright: browsers preinstalled in remote env (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers — do NOT run playwright install); e2e sign-in via ALLOW_DEV_LOGIN=1 + dummy NEXTAUTH_SECRET in a committed .env.test.

## Design (`design`) — 4/10 at freeze

### DS-1 ✅
All Tailwind theme colors, radii, and shadows in tailwind.config.ts resolve to CSS custom properties that are defined in globals.css with values for BOTH [data-theme="dark"] and [data-theme="light"] blocks — zero literal color values in the Tailwind theme extension.

**Verify:** Read tailwind.config.ts theme.extend: every colors/borderRadius/boxShadow value matches var(--*). Then grep globals.css for each var name and confirm it appears in both the [data-theme="dark"] and [data-theme="light"] blocks (or :root with light overrides).

### DS-2 ✅
Theme switching is flash-free and complete: a pre-hydration inline script in layout.tsx sets data-theme from localStorage/prefers-color-scheme before paint, a user-facing light/dark/auto toggle exists, the meta theme-color is updated on switch, and color-scheme is set per theme in CSS.

**Verify:** layout.tsx <head> contains an inline script reading the theme key and stamping document.documentElement.dataset.theme; grep src/lib/theme.ts for meta[name="theme-color"] sync; grep globals.css for color-scheme in both theme blocks; UserMenu renders a theme control.

### DS-3 ❌
Semantic tokens are the only color source in app UI: grep -rE '\[#[0-9A-Fa-f]{3,8}\]' and grep -rE '(bg|text|border|ring)-(red|blue|green|yellow|purple|gray|zinc|slate|neutral|amber|orange|emerald|teal|cyan)-[0-9]{2,3}' over src/app+src/components (*.tsx) each return zero lines, exempting only src/app/beta/, QRLabel.tsx, and SignaturePad.tsx.

**Verify:** Run both greps with the three exemptions filtered out; both must return 0 lines. Exemptions: beta marketing page is a committed dark-only landing; QRLabel/SignaturePad emit physical-print/canvas output that requires literal black/white.

### DS-4 ❌ *(refined)*
Page-title typography is uniform: exactly one h1 size variant across route pages (a single base+sm: pair counts as one variant); beta landing and email-action screens excluded.

**Verify:** Page-title typography is uniform: enumerate the h1 rendered at the top of each route's page.tsx (or the dashboard component it delegates to) using a multiline-aware search (rg -U '<h1[^>]*className' across src/app/**/page.tsx plus the top-level dashboard components they render), extract font-size classes, and require exactly one size variant (a single base+sm: pair counts as one variant). Exclude the beta landing page and email-action confirmation screens.

### DS-5 ✅
Single icon system: every UI icon comes from lucide-react — no inline <svg> elements in any .tsx file and no second icon package (heroicons, react-icons, @mui/icons, feather) in package.json dependencies.

**Verify:** grep -rl '<svg' src --include='*.tsx' returns 0 files; grep package.json for heroicons|react-icons|@mui|feather returns nothing; spot-check imports are from 'lucide-react'.

### DS-6 ❌
Primary action buttons come from a shared primitive: a Button component (src/components/ui/) or exported button class constants (src/lib/form-styles.ts) exists, and grep for inline className literals combining bg-mytra-purple with text-white across src/app+src/components returns zero occurrences outside that primitive.

**Verify:** ls src/components/ui or grep buttonCls src/lib/form-styles.ts confirms the primitive; then grep -rn 'bg-mytra-purple' src --include='*.tsx' piped through a text-white filter must hit only the primitive file.

### DS-7 ❌ *(refined)*
No horizontal overflow at phone widths from fixed-width elements (glows, tables, cards).

**Verify:** No horizontal overflow at phone widths from fixed-width elements: rg -n '(^|[^a-z-])w-\[[0-9]{3,}px\]' src --include='*.tsx' (excluding min-w-/max-w- prefixed matches) — every hit must either (a) carry max-w-full or be sm:/md:-scoped, or (b) sit inside an ancestor with overflow-hidden/overflow-x-clip that bounds it to the viewport. Verify AuthGate and beta glows specifically.

### DS-8 ✅
Motion is centralized and accessible: all @keyframes live in tailwind.config.ts or globals.css (component files contain no @keyframes and no inline animation shorthand beyond animationDelay), and globals.css contains a global prefers-reduced-motion: reduce block clamping animation and transition durations.

**Verify:** grep -rn '@keyframes' src --include='*.tsx' returns 0; grep style={{...animation in tsx shows only animationDelay; globals.css contains @media (prefers-reduced-motion: reduce) with animation-duration/transition-duration overrides.

### DS-9 ❌
Every physical artifact the app produces has a print-formatted surface: QR labels print via a print-grid, safety records (PTP/JHA/permits/incidents) print via the formal print-doc layout with signature lines, AND a completed signed pre-trip inspection has a record view that calls window.print() using the same print-doc classes.

**Verify:** grep -rln 'window.print' src --include='*.tsx' must include admin/labels, safety RecordView, and an inspections record surface; drive: submit an inspection, open its record, print preview shows print-doc-header + print-sig content.

### DS-10 ❌
Link previews are branded: the root metadata export includes openGraph (title, description) and twitter card fields, and an OG image exists via src/app/opengraph-image.(tsx|png) or a metadata images reference to a file present in public/.

**Verify:** grep -rn 'openGraph' src/app/layout.tsx returns the field; find src/app -name 'opengraph-image*' (or the referenced public/ asset) returns a file; next build lists an /opengraph-image route or the static asset resolves.

**Autonomy note:** Generate src/app/opengraph-image.tsx programmatically from theme tokens + app name; no external assets (keeps CSP intact).

## Backend (`backend`) — 6/10 at freeze

### BE-1 ✅ *(refined)*
Every route.ts under src/app/api (currently 18 files; the NextAuth [...nextauth] passthrough delegates auth to NextAuth by design) enforces authn/authz before any work: session routes call requireSession/getServerSession first, admin routes (admin/health, beta/decide) additionally check isAdmin, and the only unauthenticated handlers are beta/signup (public by design, IP rate-limited) and safety/review/decide (HMAC-token authorized with 24h expiry + timingSafeEqual, no fallback secret).

**Verify:** Per-file check of all 18 src/app/api/**/route.ts files: session routes call requireSession/getServerSession before any work; admin routes additionally check isAdmin; the only unauthenticated handlers are beta/signup (public by design, IP rate-limited) and safety/review/decide (HMAC token, timingSafeEqual, no fallback secret); [...nextauth] delegates to NextAuth by design.

### BE-2 ❌
Durable rate limiting: every non-admin-only route handler calls rateLimit() before external side effects, keyed by session email (or platform-set IP for unauthenticated routes), backed by KV INCR+EXPIRE when KV_REST_API_URL is set, and returns 429 with a Retry-After header.

**Verify:** grep -rn 'rateLimit(' src/app/api — every route except auth passthrough and admin-only beta/decide + admin/health GET calls it; src/lib/rate-limit.ts uses kv.incr + kv.expire; rate-limit.test.ts passes.

**Autonomy note:** Verify KV-backed limiting with a mocked Upstash REST endpoint in vitest; production check is a documented human step.

### BE-3 ✅
Secrets fail closed: review-token signing throws without NEXTAUTH_SECRET/REVIEW_TOKEN_SECRET (no fallback), production email login requires EMAIL_LOGIN_CODE compared with timingSafeEqual, dev login is disabled when NODE_ENV=production, ADMIN_EMAILS is server-only (not NEXT_PUBLIC_), and admin/health reports booleans only — grep finds no hardcoded API keys in src.

**Verify:** Read src/lib/review-token.ts getSecret(), src/lib/auth.ts lines 36-50, src/lib/admin.ts; grep -rn 'sk-ant\|apiKey: .[A-Za-z0-9]' src returns nothing; admin/health route returns !! booleans only.

### BE-4 ✅
Every call to Anthropic, Notion, Resend, and Slack is wrapped in try/catch and maps failure to a structured JSON response or explicit degraded outcome: AI routes return 502 on Anthropic errors and 503 when ANTHROPIC_API_KEY is unset, Notion failures return 502/503 (never crash), email/Slack helpers return 'sent'|'not-configured'|'failed' and never throw.

**Verify:** Inspect each AI route's catch block (502 + log); safety/sync and review/submit Notion error paths; src/lib/email-notify.ts and slack-notify.ts catch-all returns; drive an AI route with ANTHROPIC_API_KEY unset and confirm 503 JSON.

### BE-5 ✅
KV data integrity uses atomic operations where concurrency exists: the beta signup index is maintained with SADD (not read-modify-write arrays, legacy array merged on read), review decisions take a SET NX lock so double-clicked approve/reject links are idempotent, first-login detection uses SADD return value, and every KV write of durable records carries a TTL.

**Verify:** Read src/lib/beta.ts addSignup/getAllIds, src/lib/review-store.ts decideReview lock, src/lib/user-tracker.ts isFirstLogin; confirm { ex: ... } on kv.set calls; beta.test.ts and review-store.test.ts pass.

### BE-6 ✅
Offline sync queues are retry-safe and poison-proof: safety-sync has per-record in-flight dedup, bounded backoff (1s/2s/4s), a 5-minute circuit breaker on 503 not-configured; the server dedups by record ID (query-before-create + pageId update path) so retries never duplicate Notion pages; the inspection notify queue is capped at 50, drops permanently-invalid 400 payloads, and abandons items after 3 attempts.

**Verify:** Read src/lib/safety-sync.ts (inFlight set, delays array, syncDisabledUntil) and src/lib/inspections.ts flushNotifyQueue (res.status===400 drop, NOTIFY_MAX_ATTEMPTS, cap); read the dedup query in src/app/api/safety/sync/route.ts; safety-sync.test.ts and inspections-notify-queue.test.ts pass.

### BE-7 ✅
Payload size and caching discipline: routes accepting large bodies enforce explicit limits (content-length 413 guards on safety/sync and review/submit at 512KB, parse-document base64 cap 4.2MB with 413, notify signature capped at 300KB by schema, sage message/context/history caps), and all /api/* responses carry Cache-Control: no-store.

**Verify:** grep -n 'content-length\|413' src/app/api/safety/sync/route.ts src/app/api/safety/review/submit/route.ts; parse-document route lines ~83-85; inspection-notify-schema.ts .max(300_000); next.config.mjs api headers block includes no-store.

### BE-8 ❌
Every API route that reads a JSON request body validates it with a zod schema via .safeParse before use (schemas may live in src/lib and be shared), and grep finds zero 'as <Type>' casts or typed-let coercions on await req.json() in src/app/api.

**Verify:** grep -rn 'safeParse' src/app/api src/lib — every body-reading route resolves to a zod safeParse; grep -rn 'await req.json()) as\|let body:' src/app/api returns nothing.

### BE-9 ❌ *(refined)*
No route can crash or hang on a dependency: every KV operation awaited inside a route handler path is guarded so a KV outage returns a structured JSON error (not an unhandled 500), and every outbound fetch to Notion/Resend/Slack in server code passes AbortSignal.timeout (or equivalent) so a hung upstream cannot pin the function.

**Verify:** grep -rn 'AbortSignal.timeout|signal:' src/app/api src/lib returns a hit for every outbound fetch to Notion/Resend/Slack/Anthropic; then statically confirm every awaited KV call reachable from a route handler (addSignup, updateSignupStatus, getAllSignups, storeReviewSubmission, getReviewSubmission, decideReview) is inside a try/catch (in the route or a wrapper) that maps a KV throw to a structured JSON error response.

### BE-10 ❌
Server errors reach Sentry: an instrumentation.ts exists with register() loading sentry.server.config (required for @sentry/nextjs v10 on Next 14) plus an onRequestError export using captureRequestError, and every route-handler catch block reports the error via Sentry.captureException (directly or through a shared helper) in addition to console.error.

**Verify:** find src -name 'instrumentation.ts' returns the file with register() and onRequestError; grep -rn 'captureException\|captureRequestError' src returns hits covering every catch block in src/app/api/**/route.ts.

**Autonomy note:** No SENTRY_DSN in loop env: assert via mocked @sentry/nextjs in unit tests + instrumentation.ts file-shape check.

## Enterprise Readiness (`enterprise`) — 4/10 at freeze

### EN-1 ✅
Every response carries a hardened header set: CSP (with frame-ancestors, base-uri, form-action), HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy are all emitted from next.config.mjs for source '/(.*)'.

**Verify:** Open next.config.mjs headers() — confirm all six headers on source '/(.*)' and CSP value contains frame-ancestors 'none', base-uri 'self', form-action 'self'.

### EN-2 ✅
SECURITY.md exists at repo root with a private disclosure channel (named email), an acknowledgment SLA in business days, a fix-target window, a scope statement, and a supported-versions statement.

**Verify:** Read SECURITY.md — confirm a contact email, a numeric acknowledgment SLA, a numeric fix window, a Scope section, and a Supported Versions section are all present.

### EN-3 ❌
Dependency hygiene: package-lock.json is git-tracked AND `npm audit --omit=dev` reports zero high/critical advisories, OR every high/critical advisory it reports appears by GHSA id in a git-tracked docs/DEPENDENCY-AUDIT.md with a dated risk acceptance rationale.

**Verify:** Run `git ls-files package-lock.json` (non-empty) and `npm audit --omit=dev`; if any high/critical remains, grep its GHSA id in docs/DEPENDENCY-AUDIT.md.

**Autonomy note:** npm audit needs registry access; transitively-unfixable advisories pass via dated GHSA risk-acceptance entries in docs/DEPENDENCY-AUDIT.md.

### EN-4 ✅
An admin-gated health endpoint exists at /api/admin/health that returns 401 to non-admins, live-probes KV connectivity (not just env presence), and reports configured/not-configured booleans for every integration (auth, Anthropic, Resend, Slack, Notion, Sentry-or-KV) without leaking secret values.

**Verify:** Read src/app/api/admin/health/route.ts — confirm isAdmin gate before payload, a kv.incr/ping call inside try/catch, and that all payload values are booleans/enums, never env values.

### EN-5 ✅
CSV export exists and is user-reachable for all three record classes: inspections, safety records (permits/PTPs/JHAs/incidents), and work orders — each has an exportToCsv-style function in src/lib and a UI handler that builds a Blob download.

**Verify:** Confirm exportInspectionsToCsv (lib/inspections.ts), exportSafetyToCsv (lib/safety-records.ts), exportToCsv (lib/work-orders.ts) each called from a page/component click handler that creates a text/csv Blob and anchors a download.

### EN-6 ❌
A git-tracked retention schedule document exists (docs/DATA-RETENTION.md or a Retention section in README/privacy page) that enumerates each data store (localStorage records, IndexedDB blobs, Upstash KV keys, Notion databases, Resend/Slack payloads) with a named retention period or deletion trigger per store — no store described only as 'follows your organization's policies'.

**Verify:** Grep the doc for each store name (localStorage, IndexedDB, KV/Redis, Notion) and confirm each row states a concrete period (e.g. '3 years', 'until user clears', '30 days') or deletion trigger.

### EN-7 ❌
Structured server logging: a shared logger module in src/lib emits single-line JSON with at least event, route, and outcome fields, and every file matching src/app/api/**/route.ts uses it — grep finds zero raw `console.` calls in src/app/api.

**Verify:** Run `grep -rn 'console\.' src/app/api --include=route.ts` (expect zero matches) and confirm src/lib/log*.ts JSON.stringify's a fields object including event and route.

### EN-8 ❌
Server-side audit log of privileged actions: beta approve/reject (api/beta/decide) and EHS review decisions (api/safety/review/decide) each append an entry {actor, action, target, at} to a persistent KV list/stream, and an admin-only GET endpoint (e.g. /api/admin/audit) returns recent entries; both writes covered by a test in src/lib/__tests__.

**Verify:** Grep beta/decide and review/decide routes for the audit append call; GET /api/admin/audit as non-admin returns 401, as admin returns JSON entries; `vitest run` includes an audit-log test file that passes.

### EN-9 ❌
RBAC beyond binary admin: a server-only module (src/lib/roles.ts or extended admin.ts) defines at least three roles (admin, ehs, worker) resolved from env allowlists, the NextAuth session callback exposes the role, at least one API route enforces the ehs (non-admin) role server-side, and README's Authorization section documents the role table (replacing the 'does not implement RBAC' statement).

**Verify:** Confirm the roles module exports a role-resolver used in lib/auth.ts session callback; grep an API route for the ehs-role check; README Authorization section lists all three roles and no longer contains 'does not implement role-based access control'.

**Autonomy note:** Ship the RBAC mechanism with .env.example placeholders; populating real role allowlists is an owner (mark.starr) step — criterion verifiable with test fixtures.

### EN-10 ❌
Enterprise operations docs exist and are git-tracked: (a) an SSO doc naming the provider seam in src/lib/auth.ts with step-by-step Okta and Microsoft Entra OIDC provider addition (exact env var names and callback URL /api/auth/callback/[provider]); (b) a runbook doc with numbered incident-response steps and KV + Notion backup/restore procedures including at least one concrete command or script path per store.

**Verify:** Grep docs/ for 'Okta' and 'Entra' hitting an SSO doc that cites src/lib/auth.ts; grep the runbook for 'restore' sections covering both KV (Upstash) and Notion with a command or scripts/ path each.

## MVP Demo Readiness (`demo`) — 7/10 at freeze

### DM-1 ✅ *(refined)*
All three production gates pass in the repo as committed: `npm test` exits 0, `npx tsc --noEmit` exits 0, and `npm run build` exits 0.

**Verify:** Run `npm test`, `npx tsc --noEmit`, and `npm run build` at HEAD; all three exit 0.

### DM-2 ✅ *(refined)*
Seed fleet is real, not placeholder: >=30 fully populated equipment items; empty manualUrl only with a documented sourcing note; zero placeholder-text matches in app/components/data.

**Verify:** Seed fleet is real, not placeholder: src/data/equipment.ts contains >= 30 equipment items with non-empty name, oemManual, manualUrl, and keyPmSummary (items documented as custom/unsourced may have empty manualUrl only if oemManual explains why), and zero matches for `grep -rin 'lorem\|coming soon\|placeholder text\|TBD\|NEED:' src/app src/components src/data` excluding documented sourcing notes. Verify with both the count grep AND `grep -n "manualUrl: ''" src/data/equipment.ts` (each hit must have an explanatory oemManual note).

### DM-3 ✅
Zero dead-end navigation: every internal href in NAV_ITEMS (src/lib/nav.ts) and QUICK_ACTIONS (SafetyDashboard) resolves to an existing page.tsx, and an unknown /equipment/[id] or /inspect/[id] renders the branded not-found page with a working Back to Home link.

**Verify:** Cross-check each internal href in src/lib/nav.ts NAV_ITEMS and SafetyDashboard QUICK_ACTIONS against `find src/app -name page.tsx`; confirm src/app/equipment/[id]/page.tsx and src/app/inspect/[id]/page.tsx call notFound() for unknown ids and src/app/not-found.tsx links to /.

### DM-4 ✅
The headline demo path is wired end-to-end in code: /inspect/[id] statically generates a QR landing for every pre-trip unit, submit is disabled until every item is answered AND a touch signature exists, the completed record POSTs to /api/inspections/notify which attaches the signature PNG to the EHS email, and the sent/queued/failed/skipped outcome is shown on the result screen.

**Verify:** Inspect src/app/inspect/[id]/page.tsx (generateStaticParams over requiresPreTrip), src/components/PreTripInspection.tsx (submit button `disabled={!allAnswered || !signature}`, fetch('/api/inspections/notify')), and src/app/api/inspections/notify/route.ts (attachments from signatureDataUrl); result step renders notifyStatus states.

### DM-5 ✅
Every optional integration degrades gracefully when its env vars are absent: KV (rate-limit falls back to in-memory Map; beta/user-tracker/review-store check hasKV), Resend (notify returns emailed:false 'not-configured' and the flow proceeds), Anthropic/AI (UI hidden unless NEXT_PUBLIC_AI_ASSIST=1; route returns 404/503, never crashes), and Sentry (dormant without DSN).

**Verify:** Confirm src/lib/rate-limit.ts branches on !process.env.KV_REST_API_URL; src/lib/{beta,user-tracker,review-store}.ts gate on KV_REST_API_URL; api/inspections/notify/route.ts returns {emailed:false, reason:'not-configured'} when !isEmailConfigured(); api/sage/triage/route.ts returns 404 without NEXT_PUBLIC_AI_ASSIST and 503 without ANTHROPIC_API_KEY; next.config.mjs applies withSentryConfig only when DSN set.

### DM-6 ❌
First-run sign-in works exactly as the quickstart documents: after `cp .env.example .env.local && npm run dev` with Google OAuth unset and ALLOW_DEV_LOGIN unset, the dev Credentials provider is registered in non-production, so the sign-in screen shows the name+email form instead of 'Sign-in is not configured yet'.

**Verify:** In src/lib/auth.ts, the dev Credentials provider must be registered when `!hasGoogle && !isProduction` even if ALLOW_DEV_LOGIN is unset (and a unit test in src/lib/__tests__/auth.test.ts asserts it); or run `npm run dev` with an empty .env.local and confirm GET /api/auth/providers includes a 'dev' provider.

### DM-7 ✅
PWA installability artifacts are complete and linked: manifest.json declares name, short_name, start_url, display standalone, and 192+512 icons in both any and maskable purposes; layout.tsx links the manifest and themeColor; the Serwist service worker builds to public/sw.js and precaches the /~offline fallback page.

**Verify:** Inspect public/manifest.json for the required fields and all four icon entries (files must exist in public/icons); grep src/app/layout.tsx for manifest:'/manifest.json' and themeColor; confirm next.config.mjs passes additionalPrecacheEntries [{url:'/~offline'}] to withSerwistInit and src/app/~offline/page.tsx exists.

### DM-8 ✅
Mid-demo mistakes are recoverable: an in-progress inspection auto-saves a draft (2s debounce plus synchronous flush on pagehide/visibilitychange) and restores after a refresh with a 'Start fresh' escape; a beforeunload guard is active during the checklist step; and the user menu offers a confirm-gated 'Delete all local data' reset for demo rehearsals.

**Verify:** Inspect src/components/PreTripInspection.tsx for draft restore on mount, flushDraft wired to pagehide/visibilitychange, and the beforeunload handler gated on step==='checklist'; inspect src/components/UserMenu.tsx for a ConfirmDialog that calls clearAllLocalData().

### DM-9 ❌
A presenter-facing live demo runbook exists in docs/ (e.g. docs/DEMO-SCRIPT.md) that a non-developer could follow: a pre-demo checklist naming the exact env flags to set (ALLOW_DEV_LOGIN, NEXT_PUBLIC_AI_ASSIST, ANTHROPIC_API_KEY, RESEND_API_KEY/EHS_NOTIFY_EMAIL), a numbered step sequence covering scan QR (/inspect/[id]) -> equipment -> checklist -> signature -> EHS email -> inspection history/CSV export, and a recovery section for refresh/offline/failed-email situations.

**Verify:** `ls docs/DEMO-SCRIPT.md` (or grep docs/ for a doc containing both '/inspect/' and a pre-demo env checklist); the doc must enumerate the full inspection happy path and at least three mid-demo recovery actions.

**Autonomy note:** Runbook documents the RESEND_API_KEY human step; criterion passes on the doc, not on live email.

### DM-10 ❌
The headline wow path is rehearsable by machine: a runnable Playwright script (scripts/demo/ or an e2e spec) drives sign-in -> /inspect/[id] -> answers every checklist item -> draws a signature on the canvas -> submits -> asserts the result screen and the notify outcome banner, exiting non-zero on any failed step.

**Verify:** A script exists whose page.goto targets include '/inspect/' and which interacts with the SignaturePad canvas and asserts the result step ('All Clear'/'Out of Service'); run it against `ALLOW_DEV_LOGIN=1 npm run dev` and confirm exit code 0.

**Autonomy note:** Email leg: assert the 'skipped/not-configured' outcome banner (no RESEND_API_KEY needed); real-inbox confirmation stays a documented human step in the runbook.

## Legal (`legal`) — 2/10 at freeze

### LG-1 ✅
A privacy policy page and terms-of-service page exist as routes, each showing a 'Last updated' date, and the sign-in gate displays a by-signing-in-you-agree link to both.

**Verify:** Open src/app/privacy/page.tsx and src/app/terms/page.tsx (both render with 'Last updated'); grep '/terms' and '/privacy' in src/components/AuthGate.tsx shows the agreement sentence.

### LG-2 ❌
The privacy policy's statement about signature handling matches the code: no sentence claims signatures stay on-device / are never shared while any code path transmits a signature image off-device.

**Verify:** grep -n 'not\s*shared' src/app/privacy/page.tsx and compare with src/app/api/inspections/notify/route.ts — the policy must disclose the signature PNG email attachment or the code must not send it.

**Autonomy note:** Autonomous fix = truthful policy/consent text disclosing signature PNGs leave the device via EHS email; changing the data flow itself is an owner decision.

### LG-3 ❌
The privacy policy's claim about PII sent to the AI provider matches actual prompt payloads: either no worker/supervisor names appear in prompts built for Anthropic, or the policy discloses that names are included.

**Verify:** grep -n 'userName\|supervisor' src/lib/sage-context.ts — if contextToPrompt emits 'Worker: <name>' or supervisor names, the privacy AI Features section must not say names are not sent.

### LG-4 ❌
The Third-Party Services section names every external service the code transmits or persists personal data to: Anthropic, Notion, Resend, Slack (including first-sign-in name/email notifications), Google, Sentry, and Upstash Redis/Vercel KV.

**Verify:** grep -in 'sentry\|upstash\|redis\|vercel' src/app/privacy/page.tsx returns hits, and the Slack bullet covers sign-in notifications (compare src/lib/auth.ts:108).

### LG-5 ❌
The Data Retention section states the retention periods actually implemented (90-day local archive of synced safety records, 7-day draft prune, KV TTLs: known-users 90d, beta signups 180d, review submissions 7-30d) and maps OSHA-relevant record types (incident reports 29 CFR 1904.33, forklift operator training certification 29 CFR 1910.178(l)(6), daily inspections) to retention behavior in the policy or a linked docs/ compliance file.

**Verify:** Privacy retention section (src/app/privacy/page.tsx) lists the 90-day archiver and KV TTL periods matching safety-records.ts:868/891/916, user-tracker.ts:9, beta.ts:34, review-store.ts:46; a file matching docs/*retention*|*compliance* cites 1904.33 and 1910.178(l).

**Autonomy note:** Draft retention mapping with CFR citations, marked 'DRAFT — pending counsel review'; criterion passes on existence + accuracy of the draft.

### LG-6 ❌
Every SignaturePad capture surface displays adjacent text stating signing intent and where the signature is stored or transmitted (inspection sign-on, crew signature block, and incident reporter signature).

**Verify:** For each file importing SignaturePad that renders it (PreTripInspection.tsx, CrewSignatureBlock.tsx, IncidentReportForm.tsx), grep for an intent/consent sentence ('certify', 'By signing', 'consent') within the same JSX section as the pad.

**Autonomy note:** Same as LG-2: disclose honestly in consent text; data-flow redesign is an owner decision.

### LG-7 ✅
Signed inspections bind signer identity, ISO timestamp, and a server-verified submitter: the stored record carries inspectorName + createdAt + hasSignature, and the EHS notify route stamps the authenticated session email as 'Submitted by (verified)' rather than trusting client input.

**Verify:** Inspect src/lib/inspections.ts submitInspection record fields and src/app/api/inspections/notify/route.ts — requireSession() gates the route and verifiedSubmitter comes from session.user.email.

### LG-8 ❌
Every UI surface that renders AI-generated safety suggestions displays an advisory disclaimer (not-a-substitute language): SageAssist, SageTriage, ConfinedSpaceForm atmospheric analysis, IncidentReportForm analysis, and JhaForm's parse-document/suggest-jha outputs.

**Verify:** grep -in 'advisory\|not a substitute' in each component that fetches /api/safety/suggest-*|analyze-*|parse-document or /api/sage/triage — every such component must contain a disclaimer string.

### LG-9 ❌
The public beta signup form, which collects name/email/company and stores them in Upstash KV and posts them to Slack, displays a link to the privacy policy on the form.

**Verify:** grep -n '/privacy' src/app/beta/page.tsx returns a link rendered in the signup form section.

### LG-10 ❌
A third-party license notices artifact exists in the repo (e.g. THIRD_PARTY_NOTICES.md) listing every production dependency in package.json with its license identifier, and no production dependency carries a copyleft (GPL/AGPL/LGPL) license conflicting with the proprietary LICENSE.

**Verify:** ls repo root for THIRD_PARTY_NOTICES* and cross-check its entries against Object.keys(package.json dependencies); confirm no GPL-family license appears for any listed dep.

**Autonomy note:** License inventory automatable; if a copyleft production dep is found, discovery+documentation = pass, replacement is an owner decision.


## Spanish Language Support (`spanish`) — 0/10 at freeze *(added 2026-07-06 by owner request)*

Rubric authored via a 9-agent design tournament over the reverted June i18n attempt; architecture and
pipeline spec in `docs/i18n/DESIGN.md`. Owner sign-off of translation packets is asynchronous and gates
only the removal of the '(beta)' label — never a criterion.

### ES-1 ❌
Hardened i18n provider: all-occurrence split/join interpolation, Intl.PluralRules .one/.other variant selection, generated typed keys enforced by tsc, locale→en→key fallback with dev-only warnings — unit tested.

**Verify:** Read src/lib/i18n.tsx: interpolation uses split/join (not first-match replace); plural selection via Intl.PluralRules; t() key param typed from generated src/lib/i18n-keys.d.ts; vitest covers resolve/interpolate/plural/fallback; npx tsc --noEmit green.

### ES-2 ❌
Storage migration and pre-paint language: locale persisted under 'sage-locale-v2'; the layout.tsx purge of the old 'sage-locale' key is deleted; document.documentElement.lang stamped pre-paint from storage; hydration-safe (suppressHydrationWarning on <html>, useLayoutEffect storage read).

**Verify:** grep "removeItem('sage-locale')" src/app/layout.tsx returns nothing; grep 'sage-locale-v2' src/app/layout.tsx hits the pre-paint lang stamp; sw-i18n-invariants vitest green (also pins: no skipWaiting:true, sage-theme stamping unchanged).

### ES-3 ❌
Catalog CI gates live in npm test: en/es key parity, zero placeholders, interpolation-var parity, plural-variant parity, and generated-key-types freshness all fail the build when violated.

**Verify:** src/lib/__tests__/i18n-catalog.test.ts exists and npm test is green; spot-check: temporarily removing an es key or inserting "[TODO" locally makes the suite fail (restore after).

### ES-4 ❌
Runtime kill switch: /api/i18n/status serves {esEnabled, suppressedNamespaces[]} from Upstash KV; sw.ts has a NetworkOnly matcher for it; the provider fetches on mount AND visibilitychange with a last-known-good localStorage fallback.

**Verify:** Read src/app/api/i18n/status/route.ts (KV-backed, no console.*), the sw.ts NetworkOnly entry, and the provider's mount+visibilitychange fetch; a route test covers KV-absent defaults (esEnabled true, empty suppression).

### ES-5 ❌
Translation pipeline + cluster 1 dark: surface-mined glossary (owner packet pending or signed) with 5-lens adversarial review evidence committed; 3-round cap + blocked-keys manifest enforced; shell/nav/auth/offline/errors/dashboard converted and translated with the toggle still absent.

**Verify:** docs/i18n/glossary.json + review/*.json exist with zero FAIL entries covering every cluster-1 key; blocked-keys.json within size cap; es-leakage.spec green on cluster-1 routes; grep setLocale src/components/UserMenu.tsx returns nothing (no toggle).

**Autonomy note:** Glossary/namespace sign-off is asynchronous (mark.starr counter-signs packets); it gates only the (beta) label, never this criterion.

### ES-6 ❌
Safety forms fully converted dark: six forms + validation + atmo messages through t(); checklist/permit/hazard data translated via id-keyed lookasides and insertion-time mapEs() (no schema change); record.locale stamped at signing; LG-6/LG-8 English literals preserved via defaultEn overload + strict-equality vitest anchor.

**Verify:** grep -n 'By signing' src/components/safety/CrewSignatureBlock.tsx still matches; lookaside orphan-id vitest green; a record saved with locale:'es' renders es labels and an en record renders English (vitest); es-leakage.spec green on all /safety form routes.

### ES-7 ❌
Inspection/equipment/records/history UI converted dark with locale-aware dates: zero hardcoded en-US toLocale* call sites (Intl.DateTimeFormat helper), non-hook getT(locale) for lib code, records render in their stored record.locale, QR labels print static bilingual EN/ES with URLs unchanged.

**Verify:** grep -rn "'en-US'" src returns zero user-facing call sites; QRLabel snapshot contains both languages and unchanged /inspect URLs; /inspect/[id] still uses generateStaticParams with zero client fetch; es-leakage.spec green on inspection/equipment/record routes.

### ES-8 ❌
Sage AI + canned content Spanish: triage system prompt instructs answering in the app locale; suggest-* routes accept locale; sage-faq 12 answers + keyword patterns and incident-patterns keywords/display strings have es variants; equipment prose lookaside complete (46 items, whole-item fallback); bundle delta recorded <60KB gzip.

**Verify:** grep -n 'locale' src/app/api/sage/triage/route.ts hits the prompt line; vitest asserts non-empty es keyword sets for every FAQ/incident pattern; equipment lookaside orphan-id test green; bundle delta noted in docs/i18n/review evidence.

### ES-9 ❌
Full-fleet regression net + operations: es-leakage.spec covers every worker-facing route (size-capped documented sentinel allowlist) and en-pin.spec protects English assertions; docs/i18n/OPERATIONS.md documents the four rollback tiers (KV kill switch, namespace suppression, per-key retreat, fix-forward) and storage-key versioning.

**Verify:** Run both Playwright suites — green; read OPERATIONS.md: all four tiers with concrete commands; allowlist file within its size cap and each entry justified.

### ES-10 ❌
Exposure shipped: 'Español (beta)' toggle in UserMenu rendered only when the runtime flag allows, one-time '¿Prefiere español?' prompt for es* devices, locale persists via sage-locale-v2 with pre-paint html[lang]; beta-guard vitest proves the '(beta)' suffix is only removable when signoff.json fully covers the safety-critical manifest.

**Verify:** grep -n 'Español (beta)' src/components/UserMenu.tsx matches; Playwright: toggle→es persists across reload, html[lang='es'] pre-paint, KV esEnabled=false hides the toggle and forces English on next foreground; beta-guard vitest green.

**Autonomy note:** After mark.starr counter-signs all packets in docs/i18n/signoff.json, a follow-up commit removes '(beta)'. That step is the owner's; it does not block this criterion.

