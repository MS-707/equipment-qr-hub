/**
 * Request schemas for the Sage suggestion endpoints:
 *   POST /api/safety/suggest-jha
 *   POST /api/safety/suggest-hazards
 *   POST /api/safety/suggest-toolbox
 *
 * Lives outside the route files so tests can validate real client
 * payloads against them (route files can only export handlers).
 * Every field is optional-with-default because the clients build these
 * bodies incrementally; the routes enforce which fields are actually
 * required (e.g. a non-empty scope of work) so the pinned per-field
 * error messages are preserved. Unknown keys are ignored, matching the
 * previous manual field-picking behavior.
 */

import { z } from 'zod'

export const SuggestJhaBodySchema = z.object({
  // JHA form caps the job title input at 200 chars
  jobTitle: z.string().trim().max(200).default(''),
  // Per-step textarea caps at 300 chars. The array itself is NOT capped
  // here: the route accepts oversized arrays and bounds them to 15 steps
  // (pinned by the "truncates steps to 15 max" route test).
  steps: z.array(z.string().trim().max(300)).default([]),
})

export type SuggestJhaBody = z.infer<typeof SuggestJhaBodySchema>

export const SuggestHazardsBodySchema = z.object({
  // PTP scope-of-work textarea caps at 1000 chars
  scopeOfWork: z.string().trim().max(1000).default(''),
  location: z.string().trim().max(200).default(''),
  followUp: z.boolean().default(false),
  // Follow-up requests replay already-identified hazard descriptions
  existingHazards: z.array(z.string().max(200)).max(50).default([]),
})

export type SuggestHazardsBody = z.infer<typeof SuggestHazardsBodySchema>

export const SuggestToolboxBodySchema = z.object({
  // Same scope-of-work source as suggest-hazards
  scopeOfWork: z.string().trim().max(1000).default(''),
  location: z.string().trim().max(200).default(''),
  // Hazard descriptions carried over from the PTP form
  hazards: z.array(z.string().max(200)).max(20).default([]),
  weather: z.string().trim().max(200).default(''),
})

export type SuggestToolboxBody = z.infer<typeof SuggestToolboxBodySchema>
