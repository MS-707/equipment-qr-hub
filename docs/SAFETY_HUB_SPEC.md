# Safety Hub — Construction & Commissioning Safety Audits Module

**Target repository:** `ms-707/equipment-qr-hub`
**Branch:** `claude/construction-safety-audits-HC6MA`
**Document status:** Implementation specification (hand-off to implementing agent)
**Author context:** Mytra EHS — structural engineers & build crews commissioning sites/structures

---

## 0. How to read this document

This is a **complete, self-contained build specification**. An implementing agent should be able to execute it against the existing `equipment-qr-hub` codebase without further product input. It is intentionally prescriptive about file paths, data shapes, OSHA/Cal-OSHA content, and reuse of existing patterns so that **the spirit, content, function, and purpose are preserved exactly**.

When this spec says "follow the pattern in `X`," it means: open that file, copy its structure/conventions, and stay consistent. Consistency with the existing app is a hard requirement, not a suggestion.

**Golden rules for the implementer:**

1. **Do not break what works.** The existing Equipment Directory, Pre-Trip Inspections, Work Orders, and QR Labels must keep functioning unchanged. The Safety Hub is *additive*.
2. **Match the house style.** Dark theme, `mytra-*` Tailwind tokens, Lucide icons, Roboto font, `'use client'` components, no new heavy dependencies unless this spec authorizes them.
3. **Mirror the data-layer pattern.** Every new persisted entity gets a `lib/*.ts` "swap point" module with `readAll`/`writeAll`/`nextId`/pub-sub, exactly like `src/lib/inspections.ts` and `src/lib/work-orders.ts`.
4. **Offline-first.** This is a PWA used on job sites with poor connectivity. Forms must work fully offline and sync later. Never block form completion on a network call.
5. **Auditable means immutable.** Submitted safety records are not edited in place. Status transitions and corrections are appended as events. Every record carries who/what/when.

---

## 1. Purpose & spirit (the "why")

Mytra's structural engineers and build crews commission sites and structures. Today the daily safety rituals (pre-task planning, permits, inspections) are paper-based. This module digitizes them into a **frictionless, paperless, mobile-first, electronically-auditable** workflow that lives alongside the equipment data the team already trusts.

The module must feel like it was always part of the app. A crew member should be able to, from a phone on site:

- Run the morning **Pre-Task Plan (PTP)** with the whole crew, capture hazards collaboratively, and collect touch-drawn signatures from everyone present.
- Issue and later close time-limited **Work-at-Height**, **Hot Work**, and **Confined Space** permits.
- File an **Incident / Near-Miss** report with photos.
- Have all of this tied to a **verified identity** (Google sign-in on the company `@mytra` domain) and synced to **Notion** for the office.

It must reduce friction, not add it. If a screen takes more than a few taps to do the common thing, it's wrong.

---

## 2. Decisions already made (do not re-litigate)

These were confirmed with the product owner:

| Topic | Decision |
|---|---|
| **Authentication** | Full **Google OAuth**, restricted to the company email domain. Verified identity is the backbone of the audit trail. |
| **PTP workflow** | **Collaborative** — one device, foreman drives, hazards added by the group, and **each person e-signs by drawing their signature** (touch/stylus/mouse). |
| **Sync target** | **Notion** databases (one per record type). Reuse/extend the existing Notion sync seam. |
| **Slack** | **Out of scope** for this phase. Do not build it. Leave no dead UI for it. |
| **Claude API ("Sage")** | **Optional, off by default.** The Claude-powered assistant is branded **Sage**. Scaffold its UX/UI (see §13) but gate it behind an env var so it costs nothing and renders nothing unless enabled. No core flow may depend on Sage. |

---

## 3. Existing architecture — what you are building on

Read these files before writing anything. They define every convention you must follow.

| Concern | Reference file | What to copy from it |
|---|---|---|
| Persisted entity + swap point | `src/lib/work-orders.ts`, `src/lib/inspections.ts` | `readAll`/`writeAll`, year-prefixed `nextId`, pub/sub `listeners` Set, `onXChange` subscriber, CSV export |
| Large-blob storage | `src/lib/inspections.ts` (lines ~18–56) | IndexedDB `openPhotoDB` / `savePhotos` / `getPhotos` keyed `${recordId}:${slot}` |
| Canonical form UX | `src/components/PreTripInspection.tsx` | Multi-step flow (`identify → checklist → result`), input/textarea/toggle className recipes, sticky submit, progress bar, photo capture + compression, history accordion |
| Data definitions | `src/data/inspection-checklists.ts` | `ChecklistDefinition` shape: `{ type, title, sections: [{ category, items: [{ id, label, category, critical }] }] }` |
| Types + color maps | `src/lib/types.ts` | `Shift`, `InspectionSyncStatus`, `PriorityLevel`, `*_COLORS` records, `requiresX` helpers |
| Top nav + badge | `src/components/NavHeader.tsx` | Sticky header, nav link array, `getOpenCount()` badge, pub/sub + `storage` event wiring |
| Root layout | `src/app/layout.tsx` | `dark` class, Roboto, `bg-mytra-bg text-white`, where `<NavHeader/>` mounts |
| Notion sync seam | `api/sync-inspection.ts`, `src/lib/inspections.ts` `syncToNotion()` | Vercel function signature, env-var guard, property mapping comments |
| PWA | `next.config.mjs`, `src/app/sw.ts` | Serwist config; precache manifest; offline fallback at `/~offline` |
| Styling tokens | `tailwind.config.ts`, `src/app/globals.css` | See §4 |

### Tech stack (fixed)

- Next.js **14.2.35** (App Router), React 18, TypeScript 5 (strict).
- Tailwind 3.4 with custom `mytra` palette. Lucide icons. `qrcode.react`, `sharp`, Serwist already present.
- Hosting: Vercel. Two API conventions coexist: **root `/api/*.ts`** (Vercel Functions, e.g. `api/sync-inspection.ts`) and **`src/app/api/**/route.ts`** (App Router route handlers). Use App Router route handlers for new endpoints (NextAuth requires it); the existing root `api/sync-inspection.ts` stays as-is.
- **No database server.** Persistence is `localStorage` + `IndexedDB`, with Notion as the cloud sync target. Do not introduce Prisma/Supabase/etc. in this phase.

### New dependencies authorized by this spec

- `next-auth@^4.24` (Google OAuth). **This is the only new runtime dependency.** Do not add a signature library, a form library, a date library, or the Notion SDK — implement those with platform primitives / `fetch` as described below.
- (Optional, only if **Sage** is enabled in a later step) `@anthropic-ai/sdk`. Not installed by default.

---

## 4. Design tokens & reusable UI recipes

Pull these verbatim from `tailwind.config.ts` / `globals.css`. **Every new screen uses these and nothing else.**

```
Colors (Tailwind: bg-mytra-*, text-mytra-*, border-mytra-*):
  mytra-bg          #0A0A0A   page background
  mytra-card        #161616   cards / panels
  mytra-card-hover  #1E1E1E   hover state on cards/rows
  mytra-input       #0F0F0F   input field background
  mytra-border      #232323   all borders / dividers
  mytra-purple      #583AF6   primary action / active state
  mytra-purple-hover#6B4FF7   primary hover
  mytra-purple-glow rgba(88,58,246,0.12)

Status / risk semantic colors (use raw hex or tailwind equivalents, matching existing usage):
  critical  #EF4444 (red)     high #F97316 (orange)
  medium    #EAB308 (yellow)  low  #6B7280 (gray)
  success   green-500/400     warning amber-500/400

Font: Roboto (already wired in layout). Animations: animate-fadeIn, animate-slideDown,
animate-fadeInUp (defined in tailwind.config). Accordion: .accordion-content / .open
(grid-template-rows technique in globals.css).
```

**Canonical className recipes** (copy from `PreTripInspection.tsx`, do not invent new ones):

- **Text input / textarea:**
  `w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-mytra-purple focus:border-transparent`
  Error state adds: `border-red-500 ring-2 ring-red-500/50`.
