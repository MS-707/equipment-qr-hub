/**
 * Request schema for POST /api/inspections/notify.
 *
 * Lives outside the route file so tests can validate real
 * submitInspection-shaped payloads against it (route files can only
 * export handlers). Field types MUST track InspectionRecord in
 * lib/types.ts — a mismatch here silently drops EHS emails, because the
 * client fires the request without blocking on the response.
 */

import { z } from 'zod'

export const InspectionItemSchema = z.object({
  id: z.string().max(100),
  label: z.string().max(200),
  result: z.enum(['pass', 'fail', 'na']),
  critical: z.boolean().optional(),
  // Client textarea allows 2000 chars (PreTripInspection maxLength)
  notes: z.string().max(2000).optional(),
  naReasonCode: z.string().max(50).nullable().optional(),
  naJustification: z.string().max(2000).optional(),
})

export const NotifyBodySchema = z.object({
  record: z.object({
    id: z.string().max(100),
    // InspectionRecord.equipmentId is a number (equipment.itemNumber)
    equipmentId: z.number(),
    inspectorName: z.string().max(200),
    shift: z.string().max(50),
    hourMeterReading: z.number().nullable().optional(),
    createdAt: z.string().max(50),
    result: z.enum(['pass', 'fail']),
    hasCriticalFail: z.boolean(),
    criticalNaCount: z.number().optional(),
    // null for every passing inspection — .optional() alone rejects null
    workOrderId: z.string().max(100).nullable().optional(),
    items: z.array(InspectionItemSchema).max(200),
  }),
  equipmentName: z.string().max(200).optional(),
  equipmentCategory: z.string().max(200).optional(),
})

export type NotifyBody = z.infer<typeof NotifyBodySchema>
