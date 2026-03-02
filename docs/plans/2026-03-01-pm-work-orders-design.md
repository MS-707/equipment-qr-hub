# PM Work Order Tracking — Design Document

**Date:** 2026-03-01
**Status:** Approved
**Author:** Claude + Mark

## Overview

Add PM work order tracking to Equipment QR Hub. Users create work orders from equipment profiles, manage them on a Kanban board, and optionally dispatch to Linear or Gmail.

## Data Model

```typescript
interface WorkOrder {
  id: string                    // WO-2026-0001 format
  equipmentId: number           // links to EquipmentItem.itemNumber
  pmType: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Semi-Annual' | 'Annual'
  tasks: string                 // pre-filled from equipment PM field
  status: 'Not Started' | 'In Progress' | 'Complete' | 'Overdue'
  dueDate: string | null        // ISO date
  completedDate: string | null
  assignedTo: string | null     // free text name
  completionNotes: string
  linearIssueId: string | null  // set after dispatch
  gmailDraftId: string | null   // set after dispatch
  createdAt: string             // ISO timestamp
}
```

## Persistence

localStorage under key `eqr-work-orders`. Data access layer in `src/lib/work-orders.ts` — same swap-point pattern as equipment/training. Partner can rewire to Notion API without touching UI.

## Routes

- `/work-orders` — Kanban dashboard (Not Started / In Progress / Complete)

## UX Flow

1. Equipment profile PM Schedule tab → "+ Work Order" button per PM type
2. Inline form: due date + optional assignee, tasks auto-filled
3. `/work-orders` page: Kanban board, filterable by equipment/PM type/overdue
4. Each card: expand to see tasks, add notes, change status
5. Dispatch buttons: "Send to Linear" / "Email" on each card

## Components

- `WorkOrderBoard.tsx` — Kanban layout + filters
- `WorkOrderCard.tsx` — Card with expand, status toggle, dispatch
- `CreateWorkOrderButton.tsx` — Inline creation on equipment PM tab
- `WorkOrderFilters.tsx` — Filter controls

## Nav

Add "Work Orders" link to header with open-count badge.

## Integration

- Linear: creates issue via MCP, stores issue ID back on WO
- Gmail: creates draft via MCP, stores draft ID back on WO
- Both are manual dispatch (button click), not automatic

## Out of Scope

- Auth, real-time sync, recurring auto-generation, drag-and-drop Kanban
