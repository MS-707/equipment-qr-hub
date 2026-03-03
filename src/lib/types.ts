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
