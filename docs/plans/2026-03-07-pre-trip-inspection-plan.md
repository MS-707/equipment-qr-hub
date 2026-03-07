# Pre-Trip Inspection Feature — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a digital pre-trip/pre-use inspection tab for PITs and aerial work platforms (7 units), with localStorage persistence, photo capture, auto work-order creation on critical defects, and a Notion sync stub.

**Architecture:** New "Pre-Trip" tab on equipment profiles for qualifying categories. Inspection checklist definitions in a data file, data access layer mirrors work-orders.ts (localStorage + pub/sub + Notion sync stub). Single PreTripInspection component handles the full flow: identify → checklist → submit → history.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, localStorage, HTML5 camera capture, existing work-order system integration.

**Design doc:** `docs/plans/2026-03-07-pre-trip-inspection-design.md`

---

### Task 1: Add types to `types.ts`

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Add inspection types at the end of the file**

Add after the existing `EQUIPMENT_STATUS_COLORS` block:

```typescript
// ── Pre-Trip Inspections ────────────────────────────────

export type ChecklistType = 'electric-forklift' | 'scissor-lift' | 'walkie-pallet-jack' | 'manual-pallet-jack'

export type Shift = 'Day' | 'Swing' | 'Night'

export type InspectionResult = 'pass' | 'fail' | 'na'

export interface InspectionItemResult {
  id: string
  label: string
  category: string
  critical: boolean
  result: InspectionResult | null
  notes: string
  photo: string | null
}

export type InspectionSyncStatus = 'pending' | 'synced' | 'failed' | 'offline'

export interface InspectionRecord {
  id: string
  equipmentId: number
  inspectorName: string
  shift: Shift
  hourMeterReading: number | null
  checklistType: ChecklistType
  items: InspectionItemResult[]
  result: 'pass' | 'fail'
  hasCriticalFail: boolean
  workOrderId: string | null
  createdAt: string
  syncStatus: InspectionSyncStatus
  notionPageId: string | null
}

export const INSPECTION_CATEGORIES: EquipmentCategory[] = [
  'Powered Industrial Trucks',
  'Aerial Work Platforms',
]

export function requiresPreTrip(item: EquipmentItem): boolean {
  return INSPECTION_CATEGORIES.includes(item.category)
}

export function getChecklistType(item: EquipmentItem): ChecklistType {
  if (item.category === 'Aerial Work Platforms') return 'scissor-lift'
  const name = item.name.toLowerCase()
  if (name.includes('manual') || name.includes('hydraulic pallet jack')) return 'manual-pallet-jack'
  if (name.includes('walkie') || name.includes('pallet jack')) return 'walkie-pallet-jack'
  return 'electric-forklift'
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Clean build, no errors.

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add pre-trip inspection types"
```

---

### Task 2: Create inspection checklist definitions

**Files:**
- Create: `src/data/inspection-checklists.ts`

**Step 1: Create the checklist data file**

