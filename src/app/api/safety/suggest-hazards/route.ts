import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'
import { critique, hintDescriptions } from '@/lib/hazard-critic'
import { SuggestHazardsBodySchema } from '@/lib/suggest-schemas'
import { ANTHROPIC_TIMEOUT_MS } from '@/lib/fetch-timeout'
import { reportServerError } from '@/lib/report-error'

const SYSTEM_PROMPT = `You are Sage, an experienced EHS safety advisor embedded in a Pre-Task Plan (PTP) tool used by engineers and operations teams.

Given a scope of work and optional location, suggest 3-6 hazards the team should address. For each hazard, provide:
- description: concise hazard name (e.g. "Overhead power lines", "Silica dust exposure")
- riskLevel: one of "low", "medium", "high", "critical"
- controlMeasure: a specific, actionable mitigation (not generic advice)

RISK MATRIX (per EHS-MGT-001, 5×5 Severity × Likelihood):
  Severity: 1 Negligible (first aid only), 2 Minor (medical treatment, no permanent effects), 3 Moderate (lost-time injury, OSHA recordable), 4 Major (hospitalization, permanent disability), 5 Catastrophic (fatality or multiple severe injuries)
  Likelihood: 1 Rare (exceptional circumstances only), 2 Unlikely (not expected, controls would need to fail), 3 Possible (has occurred in similar operations), 4 Likely (will probably occur, current controls insufficient), 5 Almost Certain (expected to occur, controls absent or ineffective)
  Score = Severity × Likelihood → Low (1-4), Medium (5-9), High (10-16), Critical (20-25)

Rate risk BEFORE controls are applied. Do not cite specific regulatory codes in the output.`

const HazardsSchema = z.object({
  hazards: z.array(
    z.object({
      description: z.string(),
      riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
      controlMeasure: z.string(),
    })
  ),
})

type Hazard = z.infer<typeof HazardsSchema>['hazards'][number]

export const maxDuration = 60

async function generate(
  client: Anthropic,
  userMessage: string,
  hints: string[] = []
): Promise<Hazard[]> {
  const refinementNote = hints.length > 0
    ? `\n\nAlso consider these additional hazard categories that may apply: ${hints.join(', ')}. Only add them if genuinely relevant to the scope.`
    : ''

  const message = await client.messages.parse({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT + refinementNote,
    messages: [{ role: 'user', content: userMessage }],
    output_config: { format: zodOutputFormat(HazardsSchema) },
  })

  return message.parsed_output?.hazards ?? []
}

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_AI_ASSIST !== '1') {
    return Response.json({ hazards: [], error: 'AI assist is not enabled' }, { status: 404 })
  }

  const { session, error } = await requireSession()
  if (error) return error

  const rl = await rateLimit(`hazards:${session?.user?.email || 'unknown'}`, 10, 60_000)
  if (!rl.ok) {
    return Response.json({ hazards: [], error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return Response.json(
      { hazards: [], error: 'AI assistant not configured' },
      { status: 503 }
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch (err) {
    reportServerError('api/safety/suggest-hazards', err)
    return Response.json({ hazards: [], error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = SuggestHazardsBodySchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ hazards: [], error: 'Invalid request body' }, { status: 400 })
  }
  const { scopeOfWork, location, followUp, existingHazards } = parsed.data

  if (!scopeOfWork) {
    return Response.json({ hazards: [], error: 'No scope of work provided' }, { status: 400 })
  }

  const userMessage = [
    `Scope of work: ${scopeOfWork}`,
    location ? `Location: ${location}` : null,
    followUp && existingHazards.length > 0
      ? `\n\nThe following hazards are already identified — do NOT repeat them. Instead, focus on gaps and hazards not yet covered:\n${existingHazards.map((h) => `- ${h}`).join('\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const client = new Anthropic({ apiKey: key, timeout: ANTHROPIC_TIMEOUT_MS })
    const startMs = Date.now()

    // Phase 1: generate initial suggestions
    let hazards = await generate(client, userMessage)

    // Phase 2: critique and refine (one iteration, only if time permits)
    const elapsed = Date.now() - startMs
    if (hazards.length > 0 && elapsed < 10_000) {
      const { hints } = critique(hazards)
      if (hints.length > 0) {
        const descriptions = hintDescriptions(hints)
        if (descriptions.length > 0) {
          hazards = await generate(client, userMessage, descriptions)
        }
      }
    }

    return Response.json({ hazards: hazards.slice(0, 8) })
  } catch (err) {
    reportServerError('api/safety/suggest-hazards', err)
    return Response.json(
      { hazards: [], error: 'Sage is temporarily unavailable' },
      { status: 502 }
    )
  }
}
