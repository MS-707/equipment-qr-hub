import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'

const SYSTEM_PROMPT = `You are Sage, a construction safety advisor. Given a scope of work and identified hazards, determine if any work permits are required. Only flag permits that are genuinely needed — do not over-flag.`

const PermitGapSchema = z.object({
  missing_permits: z.array(z.object({
    permit_type: z.enum(['height-permit', 'hot-work-permit', 'confined-space-permit']),
    reason: z.string(),
    urgency: z.enum(['required', 'recommended']),
  }))
})

export const maxDuration = 30

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_AI_ASSIST !== '1') {
    return Response.json({ missing_permits: [], error: 'AI assist is not enabled' }, { status: 404 })
  }

  const { session, error } = await requireSession()
  if (error) return error

  const rl = rateLimit(`permits:${session!.user!.email}`, 10, 60_000)
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

  let body: { scopeOfWork?: string; location?: string; hazards?: string[] }
  try {
    body = await req.json()
  } catch {
    return Response.json({ missing_permits: [], error: 'Invalid request body' }, { status: 400 })
  }

  const scopeOfWork = (body.scopeOfWork ?? '').trim().slice(0, 1000)
  if (!scopeOfWork) {
    return Response.json({ missing_permits: [], error: 'No scope of work provided' })
  }

  const location = (body.location ?? '').trim().slice(0, 200)
  const hazards = Array.isArray(body.hazards) ? body.hazards.map((h) => String(h).slice(0, 200)) : []

  const userMessage = [
    `Scope of work: ${scopeOfWork}`,
    location ? `Location: ${location}` : null,
    hazards.length > 0 ? `Identified hazards:\n${hazards.map((h) => `- ${h}`).join('\n')}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')

  try {
    const client = new Anthropic({ apiKey: key })

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
    console.error('[sage] check-permits failed:', err instanceof Error ? err.message : err)
    return Response.json(
      { missing_permits: [], error: 'Sage is temporarily unavailable' },
      { status: 502 }
    )
  }
}
