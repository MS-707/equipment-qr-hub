/**
 * Safety Hub data definitions — PPE options, the PTP hazard library, and the
 * permit checklists (Work-at-Height, Hot Work, Confined Space).
 *
 * Checklist content encodes real OSHA / Cal-OSHA / NFPA requirements so the
 * forms are authoritative. `regRef` strings are rendered subtly in the UI.
 */

import type { PermitCheckItem, RiskLevel } from '@/lib/safety-types'

// ── PPE options (29 CFR 1910.132 / 1926.28; Cal-OSHA T8 §3380+) ──

export interface PpeOption {
  id: string
  label: string
}

export const PPE_OPTIONS: PpeOption[] = [
  { id: 'hard-hat', label: 'Hard hat' },
  { id: 'safety-glasses', label: 'Safety glasses' },
  { id: 'face-shield', label: 'Face shield' },
  { id: 'hearing', label: 'Hearing protection' },
  { id: 'hi-vis', label: 'Hi-vis vest' },
  { id: 'boots', label: 'Steel/composite-toe boots' },
  { id: 'cut-gloves', label: 'Cut-resistant gloves' },
  { id: 'welding-ppe', label: 'Welding PPE (jacket/shield)' },
  { id: 'respirator', label: 'Respirator (specify)' },
  { id: 'harness', label: 'Fall-arrest harness' },
  { id: 'arc-flash', label: 'Arc-flash PPE' },
]

export function ppeLabel(id: string): string {
  return PPE_OPTIONS.find((p) => p.id === id)?.label ?? id
}

// ── PTP hazard library (quick-add chips with suggested controls) ──

export interface HazardTemplate {
  description: string
  riskLevel: RiskLevel
  controlMeasure: string
}

export const PTP_HAZARD_LIBRARY: HazardTemplate[] = [
  { description: 'Working at height', riskLevel: 'high', controlMeasure: 'Guardrails / 100% tie-off; pre-use MEWP inspection; exclusion zone below' },
  { description: 'Falling / dropped objects', riskLevel: 'medium', controlMeasure: 'Tool tethers; toe-boards; barricade and signage below' },
  { description: 'Pinch / crush points', riskLevel: 'medium', controlMeasure: 'Hands clear of mating surfaces; cut-resistant gloves; tag lines on loads' },
  { description: 'Overhead loads / lifting', riskLevel: 'high', controlMeasure: 'Certified rigging; never under suspended loads; spotter/signaler' },
  { description: 'Powered industrial trucks / mobile plant', riskLevel: 'high', controlMeasure: 'Pre-trip inspection; pedestrian separation; spotter in tight areas' },
  { description: 'Electrical / energized parts', riskLevel: 'high', controlMeasure: 'LOTO; verify de-energized; qualified person; insulated tools' },
  { description: 'Hot work / fire', riskLevel: 'high', controlMeasure: 'Hot work permit; fire watch; extinguisher; clear combustibles 35 ft' },
  { description: 'Confined space', riskLevel: 'critical', controlMeasure: 'Entry permit; atmospheric testing; attendant; rescue plan' },
  { description: 'Manual handling / ergonomics', riskLevel: 'low', controlMeasure: 'Team lift; mechanical aids; size up load before lifting' },
  { description: 'Slips, trips & falls', riskLevel: 'low', controlMeasure: 'Housekeeping; cable management; mark/clear hazards' },
  { description: 'Noise', riskLevel: 'low', controlMeasure: 'Hearing protection in posted zones' },
  { description: 'Silica / dust / fumes', riskLevel: 'medium', controlMeasure: 'Wet methods / LEV; appropriate respirator; rotate tasks' },
  { description: 'Heat illness', riskLevel: 'medium', controlMeasure: 'Water, shade, rest breaks; high-heat procedures (T8 §3395)' },
  { description: 'Pressurized systems', riskLevel: 'high', controlMeasure: 'Depressurize / isolate; verify zero energy; PPE' },
  { description: 'Sharp edges / cuts', riskLevel: 'low', controlMeasure: 'Cut-resistant gloves; edge protection; safe blade handling' },
  { description: 'Public / vehicle interface', riskLevel: 'medium', controlMeasure: 'Traffic control; barriers; hi-vis; flaggers as needed' },
]

