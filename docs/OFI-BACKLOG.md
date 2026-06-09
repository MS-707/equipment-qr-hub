# OFI Backlog — Holistic Site Review (June 2026)

Findings from a three-team audit (frontend/UX, architecture/code quality,
security/infra). Deduplicated and ranked. Each item is sized to be one commit
in a hardening PR.

Legend: 🔴 P0 = fix before beta invites · 🟡 P1 = fix during beta · ⚪ P2 = post-beta

---

## 🔴 P0 — Launch gates

- [x] **1. Block passwordless admin impersonation in production**
  `src/lib/auth.ts:33` — `ALLOW_EMAIL_LOGIN=1` enables the no-password
  Credentials provider in production (only `ALLOW_DEV_LOGIN` is NODE_ENV-gated,
  contradicting the file header). Anyone typing an admin email becomes admin.
  Fix: gate `allowEmailLogin` behind `!isProduction` as well.

- [x] **2. Back the rate limiter with KV** *(flagged by all 3 teams)*
  `src/lib/rate-limit.ts` — module-scope `Map` is per-lambda and resets on cold
  start; all 9 protected routes are effectively unlimited (Anthropic cost burn,
  Slack/Resend flooding). Also `api/beta/signup/route.ts:6` keys on raw
  `x-forwarded-for` (client-spoofable — use the platform-appended last hop).
  Fix: `kv.incr` + `kv.expire` when `KV_REST_API_URL` is set; Map fallback for dev.

- [x] **3. Remove the forgeable review-token fallback secret**
  `src/lib/review-token.ts:3` — falls back to a hard-coded string, making
  approve/reject tokens forgeable on the unauthenticated `/api/safety/review/decide`
  route (forged token = forged EHS approval). Comparison is also truncated and
  non-constant-time. Fix: throw at module load if no secret; full HMAC digest +
  `crypto.timingSafeEqual`.

- [x] **4. Fix invisible printed signatures (compliance bug)**
  `src/components/SignaturePad.tsx:21` — pen color is hard-coded `#FFFFFF` on a
  transparent PNG; print CSS forces white backgrounds, so signed PTPs/permits
  print with blank signature boxes. Fix: export strokes in a dark color (recolor
  at export) and derive pen color from theme.

- [x] **5. Stop drafts resurrecting after submission (duplicate-record bug)**
  `src/lib/use-draft.ts:40` — the debounced save runs on every render with no
  enabled flag; after submit + `clearDraft()`, the timer re-writes the draft with
  submitted values. Next visit shows "Draft restored" with stale data → invites
  duplicate permits/PTPs. Affects all five forms. Fix: add a `disabled` param to
  `useFormDraft`, set on submit.

- [x] **6. Fix beta signup index race (silently hidden signups)**
  `src/lib/beta.ts:31` — `get` → `push` → `set` on `beta:_index`; concurrent
  signups lose an index entry, making a signup invisible in `/admin/beta`
  forever. Fix: `kv.sadd`/`kv.smembers` instead of an array.

## 🟡 P1 — During beta

- [ ] **7. Validate `/api/inspections/notify` body with zod**
  `src/app/api/inspections/notify/route.ts` — unvalidated `as`-cast body; a
  string `items` throws an unhandled 500; fields flow into email unbounded.

- [ ] **8. Install sync listeners app-wide, not just the dashboard**
  `src/lib/safety-sync.ts` / `SafetyDashboard.tsx:90` — a worker who submits a
  permit offline from a form page and reconnects without visiting `/safety`
  never syncs. Fix: mount `installSyncListeners()` in a root layout client
  provider.

- [ ] **9. Harden triage prompt-injection surface**
  `src/app/api/sage/triage/route.ts:109` — client-supplied `body.context`
  (2000 attacker-controlled chars) is concatenated into the **system** prompt;
  Sage's safety guidance can be overridden. Also the "sanitization" comment at
  :124 overstates what the code does (only truncation). Fix: move client context
  to a delimited user-role block marked untrusted; correct the comment.

- [ ] **10. Move admin authorization server-side**
  `src/lib/admin.ts:14` — `NEXT_PUBLIC_ADMIN_EMAILS` ships the admin list in the
  client bundle and freezes it at build time; server routes also gate on
  `NEXT_PUBLIC_*` flags (`AI_ASSIST`, `EHS_REVIEW`). Fix: server-only
  `ADMIN_EMAILS` for authz + an `isAdmin` boolean in the session callback;
  keep public vars for UI display only.

