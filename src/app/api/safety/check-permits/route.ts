import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { requireSession } from '@/lib/api-auth'
import { CheckPermitsBodySchema } from '@/lib/doc-analysis-schemas'
import { rateLimit } from '@/lib/rate-limit'
import { ANTHROPIC_TIMEOUT_MS } from '@/lib/fetch-timeout'
import { reportServerError } from '@/lib/report-error'

const SYSTEM_PROMPT = `You are Sage, an EHS safety advisor. Given a scope of work and identified hazards, determine if any work permits are required. Only flag permits that are genuinely needed — do not over-flag.`

const PermitGapSchema = z.object({
  missing_permits: z.array(z.object({
    permit_type: z.enum(['height-permit', 'hot-work-permit', 'confined-space-permit']),
    reason: z.string(),
    urgency: z.enum(['required', 'recommended']),
  }))
})

export const maxDuration = 60

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_AI_ASSIST !== '1') {
    return Response.json({ missing_permits: [], error: 'AI assist is not enabled' }, { status: 404 })
  }

  const { session, error } = await requireSession()
  if (error) return error

  const rl = await rateLimit(`permits:${session?.user?.email || 'unknown'}`, 10, 60_000)
  if (!rl.ok) {
    return Response.json(
      { missing_permits: [], error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return Response.json(
      { missing_permits: [], error: 'AI assistant not configured' },
      { status: 503 }
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch (err) {
    reportServerError('api/safety/check-permits', err)
    return Response.json({ missing_permits: [], error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = CheckPermitsBodySchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ missing_permits: [], error: 'Invalid request body' }, { status: 400 })
  }
  const body = parsed.data

  const scopeOfWork = (body.scopeOfWork ?? '').trim()
  if (!scopeOfWork) {
    return Response.json({ missing_permits: [], error: 'No scope of work provided' }, { status: 400 })
  }

  const location = (body.location ?? '').trim()
  const hazards = body.hazards ?? []

  const userMessage = [
    `Scope of work: ${scopeOfWork}`,
    location ? `Location: ${location}` : null,
    hazards.length > 0 ? `Identified hazards:\n${hazards.map((h) => `- ${h}`).join('\n')}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')

  try {
    const client = new Anthropic({ apiKey: key, timeout: ANTHROPIC_TIMEOUT_MS })

    const message = await client.messages.parse({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      output_config: { format: zodOutputFormat(PermitGapSchema) },
    })

    const missing_permits = message.parsed_output?.missing_permits ?? []
    return Response.json({ missing_permits })
  } catch (err) {
    reportServerError('api/safety/check-permits', err)
    console.error('[sage] check-permits failed:', err instanceof Error ? err.message : err)
    return Response.json(
      { missing_permits: [], error: 'Sage is temporarily unavailable' },
      { status: 502 }
    )
  }
}
