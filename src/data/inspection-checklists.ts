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
        { id: 'ef-leaks', label: 'No hydraulic oil or battery leaks', category: 'Motor Off Checks', critical: true },
        { id: 'ef-tires', label: 'Tires — condition and pressure', category: 'Motor Off Checks', critical: false },
        { id: 'ef-forks', label: 'Forks, clips, heel — no cracks or bending', category: 'Motor Off Checks', critical: true },
        { id: 'ef-backrest', label: 'Load backrest properly attached', category: 'Motor Off Checks', critical: true },
        { id: 'ef-hyd-mast', label: 'Hydraulic hoses, mast chains, cables, stops — visual check', category: 'Motor Off Checks', critical: true },
        { id: 'ef-overhead', label: 'Overhead guard and finger guards attached', category: 'Motor Off Checks', critical: true },
        { id: 'ef-warnings', label: 'Safety warnings properly attached', category: 'Motor Off Checks', critical: false },
        { id: 'ef-battery', label: 'Battery — water/electrolyte level and charge', category: 'Motor Off Checks', critical: false },
        { id: 'ef-fluids', label: 'Hydraulic and transmission fluid levels', category: 'Motor Off Checks', critical: false },
        { id: 'ef-docs', label: "Operator's manual present; capacity plate matches specs", category: 'Motor Off Checks', critical: false },
        { id: 'ef-batt-restraint', label: 'Battery restraint adjusted and fastened', category: 'Motor Off Checks', critical: false },
        { id: 'ef-seatbelt', label: 'Seat belt — smooth operation', category: 'Motor Off Checks', critical: true },
        { id: 'ef-brake-fluid', label: 'Brake fluid level', category: 'Motor Off Checks', critical: true },
      ],
    },
    {
      category: 'Motor On Checks',
      items: [
        { id: 'ef-accel', label: 'Accelerator linkage', category: 'Motor On Checks', critical: false },
        { id: 'ef-park-brake', label: 'Parking brake holds', category: 'Motor On Checks', critical: true },
        { id: 'ef-svc-brake', label: 'Service brake holds', category: 'Motor On Checks', critical: true },
        { id: 'ef-steering', label: 'Steering operation', category: 'Motor On Checks', critical: true },
        { id: 'ef-drive', label: 'Drive controls — forward/reverse', category: 'Motor On Checks', critical: true },
        { id: 'ef-tilt', label: 'Tilt controls — forward/back', category: 'Motor On Checks', critical: true },
        { id: 'ef-hoist', label: 'Hoist/lowering controls', category: 'Motor On Checks', critical: true },
        { id: 'ef-attach', label: 'Attachment operation', category: 'Motor On Checks', critical: false },
        { id: 'ef-horn', label: 'Horn', category: 'Motor On Checks', critical: true },
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
        { id: 'sl-midrails', label: 'Midrails installed and secure', category: 'Platform & Guardrails', critical: true },
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
        { id: 'sl-lift', label: 'Platform raises/lowers smoothly', category: 'Controls & Functions', critical: true },
        { id: 'sl-drive', label: 'Drive functions in all directions', category: 'Controls & Functions', critical: false },
        { id: 'sl-horn', label: 'Horn/alarm operational', category: 'Controls & Functions', critical: true },
      ],
    },
    {
      category: 'Safety Devices',
      items: [
        { id: 'sl-tilt', label: 'Tilt alarm/indicator functional', category: 'Safety Devices', critical: true },
        { id: 'sl-limits', label: 'Limit switches functioning', category: 'Safety Devices', critical: true },
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
        { id: 'wp-horn', label: 'Horn/bell', category: 'Controls & Operation', critical: true },
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
        { id: 'mp-lowers', label: 'Lowers smoothly', category: 'Hydraulic Pump', critical: true },
        { id: 'mp-valve', label: 'Release valve not leaking', category: 'Hydraulic Pump', critical: true },
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
