# Re-creating Sage EHS on Kin — assessment and plan

**Status:** proposal, not started. Written 2026-08-05 from the
`claude/construction-safety-audits-HC6MA` branch.

**Decision this document supports:** re-create Sage EHS as a Kin app to inherit
Mytra's platform backend (identity, database, secrets, sharing, schedules)
instead of continuing to hand-roll them on Vercel.

---

## The headline

This is a **rewrite of the framework layer, not of the product**. Roughly
60–70% of the ~38,900 lines in `src/` are framework-agnostic and port with
light edits. What gets rebuilt is the Next.js shell around them.

The expensive, hard-won work survives:

- **All 63 components** (they're React; Kin serves a client bundle as static assets)
- **The entire Spanish investment** — 1,067 catalog keys, the 117-term
  adversarially-reviewed glossary, the data lookasides, the review evidence,
  the blocked-keys/leakage machinery. These are JSON + docs + `t()` call sites
  inside components. They move with the components.
- **Most of the 56 `src/lib` modules** — safety-records, inspections, i18n,
  datetime, media, form logic, validation shapes.

What disappears is mostly *toil we've been paying for*:

- `next-auth` (≈300 lines + 23 tests) → Kin stamps `x-kin-user-email` /
  `x-kin-user-id` / `x-kin-app-role` headers. **The login-lockout class of bug
  we hit in PR #29 stops being possible.**
- Hand-rolled RBAC in `src/lib/roles.ts` → platform `appRole` + `isManager`.
- `RESEND_API_KEY`-is-it-set-in-Vercel guesswork → Kin secrets vault.
- localStorage-as-database, and with it the corruption/quarantine/backup
  machinery, the notify queue's silent-loss failure modes, and most of
  `safety-sync.ts` → a real per-app D1 database.

---

## What each dependency becomes

| Today | On Kin |
|---|---|
| `next` | **Gone.** Client-side React SPA served as static assets from R2; routing moves to a client router. |
| `next-auth` | **Gone — replaced by the platform.** Identity arrives as request headers. |
| `@serwist/next` | Hand-rolled service worker shipped as a static asset. The offline contract is preserved but re-implemented. |
| `@sentry/nextjs` | Drop for now; Kin logging lands in a later platform phase. |
| `@upstash/redis` | `env.DB` (D1) for the review store and i18n kill switch; rate limiting per-app. |
| `@anthropic-ai/sdk` | Plain `fetch` against the Anthropic API with the key from `env.KIN.getSecret(...)`. The codebase already wraps calls in `fetchWithTimeout`. |
| `zod` | Pre-bundled into the Worker module (no unresolved import survives) — **verify with a probe deploy before relying on it.** |
| `react`, `react-dom`, `lucide-react`, `qrcode.react` | Fine — they live in the client asset bundle. |

---

## The one decision that gates everything

**How does the UI ship?** Two viable shapes:

**A — React SPA as static assets (recommended).** Build the client bundle
locally (Vite/esbuild), upload `index.html` + JS + CSS via
`kin_get_upload_url`, and let the Worker serve them from the asset manifest
and handle `/api/*`. Preserves all 63 components, the i18n layer, and the
offline story. Costs: a client router replaces file-based routing; no SSR;
`generateStaticParams` on `/inspect/[id]` becomes a client-side fetch or a
Worker-rendered shell.

**B — Worker-rendered HTML.** Most Kin-native and simplest to deploy, but it
throws away the component layer and badly weakens offline. **Not recommended
for a field PWA whose whole value proposition is working in dead zones.**

Everything below assumes **A**.

---

## Staged plan

**Phase 0 — prove the shape (half a day).** `kin_create_app` with
`needs_database: true`, deploy the diagnostic probe from the Kin skill, confirm
the bindings, then port **one vertical slice end to end**: scan QR → pre-trip
checklist → sign → save to D1 → email EHS. That single slice exercises every
risky assumption at once (asset serving, D1 schema + migrations, identity
headers, R2 for signature/photo blobs, secrets for Resend). Do not proceed
until this slice works on a preview URL.

**Phase 1 — data model.** The record shapes are already fully specified in
`src/lib/types.ts` and `src/lib/safety-types.ts`, with zod schemas in
`src/lib/*-schema*.ts`. Translate them into D1 migrations
(`kin_create_migration`, paired up/down). Records that live in localStorage
today become rows other people can actually see — which is the point.

**Phase 2 — UI port.** Stand up the SPA build, bring the 63 components across,
swap `next/link` and `next/navigation` for the client router, replace the 23
pages with routes.

**Phase 3 — offline.** Re-implement the service worker and keep IndexedDB as a
local cache in front of D1. `inspections.ts` and `safety-sync.ts` logic mostly
survives; the sync target changes from `/api/safety/sync` to the Kin app's own
handlers.

**Phase 4 — integrations.** The 20 API routes become Worker handlers. Notion,
Slack, Resend, and Anthropic all become `fetch` + `env.KIN.getSecret`.

**Phase 5 — Spanish re-verification.** Catalogs and glossary port unchanged;
re-run the leakage/en-pin e2e against the new routes and re-anchor the
packet-integrity digests.

---

## Sequencing risk to settle first

The Spanish track is **mid-flight**: `spanish` sits at 6/10, ES-M4's conversion
is committed but its 5-lens review died on the org spend limit, and ~427
translated keys are staged **unapplied** in `docs/i18n/review/m4.pending.json`.

Recommendation: **land the ES-M4 review before starting the Kin port.** It's
one resumable workflow run (`resumeFromRunId: wf_1d90d108-c43`, generators
replay from cache) and it leaves the catalog in a consistent, fully-reviewed
state. Porting a half-applied translation set across a framework rewrite is how
you lose track of which strings were reviewed — exactly the failure mode the
June i18n attempt died of.

---

## What this does not solve

- **Kin has no webhook ingress yet**, so any inbound Slack/GitHub/Stripe-style
  receiver stays off-platform until that ships.
- **Sentry-grade error visibility** is not available until Kin's logging phase.
- The re-created app gets a `*.mkin.app` hostname. If Sage EHS needs to keep
  `sage-ehs.mytra.ai` for external/customer use, that's a separate conversation
  (and points at the external-app path, which is platform-admin only).