Based on [OSHA PIT Daily Inspection Checklist](https://www.osha.gov/training/library/powered-industrial-trucks/checklist) and ANSI A92.6:

```typescript
import { ChecklistType } from '@/lib/types'

export interface ChecklistItem {
  id: string
  label: string
  category: string
  critical: boolean
}

export interface ChecklistDefinition {
  type: ChecklistType
  title: string
  sections: { category: string; items: ChecklistItem[] }[]
}

const electricForklift: ChecklistDefinition = {
  type: 'electric-forklift',
  title: 'Electric Sit-Down Forklift',
  sections: [
    {
      category: 'Motor Off Checks',
      items: [
        { id: 'ef-leaks', label: 'No hydraulic oil or battery leaks', category: 'Motor Off Checks', critical: false },
        { id: 'ef-tires', label: 'Tires — condition and pressure', category: 'Motor Off Checks', critical: false },
        { id: 'ef-forks', label: 'Forks, clips, heel — no cracks or bending', category: 'Motor Off Checks', critical: true },
        { id: 'ef-backrest', label: 'Load backrest properly attached', category: 'Motor Off Checks', critical: false },
        { id: 'ef-hyd-mast', label: 'Hydraulic hoses, mast chains, cables, stops — visual check', category: 'Motor Off Checks', critical: false },
        { id: 'ef-overhead', label: 'Overhead guard and finger guards attached', category: 'Motor Off Checks', critical: true },
        { id: 'ef-warnings', label: 'Safety warnings properly attached', category: 'Motor Off Checks', critical: false },
        { id: 'ef-battery', label: 'Battery — water/electrolyte level and charge', category: 'Motor Off Checks', critical: false },
        { id: 'ef-fluids', label: 'Hydraulic and transmission fluid levels', category: 'Motor Off Checks', critical: false },
        { id: 'ef-docs', label: "Operator's manual present; capacity plate matches specs", category: 'Motor Off Checks', critical: false },
        { id: 'ef-batt-restraint', label: 'Battery restraint adjusted and fastened', category: 'Motor Off Checks', critical: false },
        { id: 'ef-seatbelt', label: 'Seat belt — smooth operation', category: 'Motor Off Checks', critical: true },
        { id: 'ef-brake-fluid', label: 'Brake fluid level', category: 'Motor Off Checks', critical: false },
      ],
    },
    {
      category: 'Motor On Checks',
      items: [
        { id: 'ef-accel', label: 'Accelerator linkage', category: 'Motor On Checks', critical: false },
        { id: 'ef-park-brake', label: 'Parking brake holds', category: 'Motor On Checks', critical: true },
        { id: 'ef-svc-brake', label: 'Service brake holds', category: 'Motor On Checks', critical: true },
        { id: 'ef-steering', label: 'Steering operation', category: 'Motor On Checks', critical: true },
        { id: 'ef-drive', label: 'Drive controls — forward/reverse', category: 'Motor On Checks', critical: false },
        { id: 'ef-tilt', label: 'Tilt controls — forward/back', category: 'Motor On Checks', critical: false },
        { id: 'ef-hoist', label: 'Hoist/lowering controls', category: 'Motor On Checks', critical: false },
        { id: 'ef-attach', label: 'Attachment operation', category: 'Motor On Checks', critical: false },
        { id: 'ef-horn', label: 'Horn', category: 'Motor On Checks', critical: false },
        { id: 'ef-lights', label: 'Lights and alarms', category: 'Motor On Checks', critical: false },
        { id: 'ef-hours', label: 'Hour meters (drive and hoist)', category: 'Motor On Checks', critical: false },
        { id: 'ef-discharge', label: 'Battery discharge indicator', category: 'Motor On Checks', critical: false },
        { id: 'ef-monitors', label: 'Instrument monitors', category: 'Motor On Checks', critical: false },
      ],
    },
  ],
}

const scissorLift: ChecklistDefinition = {
  type: 'scissor-lift',
  title: 'Electric Scissor Lift',
  sections: [
    {
      category: 'Ground Level Inspection',
      items: [
        { id: 'sl-leaks', label: 'No fluid leaks (hydraulic, battery acid)', category: 'Ground Level Inspection', critical: false },
        { id: 'sl-tires', label: 'Tires in good condition', category: 'Ground Level Inspection', critical: false },
        { id: 'sl-pins', label: 'All pins and bolts secure', category: 'Ground Level Inspection', critical: false },
        { id: 'sl-decals', label: 'Warning decals and capacity plate visible', category: 'Ground Level Inspection', critical: false },
        { id: 'sl-battery', label: 'Battery secured, terminals clean', category: 'Ground Level Inspection', critical: false },
      ],
    },
    {
      category: 'Platform & Guardrails',
      items: [
        { id: 'sl-floor', label: 'Platform floor non-slip, good condition', category: 'Platform & Guardrails', critical: false },
        { id: 'sl-rails', label: 'Guardrails secure and proper height', category: 'Platform & Guardrails', critical: true },
        { id: 'sl-midrails', label: 'Midrails installed and secure', category: 'Platform & Guardrails', critical: false },
        { id: 'sl-toeboards', label: 'Toeboards in place', category: 'Platform & Guardrails', critical: false },
        { id: 'sl-gate', label: 'Entry gate closes and latches', category: 'Platform & Guardrails', critical: true },
      ],
    },
    {
      category: 'Controls & Functions',
      items: [
        { id: 'sl-plat-ctrl', label: 'Platform controls functional', category: 'Controls & Functions', critical: false },
        { id: 'sl-gnd-ctrl', label: 'Ground controls functional', category: 'Controls & Functions', critical: false },
        { id: 'sl-estop', label: 'Emergency stop works — both locations', category: 'Controls & Functions', critical: true },
        { id: 'sl-lift', label: 'Platform raises/lowers smoothly', category: 'Controls & Functions', critical: false },
        { id: 'sl-drive', label: 'Drive functions in all directions', category: 'Controls & Functions', critical: false },
        { id: 'sl-horn', label: 'Horn/alarm operational', category: 'Controls & Functions', critical: false },
      ],
    },
    {
      category: 'Safety Devices',
      items: [
        { id: 'sl-tilt', label: 'Tilt alarm/indicator functional', category: 'Safety Devices', critical: false },
        { id: 'sl-limits', label: 'Limit switches functioning', category: 'Safety Devices', critical: false },
        { id: 'sl-pothole', label: 'Pothole protection device works', category: 'Safety Devices', critical: true },
        { id: 'sl-descent', label: 'Descent alarm operational', category: 'Safety Devices', critical: false },
      ],
    },
  ],
}

const walkiePalletJack: ChecklistDefinition = {
  type: 'walkie-pallet-jack',
  title: 'Electric Walkie Pallet Jack',
  sections: [
    {
      category: 'Visual Inspection',
      items: [
        { id: 'wp-leaks', label: 'No fluid leaks (hydraulic, battery)', category: 'Visual Inspection', critical: false },
        { id: 'wp-frame', label: 'Body/frame — no damage', category: 'Visual Inspection', critical: false },
        { id: 'wp-decals', label: 'Warning decals and capacity plate visible', category: 'Visual Inspection', critical: false },
        { id: 'wp-charge', label: 'Battery charge level adequate', category: 'Visual Inspection', critical: false },
        { id: 'wp-batt-conn', label: 'Battery connections tight/clean', category: 'Visual Inspection', critical: false },
      ],
    },
    {
      category: 'Controls & Operation',
      items: [
        { id: 'wp-throttle', label: 'Throttle/butterfly control', category: 'Controls & Operation', critical: false },
        { id: 'wp-lift', label: 'Lift/lower function', category: 'Controls & Operation', critical: false },
        { id: 'wp-estop', label: 'Emergency stop / belly button', category: 'Controls & Operation', critical: true },
        { id: 'wp-horn', label: 'Horn/bell', category: 'Controls & Operation', critical: false },
        { id: 'wp-brakes', label: 'Brakes functional', category: 'Controls & Operation', critical: true },
      ],
    },
    {
      category: 'Forks & Wheels',
      items: [
        { id: 'wp-forks', label: 'Fork tips — not bent or cracked', category: 'Forks & Wheels', critical: true },
        { id: 'wp-load-wheels', label: 'Load wheels — condition', category: 'Forks & Wheels', critical: false },
        { id: 'wp-steer-wheels', label: 'Steer wheels — condition', category: 'Forks & Wheels', critical: false },
      ],
    },
  ],
}

const manualPalletJack: ChecklistDefinition = {
  type: 'manual-pallet-jack',
  title: 'Manual Hydraulic Pallet Jack',
  sections: [
    {
      category: 'Visual Inspection',
      items: [
        { id: 'mp-frame', label: 'Frame not bent or cracked', category: 'Visual Inspection', critical: false },
        { id: 'mp-leaks', label: 'No hydraulic fluid leaks', category: 'Visual Inspection', critical: false },
        { id: 'mp-handle', label: 'Handle in good condition', category: 'Visual Inspection', critical: false },
      ],
    },
    {
      category: 'Forks & Wheels',
      items: [
        { id: 'mp-forks', label: 'Fork tips — not bent or cracked', category: 'Forks & Wheels', critical: true },
        { id: 'mp-rollers', label: 'Load rollers spin freely', category: 'Forks & Wheels', critical: false },
        { id: 'mp-steer', label: 'Steer wheels — condition and swivel', category: 'Forks & Wheels', critical: false },
      ],
    },
    {
      category: 'Hydraulic Pump',
      items: [
        { id: 'mp-raises', label: 'Raises to full height', category: 'Hydraulic Pump', critical: false },
        { id: 'mp-holds', label: 'Holds load without drifting', category: 'Hydraulic Pump', critical: true },
        { id: 'mp-lowers', label: 'Lowers smoothly', category: 'Hydraulic Pump', critical: false },
        { id: 'mp-valve', label: 'Release valve not leaking', category: 'Hydraulic Pump', critical: false },
      ],
    },
  ],
}

export const CHECKLISTS: Record<ChecklistType, ChecklistDefinition> = {
  'electric-forklift': electricForklift,
  'scissor-lift': scissorLift,
  'walkie-pallet-jack': walkiePalletJack,
  'manual-pallet-jack': manualPalletJack,
}

export function getChecklist(type: ChecklistType): ChecklistDefinition {
  return CHECKLISTS[type]
}

export function getAllItems(type: ChecklistType): ChecklistItem[] {
  return CHECKLISTS[type].sections.flatMap((s) => s.items)
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

**Step 3: Commit**

```bash
git add src/data/inspection-checklists.ts
git commit -m "feat: add OSHA-aligned inspection checklist definitions for 4 PIT types"
```

---

### Task 3: Create inspection data access layer

**Files:**
- Create: `src/lib/inspections.ts`

**Step 1: Create the data access layer**

Mirror the work-orders.ts pattern exactly:

```typescript
/**
 * Inspection data access layer — THE SWAP POINT.
 *
 * Currently backed by localStorage. To migrate to Notion,
 * replace the internal read/write helpers and keep the public API unchanged.
 */

import { InspectionRecord, InspectionItemResult, ChecklistType, Shift } from '@/lib/types'
import { getAllItems } from '@/data/inspection-checklists'
import { createWorkOrder } from '@/lib/work-orders'
import { updateEquipmentStatus, getEquipmentById } from '@/lib/equipment'

const STORAGE_KEY = 'eqr-inspections'
const COUNTER_KEY = 'eqr-ins-counter'
const INSPECTOR_KEY = 'eqr-last-inspector'

// ── Internal helpers ─────────────────────────────────

function readAll(): InspectionRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeAll(records: InspectionRecord[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

function nextId(): string {
  if (typeof window === 'undefined') return 'INS-0000-0001'
  const year = new Date().getFullYear()
  let stored: { year: number; count: number } = { year, count: 0 }
  try {
    const raw = localStorage.getItem(COUNTER_KEY)
    if (raw) stored = JSON.parse(raw)
  } catch { /* start fresh */ }
  if (stored.year !== year) {
    stored = { year, count: 0 }
  }
  stored.count += 1
  localStorage.setItem(COUNTER_KEY, JSON.stringify(stored))
  return `INS-${year}-${String(stored.count).padStart(4, '0')}`
}

// ── Change notification (pub/sub) ────────────────────

const listeners = new Set<() => void>()

export function onInspectionChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function notify() {
  listeners.forEach((fn) => fn())
}

// ── Inspector name persistence ───────────────────────

export function getLastInspector(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(INSPECTOR_KEY) || ''
}

export function setLastInspector(name: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(INSPECTOR_KEY, name)
}

// ── Blank checklist builder ──────────────────────────

export function buildBlankItems(checklistType: ChecklistType): InspectionItemResult[] {
  return getAllItems(checklistType).map((item) => ({
    id: item.id,
    label: item.label,
    category: item.category,
    critical: item.critical,
    result: null,
    notes: '',
    photo: null,
  }))
}

// ── Public API ───────────────────────────────────────

export function getInspectionsByEquipment(equipmentId: number): InspectionRecord[] {
  return readAll()
    .filter((r) => r.equipmentId === equipmentId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function getAllInspections(): InspectionRecord[] {
  return readAll().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function submitInspection(data: {
  equipmentId: number
  inspectorName: string
  shift: Shift
  hourMeterReading: number | null
  checklistType: ChecklistType
  items: InspectionItemResult[]
}): InspectionRecord {
  const hasCriticalFail = data.items.some(
    (item) => item.critical && item.result === 'fail'
  )
  const hasAnyFail = data.items.some((item) => item.result === 'fail')

  let workOrderId: string | null = null

  // Auto-create work order if any item failed
  if (hasAnyFail) {
    const equipment = getEquipmentById(data.equipmentId)
    const failedItems = data.items.filter((item) => item.result === 'fail')
    const failSummary = failedItems
      .map((item) => `${item.label}${item.notes ? ': ' + item.notes : ''}`)
      .join('; ')

    const wo = createWorkOrder({
      equipmentId: data.equipmentId,
      pmType: 'Daily',
      tasks: `Pre-trip inspection defects: ${failSummary}`,
      assignedTo: null,
    })
    workOrderId = wo.id

    // Auto-set equipment to Out of Service if critical fail
    if (hasCriticalFail) {
      updateEquipmentStatus(data.equipmentId, 'Out of Service')
    }
  }

  // Save inspector name for next time
  setLastInspector(data.inspectorName)

  const record: InspectionRecord = {
    id: nextId(),
    equipmentId: data.equipmentId,
    inspectorName: data.inspectorName,
    shift: data.shift,
    hourMeterReading: data.hourMeterReading,
    checklistType: data.checklistType,
    items: data.items,
    result: hasAnyFail ? 'fail' : 'pass',
    hasCriticalFail,
    workOrderId,
    createdAt: new Date().toISOString(),
    syncStatus: 'pending',
    notionPageId: null,
  }

  const all = readAll()
  all.push(record)
  writeAll(all)
  notify()
  return record
}

// ── Export helpers ────────────────────────────────────

export function exportInspectionsToCsv(records: InspectionRecord[]): string {
  const headers = [
    'Inspection_ID', 'Equipment_ID', 'Inspector', 'Shift',
    'Hour_Meter', 'Checklist_Type', 'Result', 'Critical_Fail',
    'Failed_Items', 'Work_Order_ID', 'Date', 'Sync_Status',
  ]
  const rows = records.map((r) => {
    const failedItems = r.items
      .filter((i) => i.result === 'fail')
      .map((i) => i.label)
      .join('; ')
    return [
      r.id, r.equipmentId, `"${r.inspectorName}"`, r.shift,
      r.hourMeterReading ?? '', r.checklistType, r.result,
      r.hasCriticalFail ? 'YES' : 'NO',
      `"${failedItems}"`, r.workOrderId ?? '', r.createdAt, r.syncStatus,
    ].join(',')
  })
  return [headers.join(','), ...rows].join('\n')
}

// ── Notion sync stub ─────────────────────────────────

export async function syncToNotion(record: InspectionRecord): Promise<boolean> {
  // TODO: Implement when Notion API key is available
  // POST to /api/sync-inspection with the record
  // On success, update record.syncStatus = 'synced' and record.notionPageId
  // On failure, update record.syncStatus = 'failed'
  console.log('[Notion sync stub] Would sync inspection:', record.id)
  return false
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

**Step 3: Commit**

```bash
git add src/lib/inspections.ts
git commit -m "feat: add inspection data access layer with auto work-order creation"
```

---

### Task 4: Create PreTripInspection component

**Files:**
- Create: `src/components/PreTripInspection.tsx`

**Step 1: Create the main inspection form component**

This is the largest component. It handles the full flow: identify → checklist → submit → result → history.

```typescript
'use client'

import { useState, useEffect, useRef } from 'react'
import {
  ClipboardCheck, Camera, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, User, Clock, Gauge, Shield,
  CircleAlert, Wrench, X
} from 'lucide-react'
import {
  EquipmentItem, Shift, InspectionResult, InspectionItemResult,
  getChecklistType,
} from '@/lib/types'
import { getChecklist } from '@/data/inspection-checklists'
import {
  buildBlankItems, getLastInspector, submitInspection,
  getInspectionsByEquipment, onInspectionChange,
} from '@/lib/inspections'

interface PreTripInspectionProps {
  equipment: EquipmentItem
  onStatusChange?: () => void
}

const SHIFTS: Shift[] = ['Day', 'Swing', 'Night']

// Compress photo to max 800px wide, 0.7 JPEG quality
function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxW = 800
        const scale = img.width > maxW ? maxW / img.width : 1
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

type FormStep = 'identify' | 'checklist' | 'result'

export default function PreTripInspection({ equipment, onStatusChange }: PreTripInspectionProps) {
  const checklistType = getChecklistType(equipment)
  const checklist = getChecklist(checklistType)

  const [step, setStep] = useState<FormStep>('identify')
  const [inspectorName, setInspectorName] = useState('')
  const [shift, setShift] = useState<Shift>('Day')
  const [hourMeter, setHourMeter] = useState('')
  const [items, setItems] = useState<InspectionItemResult[]>(() => buildBlankItems(checklistType))
  const [submittedRecord, setSubmittedRecord] = useState<{ result: 'pass' | 'fail'; hasCriticalFail: boolean; workOrderId: string | null } | null>(null)
  const [history, setHistory] = useState(() => getInspectionsByEquipment(equipment.itemNumber))
  const [showHistory, setShowHistory] = useState(false)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Load last inspector name
  useEffect(() => {
    const last = getLastInspector()
    if (last) setInspectorName(last)
  }, [])

  // Subscribe to inspection changes for history
  useEffect(() => {
    return onInspectionChange(() => {
      setHistory(getInspectionsByEquipment(equipment.itemNumber))
    })
  }, [equipment.itemNumber])

  function updateItem(id: string, updates: Partial<InspectionItemResult>) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    )
  }

  async function handlePhoto(id: string, file: File) {
    try {
      const compressed = await compressPhoto(file)
      updateItem(id, { photo: compressed })
    } catch {
      // Silently fail — photo is optional
    }
  }

  function handleStartChecklist() {
    if (!inspectorName.trim()) return
    setStep('checklist')
  }

  function handleSubmit() {
    // Validate: all items must have a result
    const unanswered = items.filter((item) => item.result === null)
    if (unanswered.length > 0) return

    const record = submitInspection({
      equipmentId: equipment.itemNumber,
      inspectorName: inspectorName.trim(),
      shift,
      hourMeterReading: hourMeter ? Number(hourMeter) : null,
      checklistType,
      items,
    })

    setSubmittedRecord({
      result: record.result,
      hasCriticalFail: record.hasCriticalFail,
      workOrderId: record.workOrderId,
    })
    setStep('result')

    if (record.hasCriticalFail) {
      onStatusChange?.()
    }
  }

  function handleReset() {
    setStep('identify')
    setItems(buildBlankItems(checklistType))
    setHourMeter('')
    setSubmittedRecord(null)
  }

  const allAnswered = items.every((item) => item.result !== null)
  const answeredCount = items.filter((item) => item.result !== null).length
  const failedCritical = items.filter((item) => item.critical && item.result === 'fail')

  // ── Step 1: Identify ──────────────────────────────

  if (step === 'identify') {
    return (
      <div className="space-y-6">
        <div className="bg-mytra-purple/10 border-l-4 border-mytra-purple rounded-r-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" />
            {checklist.title} — Pre-Trip Inspection
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            {checklist.sections.reduce((sum, s) => sum + s.items.length, 0)} items to check.
            This takes about 2-3 minutes.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              Your Name
            </label>
            <input
              type="text"
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              placeholder="Enter your name"
              className="w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3
                         text-sm text-white placeholder:text-gray-600
                         focus:outline-none focus:ring-2 focus:ring-mytra-purple focus:border-transparent"
              autoComplete="name"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Shift
            </label>
            <div className="flex gap-2">
              {SHIFTS.map((s) => (
                <button
                  key={s}
                  onClick={() => setShift(s)}
                  className={`flex-1 text-sm font-medium py-2 rounded-lg border transition-colors
                    ${shift === s
                      ? 'bg-mytra-purple/20 border-mytra-purple text-mytra-purple'
                      : 'bg-mytra-card border-mytra-border text-gray-400 hover:bg-mytra-card-hover'
                    }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {checklistType !== 'manual-pallet-jack' && (
            <div>
              <label className="text-xs text-gray-400 block mb-1.5 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5" />
                Hour Meter Reading
                <span className="text-gray-600">(optional)</span>
              </label>
              <input
                type="number"
                value={hourMeter}
                onChange={(e) => setHourMeter(e.target.value)}
                placeholder="e.g. 1250"
                inputMode="numeric"
                className="w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3
                           text-sm text-white placeholder:text-gray-600
                           focus:outline-none focus:ring-2 focus:ring-mytra-purple focus:border-transparent"
              />
            </div>
          )}
        </div>

        <button
          onClick={handleStartChecklist}
          disabled={!inspectorName.trim()}
          className="w-full bg-mytra-purple hover:bg-mytra-purple-hover disabled:opacity-40
                     disabled:cursor-not-allowed text-white text-sm font-medium py-3 rounded-lg
                     transition-colors"
        >
          Start Inspection
        </button>

        {/* History section */}
        {history.length > 0 && (
          <InspectionHistory
            history={history.slice(0, 5)}
            showHistory={showHistory}
            onToggle={() => setShowHistory(!showHistory)}
          />
        )}
      </div>
    )
  }

  // ── Step 2: Checklist ─────────────────────────────

  if (step === 'checklist') {
    return (
      <div className="space-y-6">
        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
            <span>{answeredCount} of {items.length} items checked</span>
            {failedCritical.length > 0 && (
              <span className="text-red-400 flex items-center gap-1">
                <CircleAlert className="w-3 h-3" />
                {failedCritical.length} critical {failedCritical.length === 1 ? 'issue' : 'issues'}
              </span>
            )}
          </div>
          <div className="w-full bg-mytra-border rounded-full h-1.5">
            <div
              className="bg-mytra-purple h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / items.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Checklist sections */}
        {checklist.sections.map((section) => (
          <div key={section.category}>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              {section.category}
            </h3>
            <div className="space-y-2">
              {section.items.map((checkItem) => {
                const itemState = items.find((i) => i.id === checkItem.id)!
                return (
                  <ChecklistItemRow
                    key={checkItem.id}
                    item={checkItem}
                    state={itemState}
                    onResult={(result) => updateItem(checkItem.id, { result })}
                    onNotes={(notes) => updateItem(checkItem.id, { notes })}
                    onPhoto={(file) => handlePhoto(checkItem.id, file)}
                    onRemovePhoto={() => updateItem(checkItem.id, { photo: null })}
                    fileInputRef={(el) => { fileInputRefs.current[checkItem.id] = el }}
                  />
                )
              })}
            </div>
          </div>
        ))}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!allAnswered}
          className="w-full bg-mytra-purple hover:bg-mytra-purple-hover disabled:opacity-40
                     disabled:cursor-not-allowed text-white text-sm font-medium py-3 rounded-lg
                     transition-colors sticky bottom-4"
        >
          {allAnswered
            ? 'Submit Inspection'
            : `${items.length - answeredCount} items remaining`}
        </button>
      </div>
    )
  }

  // ── Step 3: Result ────────────────────────────────

  return (
    <div className="space-y-6 animate-fadeIn">
      {submittedRecord?.result === 'pass' && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-1">All Clear</h3>
          <p className="text-gray-300 text-sm">
            You&apos;re good to go. Inspection logged.
          </p>
        </div>
      )}

      {submittedRecord?.result === 'fail' && !submittedRecord.hasCriticalFail && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-6 text-center">
          <Wrench className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-1">Issues Noted</h3>
          <p className="text-gray-300 text-sm">
            Maintenance has been notified. You may operate with caution.
          </p>
          {submittedRecord.workOrderId && (
            <p className="text-gray-500 text-xs mt-2">
              Work order {submittedRecord.workOrderId} created
            </p>
          )}
        </div>
      )}

      {submittedRecord?.hasCriticalFail && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
          <Shield className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-1">
            Out of Service
          </h3>
          <p className="text-gray-300 text-sm">
            This unit has been taken out of service for maintenance.
            <br />
            Thanks for keeping everyone safe.
          </p>
          {submittedRecord.workOrderId && (
            <p className="text-gray-500 text-xs mt-2">
              Work order {submittedRecord.workOrderId} created
            </p>
          )}
        </div>
      )}

      <button
        onClick={handleReset}
        className="w-full bg-mytra-card hover:bg-mytra-card-hover border border-mytra-border
                   text-white text-sm font-medium py-3 rounded-lg transition-colors"
      >
        New Inspection
      </button>
    </div>
  )
}

