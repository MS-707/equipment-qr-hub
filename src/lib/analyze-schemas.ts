/**
 * Request schemas for the Sage analyzer routes (BE-8):
 *   POST /api/safety/analyze-atmosphere
 *   POST /api/safety/analyze-incident
 *   POST /api/safety/audit-ptp
 *
 * Live outside the route files so tests can validate payloads directly
 * (route files can only export handlers) and so the input caps stay
 * reviewable in one place. String caps mirror the .slice() truncation
 * limits the routes enforced before zod validation — oversized input is
 * now rejected with a 400 instead of silently truncated. Unknown keys are
 * ignored (zod object default), matching the old manual field-picking.
 */

import { z } from 'zod'

// ── POST /api/safety/analyze-atmosphere ──────────────────────

export const AtmoReadingsSchema = z.object({
  oxygen: z.number().nullable().optional(),
  lel: z.number().nullable().optional(),
  co: z.number().nullable().optional(),
  h2s: z.number().nullable().optional(),
})

export const AtmoRequestSchema = z.object({
  // .nullish() (not required) so a missing/null readings object reaches the
  // route's dedicated 'No readings provided' 400 instead of a generic error.
  readings: AtmoReadingsSchema.nullish(),
  // Route previously did .trim().slice(0, 2000)
  spaceDescription: z.string().trim().max(2000).optional(),
  // Route previously did String(h).slice(0, 200) per entry
  hazards: z.array(z.string().max(200)).optional(),
})

export type AtmoRequest = z.infer<typeof AtmoRequestSchema>

// ── POST /api/safety/analyze-incident ────────────────────────

export const IncidentRequestSchema = z.object({
  // .optional() (not nonempty) so a missing/empty description reaches the
  // route's dedicated 'No description provided' 400. Caps match the old
  // .trim().slice(0, N) truncation limits.
  description: z.string().trim().max(5000).optional(),
  incidentType: z.string().trim().max(100).optional(),
  severity: z.string().trim().max(50).optional(),
  bodyPartAffected: z.string().trim().max(200).optional(),
  immediateActions: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(200).optional(),
})

export type IncidentRequest = z.infer<typeof IncidentRequestSchema>

// ── POST /api/safety/audit-ptp ───────────────────────────────

/**
 * Loose mirror of PreTaskPlan (lib/safety-types.ts) covering only the fields
 * the audit prompt reads. Everything except the 'ptp' discriminator is
 * optional because the route has always tolerated partial records (it reads
 * every field with `?.` / `??` fallbacks — older records may lack newer
 * fields). Enum-ish fields (shift, riskLevel) stay plain strings for the
 * same tolerance reason; they are only interpolated into the prompt.
 * The route had no truncation here, so caps are generous prompt-size bounds.
 */
export const PtpRecordSchema = z.object({
  type: z.literal('ptp'),
  date: z.string().max(50).optional(),
  shift: z.string().max(50).optional(),
  projectName: z.string().max(200).optional(),
  location: z.string().max(500).optional(),
  scopeOfWork: z.string().max(5000).optional(),
  hazards: z
    .array(
      z.object({
        description: z.string().max(2000).optional(),
        riskLevel: z.string().max(50).optional(),
        controlMeasure: z.string().max(2000).optional(),
      }),
    )
    .optional(),
  ppeRequired: z.array(z.string().max(200)).optional(),
  emergencyMusterPoint: z.string().max(500).optional(),
  nearestHospital: z.string().max(500).optional(),
  firstAidEyewashLocation: z.string().max(500).optional(),
  weatherNotes: z.string().max(2000).optional(),
  windSpeed: z.string().max(100).optional(),
  heatIllnessPlan: z
    .object({
      water: z.boolean().optional(),
      shade: z.boolean().optional(),
      restBreaks: z.boolean().optional(),
      highHeatProcedures: z.boolean().optional(),
    })
    .optional(),
  toolboxTalkTopic: z.string().max(500).optional(),
  // Only the count is used in the prompt — element shape is irrelevant.
  crewSignatures: z.array(z.unknown()).optional(),
  supervisorSignatureId: z.string().max(200).nullable().optional(),
})

export const AuditPtpRequestSchema = z.object({
  ptp: PtpRecordSchema,
})

export type AuditPtpRequest = z.infer<typeof AuditPtpRequestSchema>
