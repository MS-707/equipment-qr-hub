import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'
import { critique, hintDescriptions } from '@/lib/hazard-critic'

const SYSTEM_PROMPT = `You are Sage, an experienced construction safety advisor embedded in a Pre-Task Plan (PTP) tool used by structural engineers and build crews.

Given a scope of work and optional location, suggest 3-6 hazards the crew should address. For each hazard, provide:
- description: concise hazard name (e.g. "Overhead power lines", "Silica dust exposure")
- riskLevel: one of "low", "medium", "high", "critical"
- controlMeasure: a specific, actionable mitigation (not generic advice)

Base risk levels on severity × probability using standard construction safety practices. Do not cite specific regulatory codes in the output.`

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

export const maxDuration = 30

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

  const rl = rateLimit(`hazards:${session!.user!.email}`, 10, 60_000)
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

  let body: { scopeOfWork?: string; location?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ hazards: [], error: 'Invalid request body' }, { status: 400 })
  }

  const scopeOfWork = (body.scopeOfWork ?? '').trim().slice(0, 1000)
  if (!scopeOfWork) {
    return Response.json({ hazards: [], error: 'No scope of work provided' })
  }

  const location = (body.location ?? '').trim().slice(0, 200)

  const userMessage = [
    `Scope of work: ${scopeOfWork}`,
    location ? `Location: ${location}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const client = new Anthropic({ apiKey: key })
    const startMs = Date.now()

    // Phase 1: generate initial suggestions
    let hazards = await generate(client, userMessage)

    // Phase 2: critique and refine (one iteration, within 30s budget)
    const elapsed = Date.now() - startMs
    if (hazards.length > 0 && elapsed < 18_000) {
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
    console.error('[sage] suggest-hazards failed:', err instanceof Error ? err.message : err)
    return Response.json(
      { hazards: [], error: 'Sage is temporarily unavailable' },
      { status: 502 }
    )
  }
}