- **Field label:** `block text-xs text-gray-400 mb-1`.
- **Primary button:**
  `w-full py-3 rounded-lg text-sm font-semibold transition-colors duration-150 bg-mytra-purple text-white hover:bg-mytra-purple-hover disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-mytra-purple`.
- **Secondary button:** `... bg-mytra-card border border-mytra-border text-white hover:bg-mytra-card-hover`.
- **Segmented toggle (e.g. Pass/Fail/NA, Shift):** flex row of `flex-1` buttons; active = `bg-mytra-purple text-white` (or `bg-green-600`/`bg-red-600` for pass/fail), inactive = `bg-mytra-bg border border-mytra-border text-gray-400 hover:text-white hover:border-mytra-purple/50`.
- **Card / panel:** `bg-mytra-card border border-mytra-border rounded-lg p-4`.
- **Section header (eyebrow):** `text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2 px-1`.
- **"Safety-critical" / risk chip:** `inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded` with color-coded `text-*` / `bg-*/10`.
- **Sticky submit bar:** wrap submit in `sticky bottom-0 pb-4 pt-2 bg-gradient-to-t from-mytra-bg via-mytra-bg to-transparent`.
- **Photo capture:** reuse `compressPhoto(file)` (maxW 800, JPEG 0.7) and the hidden `<input type="file" accept="image/*" capture="environment">` pattern from `PreTripInspection.tsx`. **Extract `compressPhoto` into `src/lib/media.ts`** so it can be shared by incident reports without duplication (and re-import it in `PreTripInspection.tsx`).
- Respect `prefers-reduced-motion` (globals.css already handles it globally; don't fight it).
- All interactive elements need `focus-visible:ring-2 focus-visible:ring-mytra-purple` and appropriate `aria-*`.

---

## 5. File manifest

### 5.1 Create

```
src/
  app/
    api/
      auth/[...nextauth]/route.ts        NextAuth handler (Google)
      safety/
        sync/route.ts                    App Router endpoint: push a safety record to Notion
        suggest-hazards/route.ts         OPTIONAL — Sage (Claude) hazard suggestions, env-gated; see §13
    safety/
      page.tsx                           Safety Hub dashboard (auth-gated)
      ptp/page.tsx                        Pre-Task Plan
      permits/
        height/page.tsx                   Work-at-Height permit
        hot-work/page.tsx                 Hot Work permit
        confined-space/page.tsx           Confined Space Entry permit
      incident/page.tsx                   Incident / Near-Miss report
      history/page.tsx                    Audit log (all safety records, searchable)
      record/[id]/page.tsx                Read-only record viewer (for audit/print/QR deep-link)
  components/
    providers/AuthProvider.tsx           'use client' wrapper around next-auth SessionProvider
    AuthGate.tsx                         Gates protected content; sign-in screen; offline identity fallback
    UserMenu.tsx                         Avatar + name + sign out (mounts in NavHeader)
    SignaturePad.tsx                     Canvas signature capture (no external lib)
    safety/
      SafetyDashboard.tsx
      SafetyRecordCard.tsx               Row/card for lists
      PermitStatusBadge.tsx
      PermitTimer.tsx                     Live "expires in / EXPIRED" countdown
      PPESelector.tsx                     PPE checkbox grid
      HazardTable.tsx                     Collaborative hazard rows + quick-add chips
      CrewSignatureBlock.tsx             Roster of signatures using SignaturePad
      PermitChecklist.tsx                Generic checked/notes checklist renderer
      SageAssist.tsx                      OPTIONAL — "Sage" AI hazard helper; renders null when dormant (§13)
      RecordView.tsx                      Read-only renderer used by record/[id]
      PreTaskPlanForm.tsx
      HeightPermitForm.tsx
      HotWorkPermitForm.tsx
      ConfinedSpaceForm.tsx
      IncidentReportForm.tsx
  lib/
    auth.ts                              NextAuth options, domain allowlist, session types
    safety-types.ts                      All TS interfaces for the module (§7)
    safety-records.ts                    THE SWAP POINT: CRUD, IDs, pub/sub, blob storage, sync (§8)
    safety-sync.ts                       Client→/api/safety/sync wrapper + retry/online listener
    media.ts                             Shared compressPhoto (extracted) + dataURL helpers
  data/
    safety-checklists.ts                 Permit checklists + PTP hazard library + PPE list (§9–§12)
    crew.ts                              Optional known-crew roster for quick signature selection
docs/
  SAFETY_HUB_SPEC.md                     (this file)
middleware.ts                            (repo root) optional soft-protect /safety/* (see §6.4)
.env.example                             Document all env vars (§14)
```

### 5.2 Modify

```
src/app/layout.tsx          Wrap {children} in <AuthProvider> (SessionProvider).
src/components/NavHeader.tsx Add "Safety" nav link (Shield icon) with active-permit/open-incident badge;
                            mount <UserMenu/> on the right.
src/components/PreTripInspection.tsx
                            Auto-fill inspector from session; import compressPhoto from lib/media.
src/lib/inspections.ts      Add optional createdByEmail to records; import compressPhoto from media (if moved).
src/lib/types.ts            (Optional) add createdByEmail?: string to InspectionRecord.
package.json                Add next-auth dependency.
README.md                   Short "Safety Hub" section + env setup pointer.
src/app/sw.ts               Ensure /api/auth/* and /api/safety/* are network-only (never cached). See §6.5.
```

---

## 6. Authentication (Phase 1)

### 6.1 Library & strategy

- Use **NextAuth v4** (`next-auth@^4.24`) with the **Google provider** and **JWT session strategy** (no database — sessions are stateless cookies). This is the lightest option that gives verified identity and works on Vercel with zero infra.
- Domain restriction is enforced **server-side** in the `signIn` callback (the Google `hd` param is only a UI hint and must not be trusted alone).

### 6.2 `src/lib/auth.ts`

Export an `authOptions: NextAuthOptions` object and helpers.

```ts
import type { NextAuthOptions } from 'next-auth'
import Google from 'next-auth/providers/google'

// Allowed company domains. Mytra uses @mytra.ai (per product owner email).
// Keep this list broad enough for any mytra subdomain the team uses.
const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS ?? 'mytra.ai')
  .split(',').map(d => d.trim().toLowerCase()).filter(Boolean)

function emailAllowed(email?: string | null): boolean {
  if (!email) return false
  const domain = email.split('@')[1]?.toLowerCase()
  return !!domain && ALLOWED_DOMAINS.includes(domain)
}

export const authOptions: NextAuthOptions = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // hint to Google to pre-filter to the company domain (UI only)
      authorization: { params: { hd: ALLOWED_DOMAINS[0], prompt: 'select_account' } },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ profile }) {
      // profile.email_verified must be true AND domain must be allowed
      const p = profile as { email?: string; email_verified?: boolean }
      return emailAllowed(p?.email) && p?.email_verified !== false
    },
    async jwt({ token, profile }) {
      if (profile) token.picture = (profile as any).picture ?? token.picture
      return token
    },
    async session({ session, token }) {
      // expose a stable identity shape used everywhere in the app
      if (session.user) {
        session.user.email = token.email ?? session.user.email
        session.user.name = token.name ?? session.user.name
        session.user.image = (token.picture as string) ?? session.user.image
      }
      return session
    },
  },
  pages: { signIn: '/safety' }, // we render our own sign-in inside AuthGate
}
```

Notes:
- `NEXTAUTH_SECRET` must be set (random 32+ bytes). `NEXTAUTH_URL` set to the deployment URL (Vercel sets `VERCEL_URL`, but NextAuth v4 wants `NEXTAUTH_URL` explicitly for production).
- Do not store anything server-side; the JWT cookie is the session.

### 6.3 `src/app/api/auth/[...nextauth]/route.ts`

```ts
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

### 6.4 `AuthProvider` + `AuthGate` + offline identity

- `src/components/providers/AuthProvider.tsx` — `'use client'`, wraps `children` in `<SessionProvider>`. Mount it in `src/app/layout.tsx` around `{children}` (keep `<NavHeader/>` inside it so `UserMenu` can read the session).
- `src/components/AuthGate.tsx` — `'use client'`. Used by every `/safety/*` page (wrap the page body). Behavior:
  - `useSession()`:
    - `status === 'authenticated'` → render children. **Also persist** a minimal identity snapshot to `localStorage` under key `eqr-current-user` = `{ name, email, image, verifiedAt: ISO }`. This is the **offline identity cache**.
    - `status === 'loading'` → render a centered spinner card.
    - `status === 'unauthenticated'`:
      - If **online** → render sign-in screen: a `bg-mytra-card` panel with the app/EHS lockup, a short line ("Sign in with your Mytra Google account to access safety forms."), and a primary button calling `signIn('google')`. Show a friendly error if the user was rejected by the domain check (NextAuth appends `?error=AccessDenied`): "That account isn't on the Mytra domain. Use your @mytra.ai email."
      - If **offline** (`navigator.onLine === false`) **and** a cached `eqr-current-user` exists → render children in a **degraded "offline as <name>"** mode (show a small amber banner: "Offline — signed in as {name}. Records will sync when you reconnect."). This is essential: crews must be able to complete forms with no signal. Records created in this mode use the cached identity for `createdBy`/`createdByName` and are clearly attributable to the last verified login.
      - If offline and **no** cached identity → render an explanatory screen ("Connect to the internet once to sign in. After that, the app works offline.").
- **Why this design:** It satisfies "verified identity for the audit trail" (you cannot create records until you've signed in with Google at least once) while honoring "offline-first" (after that first verified login, the device remembers who you are for the workday). State this trade-off in a code comment.

### 6.5 PWA / caching interaction

In `src/app/sw.ts`, ensure auth and safety API routes are **NetworkOnly** (never served from cache), so login and sync always hit the network when available. Add a `runtimeCaching` rule before `defaultCache` that matches `({url}) => url.pathname.startsWith('/api/auth') || url.pathname.startsWith('/api/safety')` with a `NetworkOnly` strategy. Do not precache `/api/*`. Verify the offline fallback (`/~offline`) still works for navigations.

### 6.6 `UserMenu.tsx`

`'use client'`. Reads `useSession()`. Renders the Google avatar (`session.user.image`, fallback to initials in a `bg-mytra-purple/20` circle) + name on `sm+`, with a dropdown (reuse `animate-slideDown`) containing the email and a "Sign out" button (`signOut()`). When unauthenticated, render nothing (the page-level AuthGate handles sign-in). Mount it in `NavHeader` on the right of the nav links.

### 6.7 Wiring identity into records & pre-trip

- Add a tiny helper in `src/lib/auth.ts` (client-safe) or `safety-records.ts`: `getCurrentIdentity(): { name: string; email: string } | null` that reads the live session if available else the `eqr-current-user` cache. All `create*` functions in `safety-records.ts` call this to stamp `createdBy`/`createdByName`.
- In `PreTripInspection.tsx`, prefill `inspectorName` from the session/identity (falling back to the existing `getLastInspector()` behavior so nothing breaks when used outside the Safety Hub). Optionally store `createdByEmail` on the inspection record (additive, optional field — must not break existing records or CSV; if added to CSV, append as a new trailing column).

---

## 7. Data model — `src/lib/safety-types.ts`

All interfaces below. Reuse existing `Shift` and `InspectionSyncStatus` from `src/lib/types.ts` (import them) rather than redefining.

```ts
import type { Shift, InspectionSyncStatus } from '@/lib/types'

export type SafetyRecordType =
  | 'ptp' | 'height-permit' | 'hot-work-permit' | 'confined-space-permit' | 'incident-report'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

// Permits move through a lifecycle. 'expired' is DERIVED (now > validUntil), never stored.
export type PermitStatus = 'active' | 'closed' | 'revoked'

// A single drawn signature with attribution + timestamp. The signature image
// itself is a base64 PNG stored in IndexedDB; only a reference lives in the record.
export interface CrewSignature {
  id: string                 // uuid; also the IndexedDB blob slot suffix
  name: string               // typed or chosen from roster
  email: string | null       // set when the signer is the authenticated device user
  role: string | null        // e.g. "Foreman", "Entrant", "Fire Watch", "Operator"
  hasSignature: boolean       // true if a non-empty drawing was captured
  signedAt: string            // ISO 8601
}

// Append-only audit event. Records are immutable except for appending events
// and (for permits) flipping status via a transition that also logs an event.
export interface AuditEvent {
  action: 'created' | 'submitted' | 'closed' | 'revoked' | 'synced' | 'sync-failed' | 'amended'
  by: string                  // name
  byEmail: string | null
  at: string                  // ISO 8601
  note?: string
}

export interface SafetyRecordBase {
  id: string                  // PTP-2026-0001 etc. (see §8 prefixes)
  type: SafetyRecordType
  createdBy: string           // name from verified/cached identity
  createdByEmail: string | null
  createdAt: string           // ISO 8601 (immutable)
  location: string            // site / area / level / grid ref
  projectName: string         // project or structure being commissioned
  syncStatus: InspectionSyncStatus  // 'pending' | 'synced' | 'failed' | 'offline'
  notionPageId: string | null
  events: AuditEvent[]        // append-only
}

export interface PermitCheckItem {
  id: string
  label: string
  category: string
  checked: boolean
  notes: string
  critical?: boolean          // if true, must be checked to issue the permit
}

// ── Pre-Task Plan / Pre-Build Plan ───────────────────────────
export interface HazardEntry {
  id: string
  description: string
  riskLevel: RiskLevel
  controlMeasure: string
  addedBy: string | null      // name of whoever identified it (optional)
  source?: 'sage' | 'manual'  // provenance; defaults 'manual'. 'sage' = AI-drafted (see §13)
}

export interface PreTaskPlan extends SafetyRecordBase {
  type: 'ptp'
  date: string                // work date (YYYY-MM-DD)
  shift: Shift
  scopeOfWork: string         // what the crew is building/commissioning today
  hazards: HazardEntry[]
  ppeRequired: string[]       // ids from PPE_OPTIONS (see §12)
  // Site conditions & environmental (general-industry check-in)
  emergencyMusterPoint: string
  nearestHospital: string
  firstAidEyewashLocation: string
  weatherNotes: string
  windSpeed: string           // relevant for MEWP / work at height
  // Cal/OSHA T8 §3395 Heat Illness Prevention (mandatory in CA)
  heatIllnessPlan: { water: boolean; shade: boolean; restBreaks: boolean; highHeatProcedures: boolean }
  // Integrated toolbox talk (supports IIPP T8 §3203 training/communication)
  toolboxTalkTopic: string
  toolboxTalkNotes: string
  // Roster of everyone briefed — collaborative signatures
  crewSignatures: CrewSignature[]
  supervisorSignatureId: string | null  // id within crewSignatures marking the supervisor
}

// ── Work-at-Height Permit ────────────────────────────────────
export interface HeightPermit extends SafetyRecordBase {
  type: 'height-permit'
  status: PermitStatus
  workDescription: string
  workingHeight: string                 // e.g. "8 m" / "26 ft"
  accessMethod: string[]                 // MEWP/scissor, boom, ladder, scaffold, fixed platform, rope access
  fallProtection: string[]               // guardrails, PFAS (harness+lanyard/SRL), netting, hole covers, travel restraint
  anchorPoints: string                   // location + rating (≥5000 lb / engineered)
  rescuePlan: string                     // suspension-trauma rescue plan (required when PFAS used)
  checklist: PermitCheckItem[]           // HEIGHT_PERMIT_CHECKLIST
  validFrom: string                      // ISO datetime
  validUntil: string                     // ISO datetime (time-limited; default same shift)
  workers: CrewSignature[]               // each worker acknowledges
  issuerSignatureId: string | null       // competent person / supervisor issuing
  closedAt: string | null
  closedBy: string | null
}

// ── Hot Work Permit ──────────────────────────────────────────
export interface HotWorkPermit extends SafetyRecordBase {
  type: 'hot-work-permit'
  status: PermitStatus
  workDescription: string
  hotWorkTypes: string[]                 // welding, cutting, grinding, brazing, soldering, torch
  checklist: PermitCheckItem[]           // HOT_WORK_CHECKLIST (NFPA 51B / 29 CFR 1910.252)
  fireWatchRequired: boolean
  fireWatchName: string
  fireWatchPostDurationMin: number       // monitoring after completion (NFPA 51B: ≥30, often 60)
  extinguisherLocation: string
  extinguisherType: string               // e.g. ABC, CO2
  sprinklerStatus: string                // in service / impaired / N/A
  gasTestRequired: boolean
  gasTestNotes: string                   // LEL etc. if flammable atmosphere possible
  validFrom: string
  validUntil: string
  workers: CrewSignature[]
  issuerSignatureId: string | null
  closedAt: string | null
  closedBy: string | null
}

// ── Confined Space Entry Permit ──────────────────────────────
export interface AtmosphericReading {
  oxygenPct: string                      // acceptable 19.5–23.5%
  lelPct: string                         // < 10%
  coPpm: string                          // < 35 ppm (Cal/OSHA PEL reference)
  h2sPpm: string                         // < 10 ppm
  testedBy: string
  testedAt: string                       // ISO; re-test/continuous monitoring noted in checklist
}

export interface ConfinedSpacePermit extends SafetyRecordBase {
  type: 'confined-space-permit'
  status: PermitStatus
  spaceDescription: string
  hazards: string[]                      // atmospheric, engulfment, configuration/entrapment, mechanical, electrical, thermal
  atmospheric: AtmosphericReading
  continuousMonitoring: boolean
  ventilationInUse: boolean
  rescuePlan: string                     // non-entry retrieval / emergency services
  checklist: PermitCheckItem[]           // CONFINED_SPACE_CHECKLIST (29 CFR 1910.146 / T8 §5157)
  entrySupervisorSignatureId: string | null
  attendantName: string                  // dedicated attendant required
  entrants: CrewSignature[]
  validFrom: string
  validUntil: string
  closedAt: string | null
  closedBy: string | null
}

// ── Incident / Near-Miss Report ──────────────────────────────
export type IncidentType = 'injury' | 'near-miss' | 'property-damage' | 'environmental'
export type IncidentSeverity = 'minor' | 'moderate' | 'serious' | 'critical'

export interface IncidentReport extends SafetyRecordBase {
  type: 'incident-report'
  incidentType: IncidentType
  severity: IncidentSeverity
  occurredAt: string                     // ISO datetime of the event (may differ from createdAt)
  description: string
  immediateActions: string
  witnesses: string[]
  rootCause: string
  correctiveActions: string
  // Cal/OSHA serious-injury reporting reminder (T8 §342 / LC §6409.1): within 8 hours.
  reportedToCalOsha: boolean
  photoSlots: string[]                   // IndexedDB blob slot ids
  reporterSignatureId: string | null
}

export type SafetyRecord =
  | PreTaskPlan | HeightPermit | HotWorkPermit | ConfinedSpacePermit | IncidentReport

// Color maps (mirror style of *_COLORS in types.ts)
export const RISK_COLORS: Record<RiskLevel, string> = {
  critical: '#EF4444', high: '#F97316', medium: '#EAB308', low: '#6B7280',
}
export const PERMIT_STATUS_COLORS: Record<PermitStatus | 'expired', string> = {
  active: '#22C55E', closed: '#6B7280', revoked: '#EF4444', expired: '#F97316',
}
```

**Type-narrowing convention:** discriminate on `record.type`. Provide a couple of guards (`isPermit(r)`, `isPTP(r)`) in `safety-types.ts` for ergonomics.

---

## 8. Data layer — `src/lib/safety-records.ts` (THE SWAP POINT)

Mirror `src/lib/inspections.ts` exactly in structure and comments. Public API only; components never touch storage.

**Storage keys**
- `eqr-safety-records` — array of `SafetyRecord` (metadata; no image blobs inside).
- `eqr-safety-counters` — `{ [prefix: string]: { year: number; count: number } }`.
- IndexedDB: reuse the existing `eqr-photo-store` DB / `photos` store (open via the same helper; consider exporting `openPhotoDB` from `inspections.ts` or duplicating the tiny helper). Blob keys: `${recordId}:${slotId}` where `slotId` is a signature id or photo slot id. **Signatures and incident photos are base64 — they MUST go to IndexedDB, never localStorage** (localStorage ~5 MB cap; a PTP with 8 signatures + an incident with photos would blow it).

**ID prefixes** (year-scoped counter, zero-padded to 4, same format as `INS-YYYY-0001`):
- `PTP` Pre-Task Plan · `WAH` Work-at-Height · `HWP` Hot Work · `CSP` Confined Space · `INC` Incident.
- `nextId(prefix)` reads/increments `eqr-safety-counters[prefix]`, resetting on year change.

**Required exports**

```ts
// reads
getAllSafetyRecords(): SafetyRecord[]                       // newest first
getSafetyRecordById(id): SafetyRecord | undefined
getSafetyRecordsByType(type): SafetyRecord[]
getRecordsForDate(date: string): SafetyRecord[]             // for "today" dashboard
getActivePermits(): (HeightPermit|HotWorkPermit|ConfinedSpacePermit)[]  // status==='active' && !expired
getOpenSafetyCount(): number                                 // active permits + open(unresolved) incidents → nav badge

// permit lifecycle helpers
isExpired(p): boolean                                        // now > validUntil
permitDisplayStatus(p): PermitStatus | 'expired'

// creates (each stamps identity via getCurrentIdentity(), pushes 'created'+'submitted' events,
// sets syncStatus, persists blobs to IndexedDB, then notify(), then fire-and-forget sync)
createPreTaskPlan(input): PreTaskPlan
createHeightPermit(input): HeightPermit
createHotWorkPermit(input): HotWorkPermit
createConfinedSpacePermit(input): ConfinedSpacePermit
createIncidentReport(input): IncidentReport

// permit transitions (append event; do NOT mutate historical fields)
closePermit(id, by): SafetyRecord | undefined
revokePermit(id, by, note): SafetyRecord | undefined

// blobs
saveSignatures(recordId, sigs: {id,dataUrl}[]): Promise<void>
savePhotosForRecord(recordId, photos: {id,dataUrl}[]): Promise<void>
getBlobs(recordId, slotIds: string[]): Promise<Record<string,string>>

// sync
markSynced(id, notionPageId): void
markSyncFailed(id): void
trySyncRecord(id): Promise<boolean>     // delegates to safety-sync.ts; updates status+events
syncAllPending(): Promise<void>         // called on load + on 'online' event

// pub/sub (identical pattern to inspections.ts)
onSafetyChange(fn: () => void): () => void

// export
exportSafetyToCsv(records): string      // one row per record; type-aware columns flattened
```

**Immutability rule (audit integrity):** there is **no generic `update`**. The only mutations allowed post-creation are: (a) appending `AuditEvent`s, (b) permit `status`/`closedAt`/`closedBy` via `closePermit`/`revokePermit`, (c) `syncStatus`/`notionPageId` via the sync helpers. Anything else (a correction to a submitted record) is modeled as a **new linked record** or an `amended` event with a note — never an in-place field edit. Put a comment block at the top of the file stating this, like the existing swap-point comment.

**SSR safety:** every function guards `typeof window === 'undefined'` exactly like the existing libs (these pages are client components but the lib may be imported in server context).

---

## 9. Permit & checklist content — `src/data/safety-checklists.ts`

Follow the `ChecklistDefinition` shape from `inspection-checklists.ts` (`{ id, label, category, critical }` items grouped by `category`). Provide builder `buildPermitItems(defKey): PermitCheckItem[]` analogous to `buildBlankItems`. Items default `checked:false, notes:''`. `critical:true` items must be checked before the permit can be issued.

The content below is the **minimum required**; it encodes real OSHA / Cal-OSHA / NFPA requirements so the forms are authoritative, not decorative. Citations are included as a trailing `regRef` string on the section or as a `note` — render them subtly (gray, `text-[10px]`) so crews see the basis.

### 9.1 `HEIGHT_PERMIT_CHECKLIST`
*Basis: 29 CFR 1926.501/.502 (construction, 6 ft trigger) & 1910.28/.29 (GI, 4 ft); Cal/OSHA T8 §1669–§1671.1, §3209–§3212; ANSI/MEWP A92 for platforms.*

- **Access & Platform**
  - Guardrails present: top rail 42″ (±3″), midrail ~21″, toeboard ≥3.5″ where required *(critical)*
  - MEWP/scissor selected, inspected (pre-use), on firm level ground, within rated capacity & wind limits *(critical)*
  - Ladders/scaffold inspected, secured, correct duty rating
  - Floor/leading-edge openings & holes covered or guarded *(critical)*
- **Personal Fall Arrest (when guardrails not feasible)**
  - Full-body harness inspected — no cuts, frays, UV/heat damage, corroded hardware *(critical)*
  - Lanyard/SRL inspected; shock pack intact
  - Anchor point identified, ≥5,000 lb per worker or engineered/certified *(critical)*
  - Total fall clearance calculated (free fall + deceleration + harness stretch + safety margin) *(critical)*
  - Travel-restraint vs fall-arrest configuration appropriate
- **Rescue & Dropped Objects**
  - Suspension-trauma rescue plan in place; means of prompt rescue available *(critical)*
  - Tools tethered / toe-boards / exclusion zone below established
  - Area below barricaded; signage posted

### 9.2 `HOT_WORK_CHECKLIST`
*Basis: 29 CFR 1910.252 & 1926.352; NFPA 51B; Cal/OSHA T8 §4848, §4799 (cylinders).*

- **Area Preparation (within 35 ft)**
  - Combustibles removed or protected with fire-resistant covers within 35 ft *(critical)*
  - Floors swept clean; flammable liquids/dusts removed *(critical)*
  - Wall/floor openings & cracks covered; conveyors/ducts protected
  - Enclosed/concealed combustibles (other side of walls) checked
- **Fire Suppression & Watch**
  - Charged, inspected extinguisher of correct type present at work point *(critical)*
  - Fire watch assigned, trained, equipped; remains during work + post-work monitoring *(critical)*
  - Sprinkler system in service (or impairment authorized & documented)
- **Equipment & Atmosphere**
  - Welding/cutting equipment inspected; leads, hoses, regulators sound
  - Compressed-gas cylinders secured upright, caps/flash-arrestors as required
  - Atmosphere tested where flammable vapors possible; LEL acceptable *(critical when applicable)*
  - Adequate ventilation / fume control for the process & materials

### 9.3 `CONFINED_SPACE_CHECKLIST`
*Basis: 29 CFR 1910.146 (GI) & 1926.1200–1213 (construction); Cal/OSHA T8 §5157.*

- **Authorization & Roles**
  - Space evaluated; permit-required determination made *(critical)*
  - Entry supervisor authorized entry; entrants & attendant assigned *(critical)*
  - Dedicated attendant stationed outside for entire entry *(critical)*
  - Entry/exit log maintained
- **Atmosphere (test in order: O₂ → flammable → toxic)**
  - O₂ 19.5–23.5% *(critical)*
  - Flammable < 10% LEL *(critical)*
  - CO / H₂S within limits *(critical)*
  - Continuous monitoring in place; re-test after breaks
- **Controls & Rescue**
  - Forced-air ventilation operating before & during entry
  - Hazardous energy isolated/locked out; lines blanked/blinded as needed
  - Non-entry retrieval system (harness + retrieval line) rigged where feasible *(critical)*
  - Rescue services / plan confirmed available & summoned-able *(critical)*
  - Communication method between attendant & entrants established

### 9.4 PTP hazard library — `PTP_HAZARD_LIBRARY`
Quick-add chips (each pre-fills a `HazardEntry` with a suggested `controlMeasure` the user can edit):

`Working at height` · `Falling/dropped objects` · `Pinch / crush points` · `Overhead loads / lifting` · `Powered industrial trucks / mobile plant` · `Electrical / energized parts` · `Hot work / fire` · `Confined space` · `Manual handling / ergonomics` · `Slips, trips & falls` · `Noise` · `Silica / dust / fumes` · `Heat illness` (auto-links to the heat-illness block) · `Pressurized systems` · `Sharp edges / cuts` · `Public / vehicle interface`.

### 9.5 `PPE_OPTIONS` — `src/data/safety-checklists.ts`
*Basis: 29 CFR 1910.132 / 1926.28; Cal/OSHA T8 §3380 et seq.*
`Hard hat` · `Safety glasses` · `Face shield` · `Hearing protection` · `Hi-vis vest` · `Steel/composite-toe boots` · `Cut-resistant gloves` · `Welding PPE (jacket/shield)` · `Respirator (specify)` · `Fall-arrest harness` · `Arc-flash PPE`. Each has `{ id, label }`; render as a wrap of toggle chips in `PPESelector`.

---

## 10. Pages & components (Phase 4)

### 10.1 Safety Hub dashboard — `/safety` (`SafetyDashboard.tsx`)

Wrapped in `<AuthGate>`. Mobile-first single column; `max-w-2xl mx-auto px-4 py-6` container (match existing page paddings).

Sections, top to bottom:
1. **Greeting + date.** "Good morning, {firstName}" + today's date; small "signed in as {email}" line.
2. **Today's status row** — three stat cards (grid, 3-up on `sm+`, stacked on mobile):
   - *Today's PTP*: ✓ "Logged ({n} crew)" if a PTP exists for today's date, else amber "Not started" with a Start button.
   - *Active permits*: count; tap → filtered history.
   - *Open incidents (7d)*: count.
3. **Quick actions** — large tap targets (grid of buttons, icon + label): Start PTP, Work-at-Height Permit, Hot Work Permit, Confined Space Permit, Report Incident, and a secondary link "Pre-Trip Inspection →" (routes to existing `/inspections`, preserving that flow). Use Lucide icons: `ClipboardList` (PTP), `MoveVertical`/`ArrowUpFromLine` (height), `Flame` (hot work), `Box`/`PackageOpen` (confined space), `AlertTriangle` (incident), `Truck` (pre-trip).
4. **Active permits** — list of `SafetyRecordCard` with `PermitStatusBadge` + live `PermitTimer` ("Expires in 3h 12m" / red "EXPIRED — close out"). Tap → `/safety/record/[id]`.
5. **Recent activity (7 days)** — last few records; "View full history →" link to `/safety/history`.

Subscribe to `onSafetyChange` and the `storage` event (copy `NavHeader` pattern) to live-update counts.

### 10.2 Shared form components

- **`SignaturePad.tsx`** — see §11 (full spec).
- **`CrewSignatureBlock.tsx`** — `{ signatures, onChange, requireSupervisor?, roleOptions?, title }`. Renders the current roster (name + role chip + ✓ "signed" + timestamp + thumbnail) and an **"Add signature"** flow: a modal/inline panel with (a) name input with autocomplete from `src/data/crew.ts` (free text allowed), (b) optional role select, (c) `<SignaturePad>`, (d) Save/Cancel. On save: capture the PNG dataURL into a transient map keyed by signature id (parent form holds dataURLs until submit, then hands them to `saveSignatures`). Enforce non-empty drawing before allowing Save. Allow removing a not-yet-submitted signature. The first signer or a flagged one can be marked supervisor/issuer.
- **`HazardTable.tsx`** — `{ hazards, onChange }`. Quick-add chips from `PTP_HAZARD_LIBRARY`; each row: description (text), risk level (segmented `low/med/high/critical` colored via `RISK_COLORS`), control measure (text), remove (X). Add-row button. Mobile: stack fields within a `bg-mytra-card` row.
- **`PPESelector.tsx`** — wrap of toggle chips from `PPE_OPTIONS`; controlled `string[]`.
- **`PermitChecklist.tsx`** — `{ items, onChange }`. Grouped by `category` with eyebrow headers (reuse section header recipe). Each item: a checkbox/toggle (checked = `bg-mytra-purple`/green; unchecked = bordered), the label, a `critical` chip, and an optional notes input that appears when relevant. Compute and surface "{n} required items remaining" to gate submit (mirror the Pre-Trip "items remaining" affordance).
- **`PermitTimer.tsx`** — `{ validUntil, status }`. `useEffect` ticking every 30s; renders remaining time or "EXPIRED"/"Closed"/"Revoked" with `PERMIT_STATUS_COLORS`.
- **`PermitStatusBadge.tsx`** — pill using `permitDisplayStatus`.
- **`SafetyRecordCard.tsx`** — compact row: type icon, id (mono), title/scope, location, createdBy, relative time, status/sync dot (reuse the sync-dot pattern from `InspectionHistory`). Tap → record view.
- **`RecordView.tsx`** — read-only, print-friendly render of any `SafetyRecord` (used by `/safety/record/[id]`). Show all fields, the hazard table, checklist results, every signature (load blobs via `getBlobs`), and the full `events` audit trail. Add a print button (reuse `window.print()` + the existing `no-print`/print CSS) so a permit can be printed/exported as PDF if an inspector demands paper. This is the **auditable artifact**.

### 10.3 The five forms

All forms: wrapped in `<AuthGate>`, multi-step where helpful (mirror Pre-Trip's `identify → details → review/submit`), sticky submit, disable submit until required fields + critical checklist items are satisfied, then call the matching `create*` in `safety-records.ts`, then show a success result screen with the new record id and a "View / Print" and "New" action. Prefill `location`/`projectName` from the most recent record of the day for friction reduction (read-only suggestion the user can change).

- **`PreTaskPlanForm.tsx`** (`/safety/ptp`):
  Step 1 *Plan*: date (default today), shift, projectName, location, scopeOfWork, **`SageAssist`** (dormant by default — sits directly above the hazard table; see §13), `HazardTable`, `PPESelector`, site-conditions block (muster point, nearest hospital, first-aid/eyewash, weather, wind), **Heat Illness** block (4 toggles, T8 §3395), toolbox talk topic + notes.
  Step 2 *Sign-on*: `CrewSignatureBlock` (collaborative — pass the device around). Mark one signer as supervisor (`requireSupervisor`).
  Submit → `createPreTaskPlan`. Success screen: "PTP logged — {n} crew signed on."
  *Friction note:* allow saving the plan (step 1) and adding signatures progressively; a PTP is valid once ≥1 supervisor + ≥1 crew signature exist, but allow more sign-ons to be appended during the same session before final submit.
- **`HeightPermitForm.tsx`** (`/safety/permits/height`): workDescription, workingHeight, accessMethod (multiselect), fallProtection (multiselect), anchorPoints, rescuePlan (required if PFAS chosen), `PermitChecklist(HEIGHT_PERMIT_CHECKLIST)`, validFrom/validUntil (default now → end of shift), worker sign-ons + issuer signature. Submit → `createHeightPermit` (status `active`).
- **`HotWorkPermitForm.tsx`** (`/safety/permits/hot-work`): workDescription, hotWorkTypes (multiselect), `PermitChecklist(HOT_WORK_CHECKLIST)`, fire watch (name + post-duration default 30/60 min), extinguisher location/type, sprinkler status, gas test toggle/notes, validity window, worker + issuer signatures. Submit → `createHotWorkPermit`.
- **`ConfinedSpaceForm.tsx`** (`/safety/permits/confined-space`): spaceDescription, hazards (multiselect), `AtmosphericReading` inputs (O₂/LEL/CO/H₂S + testedBy/testedAt, with inline acceptable-range hints and validation coloring), continuousMonitoring + ventilationInUse toggles, rescuePlan, `PermitChecklist(CONFINED_SPACE_CHECKLIST)`, entry supervisor signature, attendant name, entrant sign-ons, validity window. Submit → `createConfinedSpacePermit`.
- **`IncidentReportForm.tsx`** (`/safety/incident`): incidentType, severity, occurredAt (datetime), location, description, immediateActions, witnesses (chips), rootCause, correctiveActions, **photo capture** (reuse `compressPhoto` + IndexedDB), Cal/OSHA serious-injury reminder banner (if severity ∈ {serious, critical}: amber note "Serious injuries must be reported to Cal/OSHA within 8 hours — T8 §342" + a `reportedToCalOsha` toggle), reporter signature. Submit → `createIncidentReport`.

### 10.4 History — `/safety/history` (`history/page.tsx`)
List of all records via `getAllSafetyRecords`, newest first. Filters: type (chips), status, date range, free-text search over id/location/project/createdBy. Each row = `SafetyRecordCard`. "Export CSV" button (reuse the blob-download approach used for work orders/inspections). A per-record "Retry sync" action when `syncStatus !== 'synced'`.

### 10.5 Record view — `/safety/record/[id]`
Renders `RecordView`. For permits, show **Close permit** / **Revoke** actions (with a reason note for revoke) that call the lifecycle helpers and append events. Print button. This page is reachable from QR labels later (the `/admin/labels` generator could be extended to emit permit/record QR codes — note as future, not required now).

---

## 11. SignaturePad — full implementation spec (`src/components/SignaturePad.tsx`)

No third-party library (keeps the dependency footprint lean, matching the project). Pure canvas + Pointer Events.

**Props**
```ts
interface SignaturePadProps {
  onChange: (dataUrl: string | null, isEmpty: boolean) => void
  height?: number       // CSS px, default 180
  className?: string
  penColor?: string     // default '#FFFFFF' (dark theme); on print, strokes export as-is
}
```

**Requirements & gotchas (implement all):**
1. `'use client'`. A `<canvas>` inside a `bg-mytra-input border border-mytra-border rounded-lg` wrapper, full width, fixed `height`.
2. **High-DPI:** size the canvas backing store to `clientWidth * devicePixelRatio` × `height * dpr`, set CSS size to logical px, and `ctx.scale(dpr, dpr)`. Recompute on resize (ResizeObserver) — but **preserve the current drawing** across resize (re-draw from a stored path or snapshot). Simplest robust approach: keep an in-memory list of strokes (arrays of points) and re-render on resize; export from the canvas.
3. **Pointer Events** (`pointerdown/move/up/leave`) unify mouse/touch/stylus. Call `e.preventDefault()` and set the canvas CSS `touch-action: none` so drawing never scrolls the page on mobile. Use `setPointerCapture`.
4. Coordinates = `e.clientX/Y` minus `canvas.getBoundingClientRect()` top/left (logical px).
5. Smooth lines: `lineJoin='round'`, `lineCap='round'`, `lineWidth≈2.2`, quadratic smoothing between points is a nice-to-have.
6. **Empty detection:** track whether any stroke was drawn; expose via `onChange(null, true)` when empty and `onChange(dataUrl, false)` after the first stroke ends (export via `canvas.toDataURL('image/png')`). The signature blocks must refuse to "Save" an empty pad.
7. **Clear** button (small, top-right, `no-print`) resets strokes + canvas + emits empty.
8. Accessibility: wrapper has `role="img"` + `aria-label="Signature pad"`; provide a visually-hidden hint "Draw your signature with finger or stylus." Keyboard users can't draw — that's acceptable for a signature, but ensure the surrounding Save/Cancel are reachable.
9. Export is the **trimmed** PNG ideally (optional: compute bounding box of strokes and export only that region to keep blobs small). At minimum, PNG of the canvas. Typical size 3–30 KB — fine for IndexedDB.
10. Re-usable across PTP crew sign-on, permit worker/issuer signatures, and incident reporter signature.

---

## 12. Notion sync (Phase 5)

### 12.1 Client wrapper — `src/lib/safety-sync.ts`
- `trySync(record): Promise<{ok:boolean; notionPageId?:string}>` POSTs the record JSON to `/api/safety/sync`. On success → caller calls `markSynced`; on failure/offline → `markSyncFailed` and leave `syncStatus` `pending`/`offline`.
- Wire `syncAllPending()` to run: once on app load (in `SafetyDashboard` mount) and on `window.addEventListener('online', …)`. Fire-and-forget; never block UI. **Do not** send IndexedDB image blobs in v1 (see limitation below).

### 12.2 Server route — `src/app/api/safety/sync/route.ts`
App Router `POST` handler. Mirror the env-guard pattern of `api/sync-inspection.ts`:
```ts
export async function POST(req: Request) {
  const key = process.env.NOTION_API_KEY
  const dbId = dbForType(body.type)          // map record type → its DB id env var
  if (!key || !dbId) return Response.json({ error:'Notion not configured' }, { status: 503 })
  // POST https://api.notion.com/v1/pages with headers:
  //   Authorization: Bearer <key>
  //   Notion-Version: 2022-06-28
  //   Content-Type: application/json
  // body: { parent:{ database_id: dbId }, properties: {...}, children:[ <code block w/ full JSON> ] }
}
```
- Use **raw `fetch`** (no `@notionhq/client` dependency).
- `dbForType`: `ptp→NOTION_PTP_DB_ID`, `*-permit→NOTION_PERMITS_DB_ID`, `incident-report→NOTION_INCIDENTS_DB_ID`.
- **Property mapping** (create these properties in the Notion DBs): `ID` (title), `Type` (select), `Project` (rich_text), `Location` (rich_text), `Created By` (rich_text/email), `Created At` (date), `Status` (select, for permits), `Result/Severity` (select where applicable), `Signatures` (number = count), `Sync Source` (select "equipment-qr-hub"). Put the **entire record JSON** into a page-body `code` block so nothing is lost even if a property is missing — this guarantees the audit content survives.
- Return `{ ok:true, notionPageId: res.id }`.
- **Image limitation (document in code + README):** Notion's API cannot ingest base64 images directly. v1 keeps signatures/photos in the device IndexedDB and records only their count/presence in Notion. **Future enhancement:** upload blobs to Vercel Blob (or S3) and attach the public URLs as Notion `files`/`url` properties. Leave a clearly-marked `TODO(blob-upload)` seam; do not implement now.

---

## 13. Sage — the (optional, dormant) AI safety assistant

**Sage** is the product name for the Claude-powered helper inside the Safety Hub. **Scaffold its UX/UI fully as described here, but ship it dormant.** With no `ANTHROPIC_API_KEY` configured (and/or the public flag off), **no Sage UI renders at all** and there is zero cost or behavioral impact. The core module never depends on Sage. The value when enabled: when a foreman types the scope of work, Sage drafts likely hazards + control measures for the crew to review/edit — cutting the blank-page friction of the morning plan without removing human judgment.

### 13.1 Persona & voice
- **Name:** Sage. **Role:** a calm, experienced site-safety advisor — like a seasoned EHS lead looking over the foreman's shoulder.
- **Tone:** concise, plain-language, practical, never alarmist or preachy. Always defers to the human ("review before signing").
- **Identity in UI:** a `Sparkles` Lucide icon in `mytra-purple`, the name **"Sage"** in `text-mytra-purple`, and a one-line tagline on first reveal: *"Sage · your safety co-pilot."* Sage never claims certainty; everything it produces is a draft.
- **Hard boundaries:** Sage only **suggests**. It never auto-submits, never signs, never closes/revokes a permit, and never satisfies a `critical` checklist item on the user's behalf. Every Sage output is editable and clearly labeled AI-generated.

### 13.2 Where Sage lives & how it behaves (v1 capability: hazard suggestions)
On the **Pre-Task Plan** form, Step 1, **directly above the `HazardTable`**. Implemented as a dedicated, reusable component **`src/components/safety/SageAssist.tsx`** (props `{ scopeOfWork, location, existingHazards, onAddHazards }`).

**Dormant state (default — what ships):** `SageAssist` returns `null` when `process.env.NEXT_PUBLIC_AI_ASSIST !== '1'`. The PTP renders exactly as if Sage didn't exist — no button, no panel, no placeholder. The server route additionally hard-guards on `ANTHROPIC_API_KEY`, so even a stray flag with no key fails closed to manual entry.

**Active-state UX (only when enabled) — scaffold all of this now, just behind the flag:**
1. **Trigger** — a subtle, full-width ghost button above the hazard table: `Sparkles` + "Ask Sage to suggest hazards". Style `bg-mytra-purple-glow border border-mytra-purple/30 text-mytra-purple rounded-lg`, hover → `border-mytra-purple/60`. Disabled with helper text "Add a scope of work first" until `scopeOfWork` has a few words.
2. **Loading** — button morphs to a pulsing "Sage is thinking…" (sparkles opacity-pulse; reuse `animate-fadeIn`). **Non-blocking** — the rest of the form stays fully editable. Client-side hard timeout ~12s.
3. **Results panel** — `bg-mytra-card border border-mytra-purple/30 rounded-lg p-3 animate-fadeInUp`. Header: `Sparkles` + "Sage suggests — review before signing". Each suggestion is a row: risk chip (colored via `RISK_COLORS`), description, suggested control measure, a multi-select checkbox, and a quick **＋ Add**. Footer: **"Add selected"** + **"Dismiss"**. Nothing enters the plan without an explicit tap; added items become normal **editable** `HazardEntry` rows in `HazardTable`.
4. **Provenance (audit honesty)** — a hazard row that originated from Sage shows a tiny `text-[10px] text-mytra-purple` "via Sage" tag in `HazardTable` until the user edits it. Store an additive `source?: 'sage' | 'manual'` on `HazardEntry` (defaults `'manual'`). This keeps the trail clear about what was AI-drafted vs human-authored.
5. **Empty / regenerate** — if Sage returns nothing useful: "No suggestions — add hazards manually." Offer a client-side rate-limited "Regenerate" to avoid cost surprises.

### 13.3 Technical seam (build the files now, inert)
- **Component:** `src/components/safety/SageAssist.tsx` — `'use client'`; renders `null` unless `NEXT_PUBLIC_AI_ASSIST === '1'`.
- **Route:** `src/app/api/safety/suggest-hazards/route.ts` (App Router `POST`). Input `{ scopeOfWork, location }`. **Hard guard:** if `!process.env.ANTHROPIC_API_KEY` → `Response.json({ hazards: [] }, { status: 200 })` (fail-closed, never 500). The key is server-only and never reaches the browser.
- **SDK & model:** `@anthropic-ai/sdk` — **added only when the feature is turned on**, not a default dependency. Model **`claude-sonnet-4-6`** (best latency/cost for this short structured task; `max_tokens ≈ 600`).
- **Structured output:** request a JSON array of `{ description, riskLevel: 'low'|'medium'|'high'|'critical', controlMeasure }` via a tool-call/JSON contract; parse defensively; on any parse/shape error return `[]`.
- **Prompt caching (required when implemented):** the system prompt is a stable OSHA / Cal-OSHA hazard-identification rubric scoped to structural commissioning — mark it `cache_control: { type: 'ephemeral' }` so repeated morning calls hit cache and cost drops. Keep user content minimal (scope + location). **No background/automatic calls** — Sage runs only on explicit tap.
- **Failure handling:** any error/timeout → silent fallback to manual entry; never block or error the PTP.
- **Cost posture:** typically cents-per-hundred calls, less with caching; document a one-liner in README.

### 13.4 Future Sage capabilities (spec-only — do NOT build now)
The same `SageAssist` + server-route pattern can later power, all opt-in and human-reviewed behind the same flag:
- **Incident assist** — draft a root-cause / corrective-action starting point from an incident description.
- **Toolbox-talk topics** — suggest a relevant daily topic from the day's scope/hazards.
- **Permit sanity check** — advisory flag of a likely-missing control before issue (never blocks).
- **Notion digest** — summarize a record for the office sync.

Naming stays consistent across every capability: it is always **Sage**, always a co-pilot, always "review before signing."

---

## 14. Environment variables — `.env.example`

```
# Auth (required for Safety Hub)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=            # openssl rand -base64 32
NEXTAUTH_URL=              # e.g. https://equipment-qr-hub.vercel.app
ALLOWED_EMAIL_DOMAINS=mytra.ai   # comma-separated; server-enforced

# Notion sync (optional; sync is a no-op 503 until set)
NOTION_API_KEY=
NOTION_PTP_DB_ID=
NOTION_PERMITS_DB_ID=
NOTION_INCIDENTS_DB_ID=
NOTION_INSPECTIONS_DB_ID=  # (existing) pre-trip inspections

# Sage — AI safety assistant (optional; Sage UI is absent unless BOTH are set)
ANTHROPIC_API_KEY=         # server-only; without it Sage fails closed to manual entry
NEXT_PUBLIC_AI_ASSIST=     # set to 1 to reveal the "Ask Sage to suggest hazards" UI
```

**Google Cloud setup (document in README):** create OAuth client (Web), authorized redirect URI `https://<domain>/api/auth/callback/google` (+ `http://localhost:3000/api/auth/callback/google` for dev), set consent screen to Internal if the workspace is Google Workspace (this alone restricts to the org, but keep the server-side domain check regardless).

---

## 15. Navigation & layout changes

- `src/app/layout.tsx`: import and wrap: `<AuthProvider><NavHeader/>{children}</AuthProvider>`. Nothing else changes (keep `dark`, Roboto, safe-area body classes).
- `src/components/NavHeader.tsx`:
  - Add a nav entry `{ href: '/safety', label: 'Safety', icon: ShieldCheck, badge: <openSafetyCount> }` placed after "Pre-Trip" (order: Directory · Pre-Trip · **Safety** · Work Orders · QR Labels).
  - Compute the badge from `getOpenSafetyCount()`, subscribed via `onSafetyChange` + `storage` event, exactly like the existing `getOpenCount()`/`onWorkOrderChange` wiring.
  - Mount `<UserMenu/>` at the far right of the `<nav>`.
  - With 5 items the mobile bar stays icon-only (`hidden sm:inline` labels already handle this). If it feels crowded on small phones, that's acceptable; do **not** restructure the existing nav beyond adding this item + user menu.

---

## 16. Acceptance criteria (definition of done)

Functional:
1. Visiting any `/safety/*` route while signed out (and online) shows the Mytra Google sign-in; a non-`@mytra.ai` Google account is **rejected** with a clear message; a valid account proceeds.
2. After one successful login, going **offline** still allows creating/submitting every form; the amber "offline as {name}" banner shows; records persist locally with `syncStatus` `offline`/`pending` and the verified identity stamped.
3. **PTP:** create with ≥2 hazards, PPE selected, heat-illness block set, toolbox topic, and ≥1 supervisor + ≥1 crew signature drawn on the pad; appears on the dashboard as "Today's PTP ✓ ({n} crew)" and in history; each signature has its own timestamp.
4. **Height / Hot Work / Confined Space permits:** cannot be issued until all `critical` checklist items are checked and required fields/signatures present; once issued they appear under "Active permits" with a live countdown; **Close** and **Revoke** work and append audit events; an expired permit shows "EXPIRED" styling.
5. **Confined space** atmospheric inputs validate against acceptable ranges (visual warning when out of range) but still allow saving (with the reading recorded).
6. **Incident:** photos capture, compress, and persist to IndexedDB; serious/critical severity shows the Cal/OSHA 8-hour reporting banner + toggle.
7. **Record view** renders any record read-only with full signatures and the complete `events` audit trail; prints cleanly (dark UI → white print via existing print CSS).
8. **History** filters by type/status/date/text and exports CSV.
9. **Nav badge** reflects active permits + open incidents and updates live across tabs.
10. **Notion sync:** with env vars set, submitting a record creates a Notion page (verified via returned page id) and flips `syncStatus` to `synced`; with env vars **unset**, the app works normally and records stay `pending` (no errors surfaced to the user).
11. **Pre-Trip inspections, Directory, Work Orders, QR Labels** all still work exactly as before; pre-trip inspector name now prefills from the session when signed in.

Non-functional:
12. `npm run build` and `npm run lint` pass with no new TypeScript or lint errors; strict mode satisfied.
13. No new runtime dependency other than `next-auth` (and, only if Sage is turned on, `@anthropic-ai/sdk`). With Sage dormant (default), no Sage UI renders and no Anthropic calls are made.
14. All new UI uses only `mytra-*` tokens / existing recipes; looks native on a phone in one hand; passes a quick `prefers-reduced-motion` and keyboard-focus check.
15. PWA offline: `/safety` and its forms load and function offline after first visit; `/api/auth/*` and `/api/safety/*` are never served from cache.

---

## 17. Suggested build order (each step independently shippable)

1. **Auth foundation** — `next-auth`, `lib/auth.ts`, `[...nextauth]/route.ts`, `AuthProvider`, `AuthGate` (with offline identity cache), `UserMenu`, layout + NavHeader wiring, `.env.example`, README/Google setup. *Ship: protected `/safety` placeholder.*
2. **SignaturePad** + `lib/media.ts` extraction. *Ship: reusable, demoable signature capture.*
3. **Data layer** — `safety-types.ts`, `safety-records.ts` (CRUD/IDs/pub-sub/blobs/immutability), `safety-checklists.ts`, `crew.ts`. *Ship: unit-exercise via a temporary scratch, then delete.*
4. **Dashboard** + `SafetyRecordCard`/`PermitStatusBadge`/`PermitTimer` + NavHeader badge. *Ship: hub that lists nothing yet.*
5. **PTP** (highest daily value) — `PreTaskPlanForm`, `HazardTable`, `PPESelector`, `CrewSignatureBlock`. *Ship: full morning workflow.*
6. **Height permit**, then **Hot Work**, then **Confined Space** (`PermitChecklist` shared). 
7. **Incident report** (photos).
8. **Record view + history + CSV + permit close/revoke**.
9. **Notion sync** (`safety-sync.ts`, `api/safety/sync`, online-listener, retry).
10. **Pre-Trip enhancement** (session prefill, optional `createdByEmail`).
11. **(Optional, last) Sage** — scaffold `SageAssist.tsx` + `suggest-hazards` route behind the env flag, shipped dormant. (Per current direction: scaffold the UX/UI now, keep it OFF.)

---

## 18. Assumptions & open items (flag if any are wrong)

- Company email domain is **`mytra.ai`** (from the product owner's address). `ALLOWED_EMAIL_DOMAINS` makes this configurable; confirm before go-live and add any subdomains.
- Mytra operates under **California (Cal/OSHA T8)** in addition to Fed OSHA — hence T8 citations and the mandatory **IIPP (§3203)** and **Heat Illness (§3395)** hooks baked into the PTP. If sites are out-of-state, the Fed OSHA citations still apply; adjust the displayed `regRef` strings per region later (content is data-driven in `safety-checklists.ts`, so this is a copy edit, not a code change).
- **LOTO**, **excavation/trenching**, and **crane/critical-lift** permits are intentionally **deferred** (not typical daily needs for structural commissioning crews; LOTO is partially covered today in equipment compliance). The data layer + checklist pattern make adding them later trivial — note this in README as the documented extension path.
- Signature/photo blobs stay on-device in v1 (IndexedDB) and are **not** uploaded to Notion (API limitation). The `RecordView` print-to-PDF is the portable audit artifact until the optional Blob-upload enhancement is built.
- Notion databases & their properties must be created by the team; the route degrades gracefully (503/no-op) until configured, exactly like the existing inspection sync.
```