- [ ] **11. Delete the orphaned legacy endpoint + dep cleanup**
  `api/sync-inspection.ts` (repo root) — unauthenticated pages-style stub that
  deploys as a live public function returning fake `success: true`. Delete it;
  drop `@vercel/node`; move `sharp` to devDependencies (only used by
  `scripts/generate-splash.mjs`).

- [ ] **12. Add CSP and explicit HSTS headers**
  `next.config.mjs` — has nosniff/frame/referrer/permissions headers but no
  `Content-Security-Policy` or pinned `Strict-Transport-Security`.

- [ ] **13. Add `htmlFor`/`id` pairs to permit + incident forms**
  `IncidentReportForm.tsx`, `HeightPermitForm.tsx`, `HotWorkPermitForm.tsx`,
  `ConfinedSpaceForm.tsx` have zero label associations (PTP/JHA forms do it
  right). Screen readers announce unlabeled inputs; label taps don't focus.

- [ ] **14. Fix `--fg-4` WCAG contrast failure**
  `globals.css` — #666666 on #0A0A0A ≈ 3.4:1, used on placeholders, hints, AI
  disclaimers. Lift to ~#8A8A8A or reserve for decorative/disabled only.

- [ ] **15. Handle the iOS keyboard in SageTriage**
  `SageTriage.tsx:308` — full-screen dialog has no `visualViewport` handling;
  keyboard can cover the input row in iOS standalone. Fix: `visualViewport`
  resize listener or `interactiveWidget: 'resizes-content'`.

- [ ] **16. Fix review-decision integrity gaps**
  `review-store.ts` (TOCTOU: concurrent approve+reject can both win — use
  `kv.set(..., { nx })` on a decision key) and `review/decide/route.ts`
  (`decidedBy` records `EHS_NOTIFY_EMAIL` regardless of who clicked the link —
  record "via email link" at minimum). Cap `note` at 500 chars.

## ⚪ P2 — Post-beta hardening & polish

- [ ] **17. Extract `withSageRoute()` helper** — the 5 AI routes repeat the same
  ~40-line preamble (flag → session → rate limit → key check → JSON parse) +
  call envelope; ~35-45% of 567 combined lines is boilerplate.
- [ ] **18. Extract shared Notion sync lib** — `DB_MAP` + page-create logic
  duplicated (~70 lines) between `safety/sync` and `review/submit` routes.
- [ ] **19. Multi-tab write safety** — `safety-records.ts` read-modify-write
  races between tabs can clobber records / mint duplicate IDs; re-read-merge
  before write or move to IndexedDB transactions.
- [ ] **20. Sync signature/photo blobs** — documented v1 gap; device loss
  destroys the only copy of legally meaningful signatures. (Already on the
  public roadmap.)
- [ ] **21. Shared-device identity flow** — 12h JWT + 72h identity cache +
  unscoped localStorage lets worker B inherit worker A's attribution and read
  their incident reports on a shared tablet. Add a prominent switch-user/sign-out
  that purges identity; consider shift-length sessions.
- [ ] **22. Minimize PII fan-out** — names/emails/incident narratives flow to
  Notion, Slack, Resend, and Anthropic. Strip `createdByEmail` + free-text from
  Slack messages; add a beta privacy note.
- [ ] **23. PullToRefresh performance** — `PullToRefresh.tsx` re-renders the
  dashboard subtree per touchmove and animates `height`; drive via transform +
  rAF on a ref.
- [ ] **24. BottomTabBar ARIA cleanup** — `role="tablist"` on nav links (drop
  it, keep `aria-current`); remove dead `[role="tabbar"]` print selector.
- [ ] **25. Lengthen offline identity TTL** — 72h hard expiry locks out workers
  offline >3 days; extend (e.g. 30d) with a "verify when online" warning state.
- [ ] **26. Record-store performance + pruning** — dashboard load triggers ~5
  full `readAll()` JSON parses; synced records (+ full backup copy) accumulate
  forever. Memoize behind the existing `notify()` invalidation; archive synced
  records older than N days.
- [ ] **27. Grow test coverage** — current 27 tests cover pure helpers only.
  Highest value: `review-token` sign/verify/tamper/expiry; `safety-records`
  state machines + corruption recovery; one AI route's validation/error paths
  with a mocked client.
- [ ] **28. Dependency hygiene** — `npm audit fix` (1 high / 4 moderate, mostly
  mitigated on Vercel); plan Next 15 + Auth.js v5 migration post-beta.

---

*Sources: three independent review agents (frontend/UX, architecture, security),
each auditing the full codebase read-only. Items merged where teams overlapped;
severity reflects the highest rating any team assigned.*