// ── Checklist Item Row ──────────────────────────────

interface ChecklistItemRowProps {
  item: { id: string; label: string; critical: boolean }
  state: InspectionItemResult
  onResult: (result: InspectionResult) => void
  onNotes: (notes: string) => void
  onPhoto: (file: File) => void
  onRemovePhoto: () => void
  fileInputRef: (el: HTMLInputElement | null) => void
}

function ChecklistItemRow({
  item, state, onResult, onNotes, onPhoto, onRemovePhoto, fileInputRef,
}: ChecklistItemRowProps) {
  const resultButtons: { value: InspectionResult; label: string; activeClass: string }[] = [
    { value: 'pass', label: 'Pass', activeClass: 'bg-green-500/20 border-green-500 text-green-400' },
    { value: 'fail', label: 'Fail', activeClass: 'bg-red-500/20 border-red-500 text-red-400' },
    { value: 'na', label: 'N/A', activeClass: 'bg-gray-500/20 border-gray-500 text-gray-400' },
  ]

  return (
    <div className="bg-mytra-card border border-mytra-border rounded-lg p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white leading-snug">
            {item.label}
          </p>
          {item.critical && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400 mt-1">
              <AlertTriangle className="w-2.5 h-2.5" />
              Safety-critical
            </span>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          {resultButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => onResult(btn.value)}
              className={`text-xs font-medium px-2.5 py-1.5 rounded border transition-colors
                ${state.result === btn.value
                  ? btn.activeClass
                  : 'border-mytra-border text-gray-500 hover:bg-mytra-card-hover'
                }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Expanded fail details */}
      {state.result === 'fail' && (
        <div className="mt-3 space-y-2 animate-fadeIn">
          {item.critical && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2">
              <p className="text-xs text-amber-300">
                This is a safety-critical item — flagging it will send this unit to maintenance.
              </p>
            </div>
          )}
          <input
            type="text"
            value={state.notes}
            onChange={(e) => onNotes(e.target.value)}
            placeholder="Describe the issue..."
            className="w-full bg-mytra-bg border border-mytra-border rounded py-2 px-3
                       text-xs text-white placeholder:text-gray-600
                       focus:outline-none focus:ring-1 focus:ring-mytra-purple"
          />
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onPhoto(file)
              }}
              className="hidden"
            />
            {!state.photo ? (
              <button
                onClick={() => fileInputRefs.current?.[item.id]?.click()}
                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white
                           bg-mytra-bg border border-mytra-border rounded px-3 py-1.5 transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                Add Photo
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <img
                  src={state.photo}
                  alt="Defect photo"
                  className="w-12 h-12 rounded object-cover border border-mytra-border"
                />
                <button
                  onClick={onRemovePhoto}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Inspection History ──────────────────────────────

// Need to reference the ref from parent scope for photo button
const fileInputRefs: { current: Record<string, HTMLInputElement | null> } = { current: {} }

interface InspectionHistoryProps {
  history: InspectionRecord[]
  showHistory: boolean
  onToggle: () => void
}

function InspectionHistory({ history, showHistory, onToggle }: InspectionHistoryProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
      >
        {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        Recent Inspections ({history.length})
      </button>

      <div className={`accordion-content ${showHistory ? 'open' : ''}`}>
        <div>
          <div className="mt-3 space-y-2">
            {history.map((record) => (
              <div
                key={record.id}
                className="bg-mytra-card border border-mytra-border rounded-lg px-3 py-2
                           flex items-center justify-between"
              >
                <div>
                  <p className="text-xs text-white">{record.inspectorName}</p>
                  <p className="text-[10px] text-gray-500">
                    {new Date(record.createdAt).toLocaleDateString()} · {record.shift} shift
                  </p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full
                    ${record.result === 'pass'
                      ? 'bg-green-500/15 text-green-400'
                      : record.hasCriticalFail
                        ? 'bg-red-500/15 text-red-400'
                        : 'bg-amber-500/15 text-amber-400'
                    }`}
                >
                  {record.result === 'pass' ? 'Pass' : record.hasCriticalFail ? 'Critical' : 'Issues'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Important note on the `fileInputRefs` pattern:** The component above has a scoping issue with the `fileInputRefs` module-level variable vs the `useRef` inside the component. During implementation, consolidate to use only the `useRef` inside the component. The `ChecklistItemRow` should receive an `onCameraClick` callback instead of directly accessing refs. Here's the fix:

In `ChecklistItemRow`, replace the camera button `onClick` with calling the parent-provided handler:

```typescript
// In ChecklistItemRow props, add:
onCameraClick: () => void

// In the button:
<button onClick={onCameraClick} ...>

// In the parent, pass:
onCameraClick={() => fileInputRefs.current[checkItem.id]?.click()}
```

Remove the module-level `fileInputRefs` variable entirely.

**Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

**Step 3: Commit**

```bash
git add src/components/PreTripInspection.tsx
git commit -m "feat: add PreTripInspection component with checklist, photo capture, and history"
```

---

### Task 5: Wire Pre-Trip tab into EquipmentProfile

**Files:**
- Modify: `src/components/EquipmentProfile.tsx`

**Step 1: Add the Pre-Trip tab conditionally**

Import the new component and `requiresPreTrip`:

```typescript
// Add to imports:
import { EquipmentItem, EquipmentStatus, CATEGORY_COLORS, requiresMachineGuarding, requiresPreTrip } from '@/lib/types'
import PreTripInspection from '@/components/PreTripInspection'
import { ClipboardCheck } from 'lucide-react'
```

Update the tab definitions to be dynamic based on equipment category:

```typescript
// Replace the static TAB_IDS and TABS with:

const BASE_TAB_IDS = ['training', 'pm-schedule', 'compliance'] as const
const PRETRIP_TAB_IDS = ['pre-trip', 'training', 'pm-schedule', 'compliance'] as const
type TabId = 'pre-trip' | 'training' | 'pm-schedule' | 'compliance'
```

Inside the component:

```typescript
const showPreTrip = requiresPreTrip(equipment)

const TABS = [
  ...(showPreTrip
    ? [{ id: 'pre-trip' as TabId, label: 'Pre-Trip', icon: <ClipboardCheck className="w-4 h-4" /> }]
    : []),
  { id: 'training' as TabId, label: 'Training', icon: <GraduationCap className="w-4 h-4" /> },
  { id: 'pm-schedule' as TabId, label: 'PM Schedule', icon: <Calendar className="w-4 h-4" /> },
  { id: 'compliance' as TabId, label: 'Compliance', icon: <ShieldCheck className="w-4 h-4" /> },
]

const TAB_IDS = TABS.map((t) => t.id)

function isValidTab(value: string | null): value is TabId {
  return TAB_IDS.includes(value as TabId)
}

// Default to pre-trip tab if equipment qualifies, otherwise training
const defaultTab = showPreTrip ? 'pre-trip' : 'training'
const initialTab = isValidTab(tabParam) ? tabParam : defaultTab
```

Add a callback to refresh status when a critical fail marks equipment Out of Service:

```typescript
function handleInspectionStatusChange() {
  // Re-read status from localStorage (the inspection auto-updated it)
  const updated = getEquipmentById(equipment.itemNumber)
  if (updated) setStatus(updated.status)
}
```

Add to imports: `import { getEquipmentById } from '@/lib/equipment'`

Add the tab content rendering:

```typescript
{activeTab === 'pre-trip' && (
  <PreTripInspection
    equipment={equipment}
    onStatusChange={handleInspectionStatusChange}
  />
)}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

**Step 3: Test locally**

Run: `npm run dev`
- Open a forklift profile (e.g. `/equipment/24`) → should show Pre-Trip tab first
- Open a non-PIT item (e.g. a drill press) → should NOT show Pre-Trip tab
- Complete a pre-trip inspection → should log it
- Fail a critical item → should show Out of Service confirmation and create work order

**Step 4: Commit**

```bash
git add src/components/EquipmentProfile.tsx
git commit -m "feat: wire Pre-Trip inspection tab into equipment profiles"
```

---

### Task 6: Create Notion sync API stub

**Files:**
- Create: `api/sync-inspection.ts`

**Step 1: Create Vercel serverless function stub**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * POST /api/sync-inspection
 *
 * Syncs an inspection record to a Notion database.
 * Requires NOTION_API_KEY and NOTION_INSPECTIONS_DB_ID env vars.
 *
 * TODO: Implement when Notion API key is available (Monday).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const notionKey = process.env.NOTION_API_KEY
  const dbId = process.env.NOTION_INSPECTIONS_DB_ID

  if (!notionKey || !dbId) {
    return res.status(503).json({
      error: 'Notion integration not configured',
      message: 'Set NOTION_API_KEY and NOTION_INSPECTIONS_DB_ID environment variables',
    })
  }

  try {
    const record = req.body

    // TODO: Implement Notion API call
    // const notion = new Client({ auth: notionKey })
    // const response = await notion.pages.create({
    //   parent: { database_id: dbId },
    //   properties: {
    //     'Inspection ID': { title: [{ text: { content: record.id } }] },
    //     'Equipment ID': { number: record.equipmentId },
    //     'Inspector': { rich_text: [{ text: { content: record.inspectorName } }] },
    //     'Shift': { select: { name: record.shift } },
    //     'Hour Meter': { number: record.hourMeterReading },
    //     'Result': { select: { name: record.result } },
    //     'Critical Fail': { checkbox: record.hasCriticalFail },
    //     'Work Order': { rich_text: [{ text: { content: record.workOrderId || '' } }] },
    //     'Date': { date: { start: record.createdAt } },
    //   },
    // })

    return res.status(200).json({
      success: true,
      message: 'Notion sync stub — not yet implemented',
      recordId: record.id,
    })
  } catch (error) {
    return res.status(500).json({ error: 'Sync failed', details: String(error) })
  }
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

**Step 3: Commit**

```bash
git add api/sync-inspection.ts
git commit -m "feat: add Notion sync API stub for inspection records"
```

---

### Task 7: Final verification and deploy

**Step 1: Full build**

Run: `npm run build`
Expected: Clean build, no warnings.

**Step 2: Test locally**

Run: `npm run dev`

Manual test checklist:
- [ ] Forklift profile (`/equipment/24`) shows Pre-Trip tab as first tab
- [ ] Scissor lift profile (`/equipment/21`) shows Pre-Trip tab as first tab
- [ ] Walkie pallet jack (`/equipment/26`) shows Pre-Trip tab
- [ ] Manual pallet jack (`/equipment/27`) shows Pre-Trip tab with shorter checklist
- [ ] Non-PIT equipment does NOT show Pre-Trip tab
- [ ] Inspector name persists between inspections
- [ ] All-pass inspection shows green "All Clear" result
- [ ] Non-critical fail shows amber "Issues Noted" + creates work order
- [ ] Critical fail shows red "Out of Service" + creates work order + changes equipment status
- [ ] Photo capture works on mobile (camera opens)
- [ ] Recent Inspections history shows after first inspection
- [ ] Work orders page shows auto-created WOs
- [ ] Animations work (fadeIn on result, accordion on history)

**Step 3: Commit and push**

```bash
git add -A
git commit -m "feat: complete pre-trip inspection feature for PITs and aerial lifts"
git push origin main
```

**Step 4: Deploy to Vercel**

```bash
export PATH="/Users/markstarrpro/.npm-global/bin:$PATH" && vercel deploy --prod --name equipment-qr-hub
```

---

## File Summary

| File | Action | Description |
|------|--------|-------------|
| `src/lib/types.ts` | Modify | Add inspection types, `requiresPreTrip()`, `getChecklistType()` |
| `src/data/inspection-checklists.ts` | Create | OSHA-aligned checklist definitions for 4 equipment types |
| `src/lib/inspections.ts` | Create | Data access layer (localStorage + pub/sub + Notion stub) |
| `src/components/PreTripInspection.tsx` | Create | Main inspection form: identify → checklist → submit → history |
| `src/components/EquipmentProfile.tsx` | Modify | Add conditional Pre-Trip tab for qualifying equipment |
| `api/sync-inspection.ts` | Create | Vercel serverless Notion sync stub |
