# Equipment QR Hub — Purpose, Structure & Notion Integration Plan

**Project:** Equipment QR Hub
**Stack:** Next.js 14, TypeScript, Tailwind CSS
**Repo:** MS-707/equipment-qr-hub (private)
**Live:** equipment-qr-hub.vercel.app
**Vercel Team:** mark-starrs-projects

---

## 1. What This Tool Does

Equipment QR Hub is the shop-floor reference layer for Mytra's EHS program. Every piece of equipment in the machine shop has a QR code that links to its profile page. An engineer scans the code and immediately sees:

- **Training requirements** — which programs they need before operating this equipment, linked to Cal/OSHA regulatory basis
- **PM schedule** — daily through annual maintenance tasks pulled from OEM manuals
- **Compliance info** — applicable Cal/OSHA sections (T8 CCR), training requirements, last/next PM dates
- **OEM manual** — embedded PDF viewer or direct link to manufacturer documentation
- **Machine guarding status** — whether the equipment requires guarding per T8 CCR 3556/3577

The app also provides:

- **Equipment directory** — searchable, filterable by 9 categories, with status indicators
- **PM work order board** — Kanban-style tracker (Not Started / In Progress / Complete) with CSV export
- **QR label generator** — printable 3-column grid of QR labels for all 46 items

### Who Uses It

| Role | Use Case |
|------|----------|
| Machine shop engineers | Scan QR → check training reqs, PM tasks, OEM manual before operating |
| EHS manager (Mark) | Create PM work orders, track compliance, change equipment status |
| Notion agent (work machine) | Consumes CSV exports, syncs data via API swap points |

---

## 2. Data Architecture

### Current State: Static + localStorage

All equipment and training data is baked in at build time from CSV sources. Work orders and status overrides are stored in browser localStorage. This was intentional — zero infrastructure, instant deployment, and designed with explicit swap points for Notion migration.

```
src/data/                         ← Static data (baked from CSV)
  equipment.ts                       46 equipment items
  training-programs.ts               9 training programs (TP-01 through TP-09)
  equipment-training-map.ts          Program ↔ equipment cross-reference

src/lib/                          ← Data access layer (THE SWAP POINTS)
  equipment.ts                       getAllEquipment(), getEquipmentById(), updateEquipmentStatus()
  training.ts                        getAllTrainingPrograms(), getTrainingProgramsForEquipment()
  work-orders.ts                     CRUD + pub/sub, localStorage-backed
  types.ts                           All TypeScript interfaces

src/components/                   ← UI components (never import from src/data/)
src/app/                          ← Next.js routes
```

### Key Design Rule

**Components never import from `src/data/` directly.** All reads and writes go through `src/lib/` functions. This means the Notion migration only touches 3 files — `equipment.ts`, `training.ts`, and `work-orders.ts` — while every component stays unchanged.

### Data Model

**EquipmentItem** — 46 items across 9 categories:

| Field | Type | Notes |
|-------|------|-------|
| itemNumber | number | Unique ID (1-46) |
| name | string | Full equipment name with model |
| category | EquipmentCategory | One of 9 categories |
| status | EquipmentStatus | Active / Out of Service / Retired / Pending Repair |
| manualType | ManualType | pdf / webpage / none |
| manualUrl | string | OEM manual URL (45/46 populated) |
| oemManual | string | Manual title/document number |
| pmDaily through pmAnnual | string | PM task lists per frequency |
| keyPmSummary | string | Critical PM items summary |
| calOshaSections | string | Applicable T8 CCR sections |
| calOshaTrainingReq | string | Training requirements text |
| location, assetTag | string? | Optional — not yet populated |
| lastPmDate, nextPmDue | string? | Optional — not yet populated |

**TrainingProgram** — 9 programs (TP-01 through TP-09):

