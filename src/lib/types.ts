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

export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface EquipmentItem {
  itemNumber: number
  name: string
  category: EquipmentCategory
  oemManual: string
  manualUrl: string
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
