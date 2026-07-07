/**
 * Request schemas for the safety-record API routes:
 *   POST /api/safety/sync           (body = a SafetyRecord)
 *   POST /api/safety/review/submit  (body = { record, notionPageId })
 *
 * Lives outside the route files so both routes share one definition and tests
 * can validate real payloads against it (route files can only export
 * handlers). The schemas deliberately validate ONLY the fields the routes
 * read for control flow (id / type / createdAt / notionPageId) and pass every
 * other key through untouched (z.looseObject) — the full record is
 * snapshotted verbatim into Notion code blocks, so stripping unknown keys
 * would silently truncate the audit trail. Free-text fields (projectName,
 * location, createdBy, ...) are capped downstream by the routes' safeStr /
 * sanitize helpers, not here, matching pre-zod behavior.
 */

import { z } from 'zod'

/**
 * Record types with a Notion DB mapping. Must track SafetyRecordType in
 * lib/safety-types.ts and the DB_MAP tables in both routes.
 */
export const SAFETY_RECORD_TYPES = [
  'ptp',
  'jha',
  'incident-report',
  'height-permit',
  'hot-work-permit',
  'confined-space-permit',
] as const

/** Canonical Notion page id: 32 hex chars, dashed or undashed. */
export const NOTION_PAGE_ID_RE =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

export const SafetyRecordSchema = z.looseObject({
  // Client-generated ids like "PTP-2026-0001"; 100 mirrors the historical cap
  id: z.string().min(1).max(100),
  type: z.enum(SAFETY_RECORD_TYPES),
  // ISO-8601 timestamp: 30 chars fits any valid form, and it must parse
  createdAt: z
    .string()
    .max(30)
    .refine((s) => !isNaN(new Date(s).getTime())),
})

/**
 * Body of POST /api/safety/review/submit. Clients send notionPageId as
 * string | null; '' / null / absent all mean "no Notion page yet" (the route
 * then dedups/creates one itself).
 */
export const ReviewSubmitBodySchema = z.looseObject({
  record: SafetyRecordSchema,
  notionPageId: z
    .union([z.string().regex(NOTION_PAGE_ID_RE), z.literal(''), z.null()])
    .optional(),
})

export type ParsedSafetyRecord = z.infer<typeof SafetyRecordSchema>
export type ReviewSubmitBody = z.infer<typeof ReviewSubmitBodySchema>

/**
 * Picks which field a failed parse should report, in the order the routes
 * historically checked by hand: id → type → createdAt → notionPageId. A
 * non-object body (or missing/non-object `record`) reports as 'id', matching
 * the old `!record?.id` short-circuit. Each route maps the field to its own
 * pinned error string.
 */
export function firstInvalidField(
  error: z.ZodError
): 'id' | 'type' | 'createdAt' | 'notionPageId' {
  const fields = new Set(
    error.issues.map((i) => String(i.path[i.path.length - 1] ?? ''))
  )
  if (fields.has('id')) return 'id'
  if (fields.has('type')) return 'type'
  if (fields.has('createdAt')) return 'createdAt'
  if (fields.has('notionPageId')) return 'notionPageId'
  return 'id'
}