// ── Permit checklists ─────────────────────────────────────────

export type PermitChecklistKey = 'height' | 'hot-work' | 'confined-space'

interface RawCheckItem {
  id: string
  label: string
  category: string
  critical?: boolean
}

interface PermitChecklistDef {
  key: PermitChecklistKey
  title: string
  regRef: string
  items: RawCheckItem[]
}

const heightChecklist: PermitChecklistDef = {
  key: 'height',
  title: 'Work-at-Height',
  regRef: '29 CFR 1926.501/.502 · Cal-OSHA T8 §1669–§1671.1, §3209–§3212 · ANSI A92',
  items: [
    { id: 'h-guardrails', label: 'Guardrails present: top rail ~42″, midrail ~21″, toeboard where required', category: 'Access & Platform', critical: true },
    { id: 'h-mewp', label: 'MEWP/scissor inspected, on firm level ground, within capacity & wind limits', category: 'Access & Platform', critical: true },
    { id: 'h-ladder', label: 'Ladders/scaffold inspected, secured, correct duty rating', category: 'Access & Platform' },
    { id: 'h-openings', label: 'Floor/leading-edge openings & holes covered or guarded', category: 'Access & Platform', critical: true },
    { id: 'h-harness', label: 'Full-body harness inspected — no cuts, frays, UV/heat damage', category: 'Personal Fall Arrest', critical: true },
    { id: 'h-lanyard', label: 'Lanyard/SRL inspected; shock pack intact', category: 'Personal Fall Arrest' },
    { id: 'h-anchor', label: 'Anchor point ≥5,000 lb per worker or engineered/certified', category: 'Personal Fall Arrest', critical: true },
    { id: 'h-clearance', label: 'Total fall clearance calculated (free fall + deceleration + margin)', category: 'Personal Fall Arrest', critical: true },
    { id: 'h-rescue', label: 'Suspension-trauma rescue plan in place; prompt rescue available', category: 'Rescue & Dropped Objects', critical: true },
    { id: 'h-tethers', label: 'Tools tethered / toe-boards / exclusion zone below established', category: 'Rescue & Dropped Objects' },
    { id: 'h-barricade', label: 'Area below barricaded; signage posted', category: 'Rescue & Dropped Objects' },
  ],
}

const hotWorkChecklist: PermitChecklistDef = {
  key: 'hot-work',
  title: 'Hot Work',
  regRef: '29 CFR 1910.252 & 1926.352 · NFPA 51B · Cal-OSHA T8 §4848',
  items: [
    { id: 'hw-combustibles', label: 'Combustibles removed or protected within 35 ft', category: 'Area Preparation', critical: true },
    { id: 'hw-floors', label: 'Floors swept clean; flammable liquids/dusts removed', category: 'Area Preparation', critical: true },
    { id: 'hw-openings', label: 'Wall/floor openings & cracks covered; ducts/conveyors protected', category: 'Area Preparation' },
    { id: 'hw-concealed', label: 'Concealed combustibles (other side of walls) checked', category: 'Area Preparation' },
    { id: 'hw-extinguisher', label: 'Charged, inspected extinguisher of correct type at work point', category: 'Fire Suppression & Watch', critical: true },
    { id: 'hw-firewatch', label: 'Fire watch assigned, trained, equipped; stays during + after work', category: 'Fire Suppression & Watch', critical: true },
    { id: 'hw-sprinkler', label: 'Sprinkler system in service (or impairment authorized & documented)', category: 'Fire Suppression & Watch' },
    { id: 'hw-equipment', label: 'Welding/cutting equipment inspected; leads, hoses, regulators sound', category: 'Equipment & Atmosphere' },
    { id: 'hw-cylinders', label: 'Compressed-gas cylinders secured upright; caps/flash-arrestors fitted', category: 'Equipment & Atmosphere' },
    { id: 'hw-atmosphere', label: 'Atmosphere tested where flammable vapors possible; LEL acceptable', category: 'Equipment & Atmosphere', critical: true },
    { id: 'hw-ventilation', label: 'Adequate ventilation / fume control for the process & materials', category: 'Equipment & Atmosphere' },
  ],
}

