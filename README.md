# Sage EHS — Equipment QR Hub

AI-powered EHS safety and equipment management PWA for R&D, manufacturing, and engineering teams. Replaces paper-based inspection workflows, pre-task plans, permits, and job hazard analyses with a searchable, offline-capable, QR-accessible web application.

**Live:** [equipment-qr-hub.vercel.app](https://equipment-qr-hub.vercel.app)

## What It Does

### Safety Hub (`/safety`)

Paperless, auditable safety workflow for construction and commissioning crews:

- **Pre-Task Plans (PTP)** — Collaborative daily safety plans with scope of work, hazard identification, risk-rated controls, PPE selection, crew sign-on with touch-drawn signatures, and optional heat illness prevention / toolbox talk sections (collapsible for indoor/solo work)
- **Job Hazard Analysis (JHA)** — Step-by-step task breakdown where workers list each activity, then Sage AI analyzes hazards, risk levels, and recommended controls for each step before EHS review
- **Work Permits** — Height, hot work, and confined space permits with checklists, atmospheric monitoring, and timed validity
- **Incident Reports** — Severity-rated reports with witness tracking, root cause analysis, corrective actions, and Cal/OSHA reporting flags
- **EHS Review Workflow** — Submit any record for EHS manager review; submissions deliver to email (Resend), Notion, and/or Slack (each channel independent)
- **Share & Print** — Native iOS share sheet (Web Share API) with mailto fallback; formal print layout matching paper PTP/JHA templates with authorization signature blocks
- **Offline-First** — All forms work without connectivity. Records save to localStorage, signatures/photos to IndexedDB. Pending records sync automatically on reconnect.
- **Draft Persistence** — Pre-trip inspections and form progress auto-save every 2 seconds. Survives app crashes and phone restarts; validates draft shape on restore.

### Sage AI

An AI assistant integrated into safety workflows, powered by Claude:

- **Hazard Suggestions** — On the PTP form, Sage analyzes the scope of work and location to suggest relevant hazards with risk levels and control measures
- **JHA Step Analysis** — After a worker lists their task steps, Sage reviews each one and fills in potential hazards, risk ratings (Low/Medium/High/Critical), and recommended controls — without overwriting anything the worker already entered
- **Self-Improving Workflow** — Sage learns from the context of each job: the project name, location, trade, and task description inform its suggestions. As more records are submitted and reviewed by EHS, the human feedback loop (approve/reject/revise) creates a growing knowledge base that sharpens future recommendations

Sage is fully feature-flagged: dormant unless `ANTHROPIC_API_KEY` + `NEXT_PUBLIC_AI_ASSIST=1` are set. No data is sent to external AI services without explicit configuration.

### Equipment Management

- **Equipment Inventory** — Searchable catalog organized by category (machine tools, welding, aerial work platforms, powered industrial trucks, material handling, and more)
- **QR Code Labels** — Generate and print QR labels for any equipment. Scan with a phone to access its profile, inspection history, and PM schedule.
- **Pre-Trip Inspections** — Digital checklists with photo capture, pass/fail per item, and draft persistence across app restarts
- **Work Orders** — Create, assign, and track maintenance with priority levels and status tracking
- **Preventive Maintenance** — Daily through annual PM schedules with due date tracking
- **Guard Status & Compliance** — Machine guarding status, Cal/OSHA sections, and training requirements per equipment item
- **OEM Manual Access** — Direct links to manufacturer manuals from each equipment profile

### Guided Tours

Interactive module tours on every page (21+ steps across 7 tours) with scroll-into-view targeting, keyboard navigation (arrow keys + Escape), and per-module completion tracking.

## Architecture

### Sync & Submission Flow

```
Field Device (iPhone/iPad PWA)
  │  localStorage: record JSON + audit events
  │  IndexedDB: signature + photo blobs
  │  syncStatus: pending → synced / failed
  │
  ├─► POST /api/safety/sync ──────────► Notion (PTP/JHA/Permits/Incidents DBs)
  │     Retry w/ backoff (1s, 2s, 4s)
  │     503 → stays pending
  │
  └─► POST /api/safety/review/submit ─┬► Notion (sets "EHS Review: Pending")
        Fires on "Submit for EHS Review" ├► Email via Resend (full record text)
        Any channel can be off           └► Slack webhook (#ehs channel)
```

See [`docs/sync-architecture.svg`](docs/sync-architecture.svg) for the visual diagram.

### Auth

- **Production:** Google OAuth (restricted to approved domains, server-side enforcement)
- **Pilot:** Company email form (`ALLOW_EMAIL_LOGIN=1`) — domain-restricted, no password
- **Offline:** Cached identity from last verified login; records attribute to last known user

### Data Storage (MVP)

Records live on-device (localStorage + IndexedDB). The durable centralized record is the email sent on EHS submit and/or the Notion sync. The storage layer (`safety-records.ts`) is a documented swap point — migration to Supabase or a database requires changing internal helpers only, no component rewrites.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3.4 |
| Icons | Lucide React |
| Auth | NextAuth.js (Google + Credentials) |
| AI | Anthropic Claude SDK (structured output) |
| Email | Resend REST API |
| Sync targets | Notion API, Slack webhooks |
| QR | Built-in label component |
| Deployment | Vercel |
| PWA | Service worker for offline access |

## Environment Variables

### Required

| Variable | Purpose |
|----------|---------|
| `NEXTAUTH_SECRET` | NextAuth session encryption (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Production URL (e.g. `https://equipment-qr-hub.vercel.app`) |

### Auth (one of)

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Google OAuth (recommended for production) |
| `ALLOW_EMAIL_LOGIN=1` | Company email form (pilot/testing) |

### Email Notifications

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend API key for EHS submission emails |
| `EHS_NOTIFY_EMAIL` | Recipient address (default: configurable) |
| `EHS_NOTIFY_FROM` | Verified sender, e.g. `"Sage EHS <sage@yourdomain.com>"` |
| `NEXT_PUBLIC_EHS_REVIEW=1` | Shows the "Submit for EHS Review" button |

### Sage AI (optional)

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API key |
| `NEXT_PUBLIC_AI_ASSIST=1` | Enables Sage hazard/JHA suggestions |

### Notion Sync (optional)

| Variable | Purpose |
|----------|---------|
| `NOTION_API_KEY` | Notion integration token |
| `NOTION_PTP_DB_ID` | Pre-Task Plan database |
| `NOTION_JHA_DB_ID` | JHA database (falls back to PTP DB) |
| `NOTION_PERMITS_DB_ID` | Permits database |
| `NOTION_INCIDENTS_DB_ID` | Incidents database |

### Slack (optional)

| Variable | Purpose |
|----------|---------|
| `SLACK_EHS_WEBHOOK_URL` | Incoming webhook for #ehs channel |

### Domain Restriction

| Variable | Purpose |
|----------|---------|
| `ALLOWED_EMAIL_DOMAINS` | Comma-separated list (default: `mytra.ai`) |

See [`.env.example`](.env.example) for a copy-paste template.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Key Components

| Component | Purpose |
|-----------|---------|
| `SafetyDashboard` | Safety hub home — active permits, daily PTP status, quick actions |
| `PreTaskPlanForm` | Full PTP with hazards, PPE, crew signatures, collapsible sections |
| `JhaForm` | Job Hazard Analysis with step builder and Sage AI analysis |
| `ReviewStatusSection` | EHS review submit/recall/status on any safety record |
| `RecordView` | Universal record viewer with share, print, and audit trail |
| `FormSuccess` | Post-save screen with EHS submit, View/Print, and new record |
| `AuthGate` | Session gate with offline fallback and cached identity |
| `ModuleTourEngine` | Guided tour overlay with keyboard nav and scroll targeting |
| `EquipmentProfile` | Full equipment detail view with tabs |
| `PreTripInspection` | Digital inspection checklist with draft persistence |
| `QRLabel` | Printable QR code label generator |
| `WorkOrderBoard` | Kanban-style work order management |

## Documentation

- [`docs/SAFETY_HUB_SPEC.md`](docs/SAFETY_HUB_SPEC.md) — Full safety hub specification
- [`docs/SAFETY_HUB_NOTION_SETUP.md`](docs/SAFETY_HUB_NOTION_SETUP.md) — Notion integration setup
- [`docs/sync-architecture.svg`](docs/sync-architecture.svg) — Visual sync flow diagram
- [`docs/EQUIPMENT_QR_HUB.md`](docs/EQUIPMENT_QR_HUB.md) — Equipment module documentation

## License

Internal EHS tool.
