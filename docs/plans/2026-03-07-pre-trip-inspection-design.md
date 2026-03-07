# Pre-Trip Inspection Feature — Design Document

**Date:** 2026-03-07
**Status:** Approved
**App:** Equipment QR Hub

## Purpose

Digital pre-trip / pre-use inspection for Powered Industrial Trucks and Aerial Work Platforms. Replaces paper forms with a phone-native checklist accessed via existing QR codes. Records stored locally (offline-capable) with Notion sync for compliance audit trail. Defects auto-create maintenance work orders. Empathy-first UX: EHS as a support function.

## Equipment Covered (7 units)

| # | Name | Category | Checklist Type |
|---|------|----------|----------------|
| 21 | Genie GS-2632 Electric Scissor Lift | Aerial Work Platforms | scissor-lift |
| 22 | MEC 1330SE Electric Scissor Lift | Aerial Work Platforms | scissor-lift |
| 23 | Skyjack SJIII 3219 Electric Scissor Lift | Aerial Work Platforms | scissor-lift |
| 24 | Yale ERP030VTN 3000lb Electric Forklift | Powered Industrial Trucks | electric-forklift |
| 25 | Yale E50XN 4700lb Electric Forklift | Powered Industrial Trucks | electric-forklift |
| 26 | Electric Walkie Pallet Jack (CAT/Yale) | Powered Industrial Trucks | walkie-pallet-jack |
| 27 | Manual Hydraulic Pallet Jacks x2 | Powered Industrial Trucks | manual-pallet-jack |

## Regulatory Basis