| Program | Title | Priority | Hours |
|---------|-------|----------|-------|
| TP-01 | Lockout/Tagout (LOTO) | CRITICAL | 3.0 |
| TP-02 | Abrasive Wheel Safety | CRITICAL | 1.5 |
| TP-03 | Overhead Crane Operator | CRITICAL | 4.0 |
| TP-04 | Scissor Lift Operator | CRITICAL | 3.0 |
| TP-05 | Welding & Hot Work Safety | HIGH | 4.0 |
| TP-06 | Ladder Safety | MEDIUM | 1.0 |
| TP-07 | Fire Extinguisher Use | MEDIUM | 0.75 |
| TP-08 | Electrical Safety Awareness | MEDIUM | 1.0 |
| TP-09 | 3D Printer & Soldering Fume Safety | LOW | 0.75 |

**WorkOrder** — localStorage-backed PM tracking:

| Field | Type | Notes |
|-------|------|-------|
| id | string | WO-YYYY-NNNN (auto-generated, resets yearly) |
| equipmentId | number | Links to equipment item |
| pmType | PmType | Daily / Weekly / Monthly / Quarterly / Semi-Annual / Annual |
| status | WorkOrderStatus | Not Started / In Progress / Complete |
| tasks | string | Semicolon-separated task list from PM field |
| dueDate, completedDate | string? | ISO date strings |
| assignedTo | string? | Free text |
| completionNotes | string | Free text, auto-saved on blur |
| linearIssueId, gmailDraftId | string? | Placeholder for integrations |

---

## 3. App Routes & Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Equipment Directory | Search, category filter pills, grouped cards with status/guarding badges |
| `/equipment/[id]` | Equipment Profile | 3 tabs: Training (manual + programs), PM Schedule (accordion + WO creation), Compliance (regulatory details) |
| `/work-orders` | Work Order Board | Kanban columns, equipment/PM type/overdue filters, CSV export |
| `/admin/labels` | QR Label Generator | QR codes for all 46 items, print-optimized 3-column layout |

All 46 equipment profile pages are statically generated at build time for instant load.

---

## 4. Notion Integration Plan

### What Exists Today

The `Notion_Database_Handoff.md` document (697 lines) in the project root specifies 6 Notion databases to be built on the work machine:

1. **Employees** — Roster with training compliance rollups
2. **Equipment Registry** — Mirror of the 46 equipment items
3. **Training Programs** — 9 programs with full lesson plan content as page bodies
4. **Training Records** — Per-employee, per-program completion tracking
5. **PM Work Orders** — Kanban-native work order tracking
6. **Training Calendar** — 12-month 2026 schedule

The databases have defined relations:

```
Equipment Registry ◄──many-to-many──► Training Programs
        │                                    │          │
        │ one-to-many                        │          │ one-to-many
        ▼                                    │          ▼
  PM Work Orders                             │    Training Records
                                             │          │
                                             │          │ many-to-one
                                             ▼          ▼
                                      Training Calendar  Employees
```

### How the App Connects to Notion

The migration replaces 3 files. Nothing else changes.

#### Step 1: Equipment Registry (read-only sync)

**File:** `src/lib/equipment.ts`
**Current:** Imports static array from `src/data/equipment.ts`, layers localStorage status overrides
**Migration:** Replace with Notion API calls to Equipment Registry database

```
getAllEquipment()       → Query Equipment Registry, sort by name
getEquipmentById(id)   → Query by Item_Number filter
getCategories()        → Aggregate Equipment_Category property
searchEquipment(query) → Notion search with text filter
updateEquipmentStatus  → Update Status property on Notion page
```

The localStorage status override layer (`eqr-status-overrides`) is eliminated — Notion becomes the single source of truth for status.

#### Step 2: Training Programs (read-only sync)

**File:** `src/lib/training.ts`
**Current:** Imports static arrays from `src/data/training-programs.ts` and `equipment-training-map.ts`
**Migration:** Replace with Notion API calls to Training Programs database

```
getAllTrainingPrograms()              → Query Training Programs DB
getTrainingProgramById(id)           → Query by Program_ID filter
getTrainingProgramsForEquipment(id)  → Query via Equipment_Covered relation
```

