export type EquipmentCategory =
  | 'Stationary Machine Tools'
  | 'Welding'
  | 'Air Compressors'
  | 'Aerial Work Platforms'
  | 'Powered Industrial Trucks'
  | 'Material Handling'
  | 'Cordless Power Tools'
  | 'Environmental/Test'
  | 'Shop Infrastructure'

export type EquipmentStatus = 'Active' | 'Out of Service' | 'Retired' | 'Pending Repair'

export type ManualType = 'pdf' | 'webpage' | 'none'

export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface EquipmentItem {
  itemNumber: number
  name: string
  category: EquipmentCategory
  oemManual: string
  manualUrl: string
  manualType: ManualType
  pmDaily: string
  pmWeekly: string
  pmMonthly: string
  pmQuarterly: string
  pmSemiAnnual: string
  pmAnnual: string
  keyPmSummary: string
  calOshaSections: string
  calOshaTrainingReq: string
  status: EquipmentStatus
  location?: string
  assetTag?: string
  lastPmDate?: string
  nextPmDue?: string
}

export interface TrainingProgram {
  programId: string
  title: string
  regulatoryBasis: string
  tier: string
  prerequisite: string
  audience: string
  durationHours: number
  deliveryMethod: string
  frequency: string
  passScore: number
  practicalRequired: boolean
  calendarMonth: string
  priorityLevel: PriorityLevel
  instructorQualification: string
  osha10Overlap: string
}

export const CATEGORY_COLORS: Record<EquipmentCategory, string> = {
  'Stationary Machine Tools': '#3B82F6',
  'Welding': '#EF4444',
  'Air Compressors': '#F97316',
  'Aerial Work Platforms': '#8B5CF6',
  'Powered Industrial Trucks': '#EAB308',
  'Material Handling': '#22C55E',
  'Cordless Power Tools': '#EC4899',
  'Environmental/Test': '#6B7280',
  'Shop Infrastructure': '#D97706',
}

export const PRIORITY_COLORS: Record<PriorityLevel, string> = {
  'CRITICAL': '#EF4444',
  'HIGH': '#F97316',
  'MEDIUM': '#EAB308',
  'LOW': '#6B7280',
}

// PM Work Orders

export type PmType = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Semi-Annual' | 'Annual'

export type WorkOrderStatus = 'Not Started' | 'In Progress' | 'Complete'

export interface WorkOrder {
  id: string
  equipmentId: number
  pmType: PmType
  tasks: string
  status: WorkOrderStatus
  dueDate: string | null
  completedDate: string | null
  assignedTo: string | null
  completionNotes: string
  linearIssueId: string | null
  gmailDraftId: string | null
  createdAt: string
}

/**
 * Returns true if the equipment requires machine guarding per Cal/OSHA.
 * Checks for T8 CCR 3556-3558 (general machine guarding) and
 * T8 CCR 3577-3583 (abrasive wheel guarding).
 */
export function requiresMachineGuarding(item: EquipmentItem): boolean {
  return item.calOshaSections.includes('3556') || item.calOshaSections.includes('3577')
}

export const PM_TYPE_COLORS: Record<PmType, string> = {
  'Daily': '#22C55E',
  'Weekly': '#3B82F6',
  'Monthly': '#8B5CF6',
  'Quarterly': '#F97316',
  'Semi-Annual': '#EAB308',
  'Annual': '#EF4444',
}

export const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  'Not Started': '#6B7280',
  'In Progress': '#3B82F6',
  'Complete': '#22C55E',
}

export const EQUIPMENT_STATUS_COLORS: Record<EquipmentStatus, string> = {
  'Active': '#22C55E',
  'Out of Service': '#EF4444',
  'Retired': '#6B7280',
  'Pending Repair': '#F97316',
}

// ── Pre-Trip Inspections ────────────────────────────────

export type ChecklistType = 'electric-forklift' | 'scissor-lift' | 'walkie-pallet-jack' | 'manual-pallet-jack'

export type Shift = 'Day' | 'Swing' | 'Night'

export type InspectionResult = 'pass' | 'fail' | 'na'

export type NaReasonCode =
  | 'not-installed'
  | 'cannot-access'
  | 'maintenance-in-progress'
  | 'other'

export const NA_REASON_LABELS: Record<NaReasonCode, string> = {
  'not-installed': 'Not installed on this unit',
  'cannot-access': 'Cannot access for inspection',
  'maintenance-in-progress': 'Maintenance in progress',
  'other': 'Other (specify below)',
}

export interface InspectionItemResult {
  id: string
  label: string
  category: string
  critical: boolean
  result: InspectionResult | null
  notes: string
  photo: string | null
  naReasonCode?: NaReasonCode | null
  naJustification?: string
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
  criticalNaCount: number
  workOrderId: string | null
  createdAt: string
  syncStatus: InspectionSyncStatus
  notionPageId: string | null
  /** Operator signed on with a touch signature (image lives in IndexedDB,
   *  keyed `${id}:__signature__` — records stay lean like photos). Optional
   *  for records created before signatures existed. */
  hasSignature?: boolean
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
