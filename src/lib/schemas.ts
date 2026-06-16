import { z } from 'zod'
import type { SafetyRecord } from '@/lib/safety-types'
import type { Identity } from '@/lib/identity'

const SafetyRecordTypeSchema = z.enum([
  'ptp',
  'jha',
  'height-permit',
  'hot-work-permit',
  'confined-space-permit',
  'incident-report',
])

const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical'])

const ReviewStatusSchema = z.enum(['submitted', 'approved', 'rejected', 'recalled'])

const PermitStatusSchema = z.enum(['active', 'closed', 'revoked'])

const InspectionSyncStatusSchema = z.enum(['pending', 'synced', 'failed', 'offline'])

const ShiftSchema = z.enum(['Day', 'Swing', 'Night'])

const CrewSignatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  role: z.string().nullable(),
  hasSignature: z.boolean(),
  signedAt: z.string(),
}).passthrough()

const AuditEventSchema = z.object({
  action: z.enum([
    'created', 'submitted', 'closed', 'revoked', 'synced', 'sync-failed', 'amended',
    'submitted-for-review', 'review-decided', 'review-recalled',
  ]),
  by: z.string(),
  byEmail: z.string().nullable(),
  at: z.string(),
  note: z.string().optional(),
}).passthrough()

const PermitCheckItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: z.string(),
  checked: z.boolean(),
  notes: z.string(),
  critical: z.boolean().optional(),
}).passthrough()

const SafetyRecordBaseSchema = z.object({
  id: z.string(),
  type: SafetyRecordTypeSchema,
  createdBy: z.string(),
  createdByEmail: z.string().nullable(),
  createdAt: z.string(),
  location: z.string(),
  projectName: z.string(),
  syncStatus: InspectionSyncStatusSchema,
  notionPageId: z.string().nullable(),
  events: z.array(AuditEventSchema),
  reviewStatus: ReviewStatusSchema.optional(),
  reviewerName: z.string().optional(),
  reviewerEmail: z.string().nullable().optional(),
  reviewNote: z.string().optional(),
  reviewDecidedAt: z.string().optional(),
})

const HazardEntrySchema = z.object({
  id: z.string(),
  description: z.string(),
  riskLevel: RiskLevelSchema,
  controlMeasure: z.string(),
  addedBy: z.string().nullable(),
  source: z.enum(['sage', 'manual']).optional(),
}).passthrough()

const HeatIllnessPlanSchema = z.object({
  water: z.boolean(),
  shade: z.boolean(),
  restBreaks: z.boolean(),
  highHeatProcedures: z.boolean(),
}).passthrough()

const PreTaskPlanSchema = SafetyRecordBaseSchema.extend({
  type: z.literal('ptp'),
  date: z.string(),
  validUntil: z.string().optional(),
  shift: ShiftSchema,
  scopeOfWork: z.string(),
  hazards: z.array(HazardEntrySchema),
  ppeRequired: z.array(z.string()),
  emergencyMusterPoint: z.string(),
  nearestHospital: z.string(),
  firstAidEyewashLocation: z.string(),
  weatherNotes: z.string(),
  windSpeed: z.string(),
  heatIllnessPlan: HeatIllnessPlanSchema,
  toolboxTalkTopic: z.string(),
  toolboxTalkNotes: z.string(),
  crewSignatures: z.array(CrewSignatureSchema),
  supervisorSignatureId: z.string().nullable(),
}).passthrough()

const JhaStepSchema = z.object({
  id: z.string(),
  taskActivity: z.string(),
  hazards: z.string(),
  riskLevel: RiskLevelSchema,
  controls: z.string(),
  residualRiskLevel: RiskLevelSchema.optional(),
  responsible: z.string(),
  source: z.enum(['sage', 'manual']).optional(),
  showDetail: z.boolean().optional(),
}).passthrough()

const JhaSchema = SafetyRecordBaseSchema.extend({
  type: z.literal('jha'),
  jobTitle: z.string(),
  dateOfAnalysis: z.string(),
  validUntil: z.string().optional(),
  department: z.string(),
  referenceDoc: z.string(),
  ppeRequired: z.array(z.string()),
  steps: z.array(JhaStepSchema),
  additionalNotes: z.string(),
  signatures: z.array(CrewSignatureSchema),
  preparedBySignatureId: z.string().nullable(),
}).passthrough()