The cross-reference map (`equipment-training-map.ts`) is eliminated — the Equipment_Covered relation in Notion handles it natively.

#### Step 3: PM Work Orders (full CRUD)

**File:** `src/lib/work-orders.ts`
**Current:** localStorage CRUD with pub/sub notification
**Migration:** Replace with Notion API calls to PM Work Orders database

```
getAllWorkOrders()          → Query PM Work Orders, sort by created descending
createWorkOrder(data)      → Create page in PM Work Orders DB
updateWorkOrder(id, data)  → Update page properties
deleteWorkOrder(id)        → Archive or delete page
getOverdueWorkOrders()     → Query where Is_Overdue formula = true
getOpenCount()             → Query where Status ≠ Complete, return count
exportToCsv()              → Query all, format as CSV (unchanged logic)
```

The pub/sub notification system stays for UI reactivity. The `notify()` calls remain after each Notion write so the NavHeader badge and Kanban board update without polling.

#### Step 4: Wire Relations

Once Notion databases exist, the app can leverage relations for features not currently possible:

- **Training Records** — show per-employee completion on equipment profile pages
- **Employees** — assign PM work orders to specific employees via Notion relation (currently free-text)
- **Training Calendar** — show upcoming training dates on equipment profiles

### Environment Variables Needed

```
NOTION_API_KEY=secret_...
NOTION_EQUIPMENT_DB_ID=...
NOTION_TRAINING_DB_ID=...
NOTION_WORK_ORDERS_DB_ID=...
NOTION_EMPLOYEES_DB_ID=...          (future)
NOTION_TRAINING_RECORDS_DB_ID=...   (future)
NOTION_TRAINING_CALENDAR_DB_ID=...  (future)
```

### Migration Sequence

1. Build the 6 Notion databases per `Notion_Database_Handoff.md` (on work machine)
2. Create Notion integration, get API key, share databases with integration
3. Add env vars to Vercel project settings
4. Replace `src/lib/equipment.ts` — equipment reads from Notion
5. Replace `src/lib/training.ts` — training reads from Notion
6. Replace `src/lib/work-orders.ts` — work orders CRUD against Notion
7. Remove `src/data/` directory (static data no longer needed)
8. Remove localStorage keys (`eqr-work-orders`, `eqr-wo-counter`, `eqr-status-overrides`)
9. Test all routes, verify Kanban board, verify CSV export
10. Deploy

### Caching Strategy

Notion API has rate limits (3 requests/second). For a 46-item directory page, naive implementation would be slow. Options:

- **ISR (Incremental Static Regeneration)** — revalidate equipment pages every 60 seconds. Best for read-heavy pages.
- **Client-side SWR** — cache Notion responses in memory, revalidate in background. Good for work orders.
- **Edge caching** — Vercel edge caches Notion responses. Free with Vercel Pro.

Recommended: ISR for equipment directory and profiles (data changes infrequently), SWR for work orders (changes frequently during PM sessions).

---

## 5. Current Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Equipment directory (search, filter, group) | Shipped | 46 items, 9 categories |
| Equipment profiles (3 tabs) | Shipped | Training, PM Schedule, Compliance |
| OEM manual PDFs | Shipped | 45/46 linked, Google Docs Viewer embed |
| QR label generator | Shipped | Print-optimized 3-column grid |
| PM work order board | Shipped | Kanban, filters, CSV export, localStorage |
| Machine guarding indicators | Shipped | 18/46 items flagged per T8 CCR 3556/3577 |
| Equipment status toggle | Shipped | Dropdown with localStorage persistence |
| Manual type classification | Shipped | pdf/webpage/none per item (no more URL sniffing) |
| Linear MCP integration | Placeholder | Clipboard copy, needs real Linear API |
| Gmail MCP integration | Placeholder | mailto: link, needs real Gmail API |
| Notion API swap | Not started | Swap points ready, handoff doc written |
| Real equipment photos | Not started | No photos in app yet |
| PM date tracking | Not started | Fields exist in type, not populated |
| Dashboard/analytics | Not started | No compliance metrics page |
| PWA/offline | Not started | No service worker yet |

