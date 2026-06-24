# Sage EHS

AI-powered EHS safety and equipment management PWA for construction, manufacturing, and engineering teams. Replaces paper-based pre-task plans, permits, job hazard analyses, incident reports, and equipment inspections with a searchable, offline-capable, QR-accessible web application.

**Live:** [equipment-qr-hub.vercel.app](https://equipment-qr-hub.vercel.app)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Security & Data Flow](#security--data-flow)
- [Authentication & Authorization](#authentication--authorization)
- [Third-Party Services](#third-party-services)
- [Environment Variables](#environment-variables)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Key Components](#key-components)
- [Documentation](#documentation)

---

## Features

### Safety Workflows (`/safety`)

- **Pre-Task Plans (PTP)** — Daily safety plans with scope of work, hazard identification, 5x5 risk matrix ratings, PPE selection, crew sign-on with touch-drawn signatures, and optional heat illness prevention / toolbox talk sections
- **Job Hazard Analysis (JHA)** — Step-by-step task breakdown with hazard identification, before/after control risk ratings, and AI-assisted drafting
- **Work Permits** — Height, hot work, and confined space permits with safety checklists, atmospheric monitoring fields, and timed validity with live countdown
- **Incident Reports** — Severity-rated reports with witness tracking, root cause analysis, corrective actions, and regulatory reporting flags
- **EHS Review Workflow** — Any record can be submitted for EHS manager review; notifications delivered via email (Resend), Notion, and/or Slack (each channel independently configurable)
- **Share & Print** — Web Share API with mailto fallback; formal print layout matching paper PTP/JHA templates with authorization signature blocks
- **Offline-First** — All forms work without connectivity. Records persist to localStorage, signatures and photos to IndexedDB. Pending records sync automatically on reconnect with retry logic.
- **Draft Persistence** — Form progress auto-saves every 2 seconds. Survives app crashes and device restarts; validates draft integrity on restore.

### Sage AI Assistant

An optional AI layer integrated into safety workflows, powered by Anthropic Claude:

- **Hazard Suggestions (PTP)** — Analyzes scope of work and location to suggest relevant hazards with risk levels and control measures
- **JHA Step Analysis** — Reviews each task step and drafts potential hazards, risk ratings (Low/Medium/High/Critical per EHS-MGT-001 section 4.3), and recommended controls without overwriting worker entries
- **Document Import (JHA)** — Parses uploaded task plans, method statements, or scopes of work to pre-fill JHA steps, hazards, and controls
- **Contextual Triage** — Conversational assistant aware of the current page, user identity, active permits, and PTP status

**Feature-flagged:** All AI features are dormant unless both `ANTHROPIC_API_KEY` and `NEXT_PUBLIC_AI_ASSIST=1` are set. No data is sent to Anthropic without explicit configuration.

### Equipment Management

- **Equipment Inventory** — Searchable catalog organized by category with status tracking
- **QR Code Labels** — Generate and print QR labels; scan to access equipment profile, inspection history, and PM schedule
- **Pre-Trip Inspections** — Digital checklists with photo capture, pass/fail per item, and draft persistence
- **Work Orders** — Create, assign, and track maintenance with priority levels and status
- **Preventive Maintenance** — Daily through annual PM schedules with due date tracking
- **Compliance** — Machine guarding status, regulatory references, training requirements, and OEM manual links per equipment item

### Guided Tours

Interactive module tours (21+ steps across 7 tours) with scroll-into-view targeting, keyboard navigation, and per-module completion tracking stored in localStorage.

---

## Architecture

### Deployment Model

The application is a statically-optimized Next.js 14 app deployed on Vercel. There is no application database — the design is intentionally stateless on the server side, with all record storage on the client device and durable copies delivered to configured external services (email, Notion, Slack).

### Sync & Submission Flow

```
Field Device (iPhone/iPad PWA)
  |  localStorage: record JSON + audit events
  |  IndexedDB: signature + photo blobs (binary)
  |  syncStatus: pending -> synced / failed
  |
  +---> POST /api/safety/sync ------------> Notion API (PTP/JHA/Permits/Incidents DBs)
  |       Retry with backoff (1s, 2s, 4s)
  |       503 -> stays pending, retries on next connectivity
  |
  +---> POST /api/safety/review/submit --+-> Notion API (sets "EHS Review: Pending")
          Fires on "Submit for EHS Review" +-> Email via Resend (full record as text)
          Any channel can be disabled       +-> Slack webhook (#ehs channel)
```

### API Routes

All API routes are Next.js serverless functions running on Vercel's edge/serverless infrastructure. No persistent server processes.

| Route | Purpose | External calls |
|-------|---------|----------------|
| `/api/safety/sync` | Sync records to Notion | Notion API |
| `/api/safety/review/submit` | EHS review notifications | Notion, Resend, Slack |
| `/api/safety/suggest-hazards` | AI hazard suggestions for PTP | Anthropic API |
| `/api/safety/suggest-jha` | AI JHA step analysis | Anthropic API |
| `/api/safety/parse-document` | AI document import for JHA | Anthropic API |
| `/api/sage/triage` | AI conversational triage assistant | Anthropic API |
| `/api/auth/[...nextauth]` | Authentication (NextAuth.js) | Google OAuth |
| `/api/beta/signup` | Beta signup form submission | Notion API |

---

## Security & Data Flow

### Data Residency

| Data type | Location | Encryption |
|-----------|----------|------------|
| Safety records (JSON) | Client localStorage | None (device-level encryption applies) |
| Signatures & photos | Client IndexedDB | None (device-level encryption applies) |
| Synced records | Notion databases (if configured) | Notion's encryption at rest |
| Review emails | Resend -> recipient inbox | TLS in transit |
| Session tokens | HTTP-only cookies (NextAuth) | Encrypted with `NEXTAUTH_SECRET` |

**No application database exists.** The server is stateless. All record data originates on and is owned by the client device. Copies are pushed to external services only when the user explicitly syncs or submits for review.

### What the AI Sees

When AI features are enabled and a user triggers a suggestion:

- **Sent to Anthropic:** Scope of work text, location, project name, task steps, and hazard descriptions from the current form. No PII, signatures, or photos are included in AI requests.
- **Not sent:** User identity, email, session tokens, device info, historical records, or any data from other users.
- **API route:** Server-side only (`/api/safety/suggest-*`). The client never communicates directly with Anthropic.
- **Model:** Claude (specified in route handlers). Responses are structured JSON parsed server-side before returning to the client.
- **Retention:** Subject to [Anthropic's API data policy](https://www.anthropic.com/policies/privacy) — API inputs are not used for model training.

### Client-Side Storage

- **localStorage:** Safety records, equipment data, tour progress, user preferences, draft forms. Cleared on browser data reset.
- **IndexedDB:** Binary blobs (touch-drawn signatures, inspection photos). Keyed by record ID.
- **No cookies beyond auth:** A single HTTP-only session cookie managed by NextAuth. No analytics cookies, no third-party tracking.

### Content Security

- All external links use `rel="noopener noreferrer"` and `target="_blank"`
- Form inputs are validated both client-side and in API route handlers
- AI API routes validate request body structure before forwarding to Anthropic
- Google OAuth is restricted to approved email domains (server-side check in NextAuth callbacks)
- The email login provider (when enabled) enforces domain restriction and an access code

---

## Authentication & Authorization

### Auth Modes

| Mode | Trigger | Use case |
|------|---------|----------|
| **Google OAuth** | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` set | Production — SSO via company Google Workspace |
| **Email login** | `ALLOW_EMAIL_LOGIN=1` set | Pilot/testing — domain-restricted, shared access code |
| **Dev login** | `ALLOW_DEV_LOGIN=1` or Google OAuth not configured | Local dev / demos — name + email form, no OAuth required |
| **Offline fallback** | No connectivity + cached identity | Field work — attributes records to last verified login |

### Domain Restriction

Google OAuth sign-ins are checked server-side against `ALLOWED_EMAIL_DOMAINS` (default: `mytra.ai`). Accounts outside approved domains are rejected at the callback level, not just the UI.

### Session Management

- Sessions are managed by NextAuth.js with JWT strategy
- Session tokens are encrypted with `NEXTAUTH_SECRET` and stored in HTTP-only cookies
- Token expiry is configurable (default: NextAuth defaults)

### Authorization Scope

The application does not implement role-based access control (RBAC) at this stage. All authenticated users have equal access to all features. EHS review workflows provide process-level separation (submitter vs. reviewer) but not system-level enforcement.

---

## Third-Party Services

| Service | Purpose | Data sent | Required? |
|---------|---------|-----------|-----------|
| **Vercel** | Hosting, serverless functions, edge network | Application code, request logs | Yes |
| **Google OAuth** | Authentication | Email, name, profile image (from Google) | Yes (production) |
| **Anthropic (Claude API)** | AI hazard/JHA suggestions | Form text (scope, steps, hazards) | No (feature-flagged) |
| **Notion API** | Record sync & storage | Full record JSON (no binary blobs) | No (optional) |
| **Resend** | EHS review email notifications | Record summary text, recipient email | No (optional) |
| **Slack** | EHS review channel notifications | Record summary text | No (optional) |
| **Sentry** | Error monitoring (crash/stack traces) | Error events, stack traces | No (dormant unless `NEXT_PUBLIC_SENTRY_DSN` is set) |

Sentry error monitoring is integrated but **dormant by default** — it sends nothing
unless `NEXT_PUBLIC_SENTRY_DSN` is configured. No third-party analytics, product
telemetry, or ad services are integrated.

---

## Environment Variables

All secrets are stored as Vercel environment variables and injected at build/runtime. None are committed to the repository. See [`.env.example`](.env.example) for a copy-paste template.

### Required

| Variable | Purpose |
|----------|---------|
| `NEXTAUTH_SECRET` | Session encryption key (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Production URL (e.g., `https://equipment-qr-hub.vercel.app`) |

### Authentication

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `ALLOW_EMAIL_LOGIN` | Set to `1` to enable email login (pilot mode) |
| `EMAIL_LOGIN_CODE` | Shared access code for email login (required in production) |
| `ALLOWED_EMAIL_DOMAINS` | Comma-separated allowlist (default: `mytra.ai`) |
| `ALLOW_DEV_LOGIN` | `1` to force dev login; `0` to force off; unset = auto (on when Google not configured) |
| `ADMIN_EMAILS` | Comma-separated admin emails (server-only, never shipped to client) |

### AI (optional, feature-flagged)

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `NEXT_PUBLIC_AI_ASSIST` | Set to `1` to enable AI features in the UI |

### Notifications (optional)

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend API key for email delivery |
| `EHS_NOTIFY_EMAIL` | Recipient address for EHS review emails |
| `EHS_NOTIFY_FROM` | Verified sender (e.g., `Sage EHS <sage@yourdomain.com>`) |
| `NEXT_PUBLIC_EHS_REVIEW` | Set to `1` to show "Submit for EHS Review" button |
| `REVIEW_TOKEN_SECRET` | HMAC secret for review tokens (falls back to `NEXTAUTH_SECRET`) |
| `SLACK_WEBHOOK_URL` | General Slack webhook (first-login alerts, beta signups) |

### Notion Sync (optional)

| Variable | Purpose |
|----------|---------|
| `NOTION_API_KEY` | Notion integration token |
| `NOTION_PTP_DB_ID` | Pre-Task Plan database ID |
| `NOTION_JHA_DB_ID` | JHA database ID |
| `NOTION_PERMITS_DB_ID` | Permits database ID |
| `NOTION_INCIDENTS_DB_ID` | Incidents database ID |
| `NOTION_INSPECTIONS_DB_ID` | Pre-trip inspections database ID |

### Slack (optional)

| Variable | Purpose |
|----------|---------|
| `SLACK_EHS_WEBHOOK_URL` | Incoming webhook URL for #ehs channel |

### Sentry (optional, dormant by default)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry project DSN — enables error monitoring when set |
| `SENTRY_AUTH_TOKEN` | Org-level auth token for source map upload |
| `SENTRY_ORG` | Sentry organization slug |
| `SENTRY_PROJECT` | Sentry project slug |

### Upstash Redis (optional)

| Variable | Purpose |
|----------|---------|
| `KV_REST_API_URL` | Upstash Redis REST URL (beta signups, rate limiting) |
| `KV_REST_API_TOKEN` | Upstash Redis REST token |

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14 |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS | 3.4 |
| Icons | Lucide React | latest |
| Auth | NextAuth.js | 4 |
| AI | Anthropic Claude SDK | ^0.100 |
| Validation | Zod | 4 |
| Email | Resend REST API | - |
| Sync | Notion API, Slack webhooks | - |
| Error monitoring | Sentry (`@sentry/nextjs`) | ^10.58 |
| Cache / KV | Upstash Redis | - |
| Deployment | Vercel (serverless) | - |
| PWA | Serwist (`@serwist/next`) | ^9.5 |
| Testing | Vitest | - |

### Build & Runtime

- **Node.js:** 18+ (Vercel default)
- **Package manager:** npm
- **Build command:** `next build` (includes ESLint + TypeScript checks)
- **Output:** Static pages + serverless API functions
- **Bundle:** ~89 kB shared JS, page-specific chunks vary 2-10 kB

---

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build   # TypeScript + ESLint checks + static generation
npm start       # Serve locally (or deploy to Vercel)
```

---

## Key Components

| Component | Purpose |
|-----------|---------|
| `SafetyDashboard` | Home screen — active permits, daily PTP status, quick actions |
| `PreTaskPlanForm` | Full PTP with hazards, PPE, crew signatures, collapsible sections |
| `JhaForm` | Job Hazard Analysis with step builder and Sage AI analysis |
| `ReviewStatusSection` | EHS review submit/recall/status on any safety record |
| `RecordView` | Universal record viewer with share, print, and audit trail |
| `FormSuccess` | Post-save screen with EHS submit, view/print, and new record |
| `AuthGate` | Session gate with offline fallback and cached identity |
| `ModuleTourEngine` | Guided tour overlay with keyboard nav and scroll targeting |
| `EquipmentProfile` | Equipment detail view with tabbed PM, training, compliance |
| `PreTripInspection` | Digital inspection checklist with photo capture and draft persistence |
| `QRLabel` | Printable QR code label generator |
| `WorkOrderBoard` | Kanban-style work order management |

---

## Documentation

- [`docs/SAFETY_HUB_SPEC.md`](docs/SAFETY_HUB_SPEC.md) — Full safety module specification
- [`docs/SAFETY_HUB_NOTION_SETUP.md`](docs/SAFETY_HUB_NOTION_SETUP.md) — Notion integration setup
- [`docs/sync-architecture.svg`](docs/sync-architecture.svg) — Visual sync flow diagram
- [`docs/EQUIPMENT_QR_HUB.md`](docs/EQUIPMENT_QR_HUB.md) — Equipment module documentation

---

## License

Internal tool — Mytra, Inc.
