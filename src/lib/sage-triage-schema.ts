/**
 * Request schema for POST /api/sage/triage.
 *
 * Lives outside the route file so tests can validate real
 * SageTriage-shaped payloads against it (route files can only
 * export handlers). Caps mirror what the client sends from
 * components/SageTriage.tsx and the route's prompt budget.
 */

import { z } from 'zod'

export const SageHistoryMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  // Prompt budget per history turn; assistant turns are further
  // truncated to 1000 chars in the route before prompting.
  content: z.string().max(2000),
})

export const SageTriageBodySchema = z.object({
  // Emptiness and the 500-char cap are enforced in the route AFTER
  // trimming, so the pinned 'Message required (max 500 chars)' error
  // string and trim semantics stay exactly as before.
  message: z.string().default(''),
  // buildSageContext page context (current page, PTP, permits).
  context: z.string().max(2000).optional(),
  // Client sends at most the last 10 chat turns (SageTriage.tsx
  // slices with .slice(-10) before the fetch).
  history: z.array(SageHistoryMessageSchema).max(10).optional(),
  localHour: z.number().optional(),
})

export type SageTriageBody = z.infer<typeof SageTriageBodySchema>
export type SageHistoryMessage = z.infer<typeof SageHistoryMessageSchema>
