/**
 * Request schemas for the Sage document-analysis routes:
 *   POST /api/safety/parse-document
 *   POST /api/safety/check-permits
 *
 * Lives outside the route files so tests can validate payload shapes
 * directly (route files can only export handlers). Both routes forward
 * user text into Claude prompts, so every string field is capped here —
 * except documentBase64, whose oversized-upload path must keep returning
 * the route's dedicated 413 (a schema .max would turn it into a 400).
 */

import { z } from 'zod'

export const ParseDocumentBodySchema = z.object({
  // The route only forwards the first 50k chars to the model today
  documentText: z.string().max(50_000).optional(),
  // Deliberately uncapped: the route's own size guard answers oversized
  // uploads with 413 "PDF too large" (>4.2M base64 chars ≈ 3MB PDF)
  documentBase64: z.string().optional(),
  // Interpolated into the prompt; matches the route's previous 200-char cap
  fileName: z.string().max(200).optional(),
})

export type ParseDocumentBody = z.infer<typeof ParseDocumentBodySchema>

export const CheckPermitsBodySchema = z.object({
  // Presence is enforced by the route (400 "No scope of work provided"),
  // so the field stays optional here; cap matches the previous slice(0, 1000)
  scopeOfWork: z.string().max(1000).optional(),
  location: z.string().max(200).optional(),
  // Each hazard line is interpolated into the prompt; 200-char cap per entry
  hazards: z.array(z.string().max(200)).optional(),
})

export type CheckPermitsBody = z.infer<typeof CheckPermitsBodySchema>