const HeightPermitSchema = SafetyRecordBaseSchema.extend({
  type: z.literal('height-permit'),
  status: PermitStatusSchema,
  workDescription: z.string(),
  workingHeight: z.string(),
  accessMethod: z.array(z.string()),
  fallProtection: z.array(z.string()),
  anchorPoints: z.string(),
  rescuePlan: z.string(),
  checklist: z.array(PermitCheckItemSchema),
  validFrom: z.string(),
  validUntil: z.string(),
  workers: z.array(CrewSignatureSchema),
  issuerSignatureId: z.string().nullable(),
  closedAt: z.string().nullable(),
  closedBy: z.string().nullable(),
}).passthrough()

const HotWorkPermitSchema = SafetyRecordBaseSchema.extend({
  type: z.literal('hot-work-permit'),
  status: PermitStatusSchema,
  workDescription: z.string(),
  hotWorkTypes: z.array(z.string()),
  checklist: z.array(PermitCheckItemSchema),
  fireWatchRequired: z.boolean(),
  fireWatchName: z.string(),
  fireWatchPostDurationMin: z.number(),
  extinguisherLocation: z.string(),
  extinguisherType: z.string(),
  sprinklerStatus: z.string(),
  gasTestRequired: z.boolean(),
  gasTestNotes: z.string(),
  validFrom: z.string(),
  validUntil: z.string(),
  workers: z.array(CrewSignatureSchema),
  issuerSignatureId: z.string().nullable(),
  closedAt: z.string().nullable(),
  closedBy: z.string().nullable(),
}).passthrough()

const AtmosphericReadingSchema = z.object({
  oxygenPct: z.string(),
  lelPct: z.string(),
  coPpm: z.string(),
  h2sPpm: z.string(),
  testedBy: z.string(),
  testedAt: z.string(),
}).passthrough()

const ConfinedSpacePermitSchema = SafetyRecordBaseSchema.extend({
  type: z.literal('confined-space-permit'),
  status: PermitStatusSchema,
  spaceDescription: z.string(),
  hazards: z.array(z.string()),
  atmospheric: AtmosphericReadingSchema,
  continuousMonitoring: z.boolean(),
  ventilationInUse: z.boolean(),
  rescuePlan: z.string(),
  checklist: z.array(PermitCheckItemSchema),
  entrySupervisorSignatureId: z.string().nullable(),
  attendantName: z.string(),
  entrants: z.array(CrewSignatureSchema),
  validFrom: z.string(),
  validUntil: z.string(),
  closedAt: z.string().nullable(),
  closedBy: z.string().nullable(),
}).passthrough()

const IncidentTypeSchema = z.enum(['injury', 'near-miss', 'property-damage', 'environmental'])
const IncidentSeveritySchema = z.enum(['minor', 'moderate', 'serious', 'critical'])

const InjuredPersonSchema = z.object({
  name: z.string(),
  jobTitle: z.string(),
  employer: z.string(),
  bodyPartAffected: z.string(),
}).passthrough()

const IncidentReportSchema = SafetyRecordBaseSchema.extend({
  type: z.literal('incident-report'),
  incidentType: IncidentTypeSchema,
  severity: IncidentSeveritySchema,
  occurredAt: z.string(),
  description: z.string(),
  immediateActions: z.string(),
  witnesses: z.array(z.string()),
  rootCause: z.string(),
  correctiveActions: z.string(),
  reportedToCalOsha: z.boolean(),
  injuredPerson: InjuredPersonSchema.optional(),
  photoSlots: z.array(z.string()),
  reporterSignatureId: z.string().nullable(),
}).passthrough()

const SafetyRecordSchema = z.discriminatedUnion('type', [
  PreTaskPlanSchema,
  JhaSchema,
  HeightPermitSchema,
  HotWorkPermitSchema,
  ConfinedSpacePermitSchema,
  IncidentReportSchema,
])

export const IdentitySchema = z.object({
  name: z.string(),
  email: z.string().nullable(),
  image: z.string().nullable(),
  verifiedAt: z.string(),
}).passthrough()

export function safeParseSafetyRecords(raw: string): SafetyRecord[] {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const valid: SafetyRecord[] = []
    for (let i = 0; i < parsed.length; i++) {
      const result = SafetyRecordSchema.safeParse(parsed[i])
      if (result.success) {
        valid.push(result.data as SafetyRecord)
      } else {
        console.warn(
          `[safety-records] Dropped invalid record at index ${i}` +
          (parsed[i]?.id ? ` (id=${parsed[i].id})` : '') +
          ':',
          result.error.issues,
        )
      }
    }
    return valid
  } catch {
    return []
  }
}

export function safeParseIdentity(raw: string): Identity | null {
  try {
    const result = IdentitySchema.safeParse(JSON.parse(raw))
    return result.success ? (result.data as Identity) : null
  } catch {
    return null
  }
}