const confinedSpaceChecklist: PermitChecklistDef = {
  key: 'confined-space',
  title: 'Confined Space Entry',
  regRef: '29 CFR 1910.146 & 1926.1200–1213 · Cal-OSHA T8 §5157',
  items: [
    { id: 'cs-eval', label: 'Space evaluated; permit-required determination made', category: 'Authorization & Roles', critical: true },
    { id: 'cs-supervisor', label: 'Entry supervisor authorized entry; entrants & attendant assigned', category: 'Authorization & Roles', critical: true },
    { id: 'cs-attendant', label: 'Dedicated attendant stationed outside for entire entry', category: 'Authorization & Roles', critical: true },
    { id: 'cs-log', label: 'Entry/exit log maintained', category: 'Authorization & Roles' },
    { id: 'cs-o2', label: 'O₂ 19.5–23.5%', category: 'Atmosphere (test in order)', critical: true },
    { id: 'cs-lel', label: 'Flammable < 10% LEL', category: 'Atmosphere (test in order)', critical: true },
    { id: 'cs-toxic', label: 'CO / H₂S within limits', category: 'Atmosphere (test in order)', critical: true },
    { id: 'cs-monitor', label: 'Continuous monitoring in place; re-test after breaks', category: 'Atmosphere (test in order)' },
    { id: 'cs-ventilation', label: 'Forced-air ventilation operating before & during entry', category: 'Controls & Rescue' },
    { id: 'cs-loto', label: 'Hazardous energy isolated/locked out; lines blanked/blinded as needed', category: 'Controls & Rescue' },
    { id: 'cs-retrieval', label: 'Non-entry retrieval system (harness + line) rigged where feasible', category: 'Controls & Rescue', critical: true },
    { id: 'cs-rescue', label: 'Rescue services / plan confirmed available & summoned-able', category: 'Controls & Rescue', critical: true },
    { id: 'cs-comms', label: 'Communication between attendant & entrants established', category: 'Controls & Rescue' },
  ],
}

const CHECKLISTS: Record<PermitChecklistKey, PermitChecklistDef> = {
  'height': heightChecklist,
  'hot-work': hotWorkChecklist,
  'confined-space': confinedSpaceChecklist,
}

export function getPermitChecklistDef(key: PermitChecklistKey): PermitChecklistDef {
  return CHECKLISTS[key]
}

/** Build a fresh (all-unchecked) checklist for a permit form. */
export function buildPermitItems(key: PermitChecklistKey): PermitCheckItem[] {
  return CHECKLISTS[key].items.map((i) => ({
    id: i.id,
    label: i.label,
    category: i.category,
    checked: false,
    notes: '',
    critical: i.critical ?? false,
  }))
}

// Multi-select option lists used by permit forms.
export const HEIGHT_ACCESS_METHODS = ['Scissor lift', 'Boom lift', 'Ladder', 'Scaffold', 'Fixed platform', 'Rope access']
export const HEIGHT_FALL_PROTECTION = ['Guardrails', 'PFAS (harness + lanyard/SRL)', 'Safety netting', 'Hole covers', 'Travel restraint']
export const HOT_WORK_TYPES = ['Welding', 'Cutting', 'Grinding', 'Brazing', 'Soldering', 'Torch']
export const CONFINED_SPACE_HAZARDS = ['Atmospheric', 'Engulfment', 'Configuration / entrapment', 'Mechanical', 'Electrical', 'Thermal']
