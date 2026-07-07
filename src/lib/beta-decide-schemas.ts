/**
 * Request schemas for the beta-program and EHS-review decision routes:
 *
 *   POST /api/beta/signup          — BetaSignupBodySchema
 *   POST /api/beta/decide          — BetaDecideBodySchema
 *   POST /api/safety/review/decide — ReviewDecideBodySchema
 *
 * They live outside the route files so tests can validate real payloads
 * against them (route files can only export handlers). Error messages here
 * are pinned by the route tests — keep them in sync with
 * src/lib/__tests__/{beta-signup,beta-decide,review-decide}-route.test.ts.
 */

import { z } from 'zod'

/** Mirrors the route's original manual regex — not z.email(), which is stricter. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Optional string field: missing/null collapse to '' (the route previously
 * did `String(body.x ?? '')`), then whitespace is trimmed before the
 * required/length checks — so a name of '   ' still fails "required".
 */
const trimmedString = z
  .string()
  .nullish()
  .transform((v) => (v ?? '').trim())

export const BetaSignupBodySchema = z
  .object({
    name: trimmedString,
    email: trimmedString.transform((s) => s.toLowerCase()),
    company: trimmedString,
    role: trimmedString,
    crewSize: trimmedString,
    reason: trimmedString,
  })
  .superRefine((b, ctx) => {
    // Ordering matters: the route always reported "required" before the email
    // format error, and format before length — tests pin those messages.
    if (!b.name || !b.email || !b.company || !b.role) {
      ctx.addIssue({ code: 'custom', message: 'Name, email, company, and role are required' })
      return
    }
    if (!EMAIL_RE.test(b.email)) {
      ctx.addIssue({ code: 'custom', message: 'Invalid email address' })
      return
    }
    // Caps match the route's original manual limits (flow into email/Slack/KV).
    if (
      b.name.length > 100 || b.email.length > 200 || b.company.length > 200 ||
      b.role.length > 200 || b.crewSize.length > 200 || b.reason.length > 1000
    ) {
      ctx.addIssue({ code: 'custom', message: 'Input too long' })
    }
  })

export type BetaSignupBody = z.infer<typeof BetaSignupBodySchema>

export const BetaDecideBodySchema = z.object({
  // Ids are `beta-<epoch-ms>-<4 chars>` (~25 chars); 200 is a generous bound.
  id: z.string().min(1).max(200),
  status: z.enum(['approved', 'rejected']),
})

export type BetaDecideBody = z.infer<typeof BetaDecideBodySchema>

export const ReviewDecideBodySchema = z.object({
  // base64url(recordId:action:ts:hex-hmac) is ~150 chars for real tokens;
  // anything longer can never verify, so 2000 bounds hostile payloads.
  // Optional since EN-9: a signed-in ehs/admin session may decide with
  // recordId+action instead of an email-link token (route enforces that
  // exactly one of the two shapes is present).
  token: z.string().min(1).max(2000).optional(),
  recordId: z.string().min(1).max(100).optional(),
  action: z.enum(['approve', 'reject']).optional(),
  // The route always truncated (never rejected) long notes — a test pins that
  // a 600-char note is accepted and sliced to 500, so transform, not .max().
  // Non-string notes were silently ignored before; .catch(undefined) keeps that.
  note: z
    .string()
    .transform((s) => s.slice(0, 500))
    .optional()
    .catch(undefined),
})

export type ReviewDecideBody = z.infer<typeof ReviewDecideBodySchema>