- **Forklifts:** OSHA 1910.178(q)(7), Cal/OSHA T8 CCR 3664-3668, ANSI/ITSDF B56.1
- **Scissor Lifts:** Cal/OSHA T8 CCR 3646-3648, ANSI A92.6
- **Reference:** [OSHA PIT Daily Inspection Checklist](https://www.osha.gov/training/library/powered-industrial-trucks/checklist)

## Inspection Checklists

### Electric Sit-Down Forklift (Items 24, 25)

**Motor Off Checks:**
1. Hydraulic oil leaks / battery leaks
2. Tires — condition and pressure
3. Forks, clips, heel — physical condition *(critical)*
4. Load backrest — properly attached
5. Hydraulic hoses, mast chains, cables, stops
6. Overhead guard and finger guards attached *(critical)*
7. Safety warnings properly attached
8. Battery — water/electrolyte level and charge
9. Hydraulic and transmission fluid levels
10. Operator's manual present; capacity plate matches specs
11. Battery restraint adjusted and fastened
12. Seat belt — smooth operation *(critical)*
13. Brake fluid level

**Motor On Checks:**
14. Accelerator linkage
15. Parking brake *(critical)*
16. Service brake *(critical)*
17. Steering operation *(critical)*
18. Drive controls — forward/reverse
19. Tilt controls — forward/back
20. Hoist/lowering controls
21. Attachment operation
22. Horn
23. Lights and alarms
24. Hour meters (drive and hoist)
25. Battery discharge indicator
26. Instrument monitors

### Electric Scissor Lift (Items 21, 22, 23)

**Ground Level Inspection:**
1. No fluid leaks (hydraulic, battery acid)
2. Tires in good condition
3. All pins and bolts secure
4. Warning decals and capacity plate visible
5. Battery secured, terminals clean

**Platform & Guardrails:**
6. Platform floor non-slip, good condition
7. Guardrails secure and proper height *(critical)*
8. Midrails installed and secure
9. Toeboards in place
10. Entry gate closes and latches *(critical)*

**Controls & Functions:**
11. Platform controls functional
12. Ground controls functional
13. Emergency stop works — both locations *(critical)*
14. Platform raises/lowers smoothly
15. Drive functions in all directions
16. Horn/alarm operational

**Safety Devices:**
17. Tilt alarm/indicator functional
18. Limit switches functioning
19. Pothole protection device works *(critical)*
20. Descent alarm operational

### Electric Walkie Pallet Jack (Item 26)

**Visual Inspection:**
1. No fluid leaks (hydraulic, battery)
2. Body/frame damage
3. Warning decals and capacity plate visible
4. Battery charge level adequate
5. Battery connections tight/clean

**Controls & Operation:**
6. Throttle/butterfly control
7. Lift/lower function
8. Emergency stop/belly button *(critical)*
9. Horn/bell
10. Brakes functional *(critical)*

**Forks & Wheels:**
11. Fork tips — not bent/cracked *(critical)*
12. Load wheels — condition
13. Steer wheels — condition

### Manual Hydraulic Pallet Jack (Item 27)

**Visual Inspection:**
1. Frame not bent or cracked
2. No hydraulic fluid leaks
3. Handle in good condition

**Forks & Wheels:**
4. Fork tips — not bent/cracked *(critical)*
5. Load rollers spin freely
6. Steer wheels — condition and swivel

**Hydraulic Pump:**
7. Raises to full height
8. Holds load without drifting *(critical)*
9. Lowers smoothly
10. Release valve not leaking

## Entry Point

QR scan → equipment profile → **Pre-Trip** tab (first tab position). Tab only appears for categories "Powered Industrial Trucks" and "Aerial Work Platforms".

## UI Flow

### Step 1 — Identify
- Employee name (text input, remembers last name via localStorage)
- Shift selector: Day / Swing / Night
- Hour meter reading (numeric, optional for manual pallet jacks)

### Step 2 — Checklist
- Items grouped by category headers
- Each item: **Pass** (green) / **Fail** (red) / **N/A** (gray) toggle
- Tapping Fail expands inline:
  - Required: text notes ("Describe the issue")
  - Optional: camera button → phone camera → thumbnail preview
  - Critical items show amber banner: "This is a safety-critical item — flagging it will send this unit to maintenance."

### Step 3 — Submit
- All Pass/N/A → green: "All clear — you're good to go. Inspection logged."
- Non-critical Fail → amber: "Issues noted — maintenance has been notified. You may operate with caution."
- Critical Fail → red: "This unit has been taken out of service for maintenance. Thanks for keeping everyone safe."
  - Equipment status auto-set to "Out of Service"
  - Work order auto-created in existing WO system
- Sync indicator: green dot = synced, amber = pending, gray = offline

### Step 4 — History
Collapsible "Recent Inspections" below form. Last 5 for this unit: date, inspector, result, expandable details.

## Data Model

```typescript
interface InspectionRecord {
  id: string                    // INS-2026-0001
  equipmentId: number
  inspectorName: string
  shift: 'Day' | 'Swing' | 'Night'
  hourMeterReading: number | null
  checklistType: 'electric-forklift' | 'scissor-lift' | 'walkie-pallet-jack' | 'manual-pallet-jack'
  items: InspectionItem[]
  result: 'pass' | 'fail'
  hasCriticalFail: boolean
  workOrderId: string | null
  createdAt: string
  syncStatus: 'pending' | 'synced' | 'failed' | 'offline'
  notionPageId: string | null
}

interface InspectionItem {
  id: string                     // e.g. 'forks-condition'
  label: string
  category: string               // e.g. 'Motor Off Checks'
  critical: boolean
  result: 'pass' | 'fail' | 'na' | null
  notes: string
  photo: string | null           // compressed base64 data URI
}
```

## Data Storage

**localStorage (immediate):** Same swap-point pattern as work-orders.ts. Pub/sub notification for UI reactivity. Offline-capable.

**Notion sync (Monday):** Vercel serverless function `api/sync-inspection.ts`. Writes to Notion database on submit. Stub architected for easy email/Slack webhook addition.

**Notion database schema:**

| Property | Type | Notes |
|----------|------|-------|
| Inspection ID | Title | INS-2026-0001 |
| Equipment | Relation | Links to equipment DB |
| Inspector | Text | Employee name |
| Shift | Select | Day/Swing/Night |
| Hour Meter | Number | |
| Result | Select | Pass/Fail |
| Critical Fail | Checkbox | |
| Failed Items | Rich Text | Summary + notes |
| Photos | Files | Defect photos |
| Work Order | Text | WO ID if created |
| Date | Date | Timestamp |

## Defect → Notification Path

1. **Today:** Critical fail → auto-create WO → visible on /work-orders Kanban
2. **Monday (Notion):** Sync to Notion DB → Notion automations trigger email/Slack to maintenance
3. **Future:** Serverless function can also fire Resend/SendGrid email or Slack webhook at sync time

## Architecture

### New Files
- `src/data/inspection-checklists.ts` — checklist definitions per equipment type
- `src/lib/inspections.ts` — data access layer (localStorage + Notion sync stub)
- `src/components/PreTripInspection.tsx` — inspection form component
- `api/sync-inspection.ts` — Vercel serverless Notion sync (stub)

### Modified Files
- `src/lib/types.ts` — add InspectionRecord, InspectionItem, ChecklistType, Shift types
- `src/components/EquipmentProfile.tsx` — add Pre-Trip tab (conditional on category)
- `src/components/TabNav.tsx` — no changes needed (already generic)

### Photo Handling
- HTML5 `<input type="file" accept="image/*" capture="environment">`
- Compress via canvas before storing (max 800px wide, 0.7 quality JPEG)
- Stored as base64 in localStorage
- Synced as file attachment to Notion

## Design Principles
- **Empathy-first:** "Thanks for catching this" not "unit failed inspection"
- **Maintenance as service:** defects → "we'll get it fixed" messaging
- **Zero friction:** QR scan → form → done in 2 minutes
- **Offline-first:** works without network, syncs when available
- **Compliance-ready:** timestamped, non-backdatable, photo evidence, audit-exportable