---

## 6. File Reference

### Core Data Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/data/equipment.ts` | ~830 | 46 equipment items with full PM schedules |
| `src/data/training-programs.ts` | ~160 | 9 training program definitions |
| `src/data/equipment-training-map.ts` | ~17 | Program ↔ equipment cross-reference |

### Data Access Layer (Swap Points)

| File | Purpose | Notion Migration Target |
|------|---------|------------------------|
| `src/lib/equipment.ts` | Equipment reads + status overrides | → Notion Equipment Registry |
| `src/lib/training.ts` | Training program reads + lookups | → Notion Training Programs |
| `src/lib/work-orders.ts` | Work order CRUD + pub/sub | → Notion PM Work Orders |
| `src/lib/types.ts` | All TypeScript interfaces | Unchanged |

### Components

| Component | Used In | Purpose |
|-----------|---------|---------|
| NavHeader | Layout | Sticky nav, WO count badge via pub/sub |
| EquipmentCard | Directory | Clickable card with category/status/guarding badges |
| EquipmentProfile | Profile page | Header + tabs container |
| StatusToggle | Profile page | Equipment status dropdown |
| TabNav | Profile page | Accessible tabs with arrow-key navigation |
| TrainingInfo | Training tab | OEM manual viewer + linked programs |
| PMSchedule | PM tab | Accordion by frequency + WO creation |
| ComplianceInfo | Compliance tab | Cal/OSHA sections + PM dates |
| CreateWorkOrderButton | PM tab | Inline WO creation form |
| WorkOrderBoard | Work Orders page | Kanban board + filters + CSV export |
| WorkOrderCard | Work Orders page | WO card with status cycling + dispatch |
| QRLabel | Labels page | QR code with equipment info |

### Related Documents

| Document | Location | Purpose |
|----------|----------|---------|
| Notion Database Handoff | `../Notion_Database_Handoff.md` | Full schema for 6 Notion databases |
| PM Work Orders Design | `docs/plans/2026-03-01-pm-work-orders-design.md` | Approved design for work order feature |
| Equipment PM Master CSV | `../Equipment_PM_Schedule_Master.csv` | Source data for 46 equipment items |
| Training Programs DB CSV | `../Training_Programs/Training_Programs_Database.csv` | Source data for 9 programs |
| Training Calendar CSV | `../Training_Programs/Training_Calendar_2026.csv` | 12-month training schedule |

---

## 7. Design System

**Theme:** mytra.ai dark mode

| Token | Value | Usage |
|-------|-------|-------|
| `mytra-bg` | #0A0A0A | Page background |
| `mytra-card` | #161616 | Card/panel background |
| `mytra-card-hover` | #1E1E1E | Card hover state |
| `mytra-input` | #0F0F0F | Form input background |
| `mytra-border` | #232323 | Borders and dividers |
| `mytra-purple` | #583AF6 | Primary accent (buttons, active states, links) |
| `mytra-purple-hover` | #6B4FF7 | Accent hover |

**Category colors** map 1:1 with the Notion Equipment_Category select options. Equipment cards use a 3px left-border accent in the category color.

**Status colors:**
- Active: green (#22C55E)
- Out of Service: red (#EF4444)
- Pending Repair: orange (#F97316)
- Retired: gray (#6B7280)

**Font:** Roboto (Google Fonts, loaded in layout.tsx)

---

## 8. Deployment

- **GitHub:** Pushes to `main` auto-deploy to Vercel
- **Build:** `next build` pre-renders all 46 equipment pages + directory + labels
- **Env vars:** Currently none required (static data). Notion migration will require API keys.
- **Domain:** Currently on `equipment-qr-hub.vercel.app`. Can add custom domain via Vercel.

23 commits on main, build passes, lint clean.
