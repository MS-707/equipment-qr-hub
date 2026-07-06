import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'
import { SuggestToolboxBodySchema } from '@/lib/suggest-schemas'
import { ANTHROPIC_TIMEOUT_MS } from '@/lib/fetch-timeout'
import { reportServerError } from '@/lib/report-error'

const SYSTEM_PROMPT = `You are Sage, an experienced EHS safety advisor. Generate a concise 2-minute toolbox talk for a team based on today's job scope, hazards, and conditions. The talk should be practical, plain-language, and ready to read aloud at a team meeting. Keep talking points to 3-4 bullet points. End with one discussion question to engage the team.`

const ToolboxTalkSchema = z.object({
  title: z.string(),
  talking_points: z.array(z.string()),
  discussion_question: z.string(),
})

export const maxDuration = 60

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_AI_ASSIST !== '1') {
    return Response.json({ error: 'AI assist is not enabled' }, { status: 404 })
  }

  const { session, error } = await requireSession()
  if (error) return error

  const rl = await rateLimit(`toolbox:${session?.user?.email || 'unknown'}`, 10, 60_000)
  if (!rl.ok) {
    return Response.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return Response.json(
      { error: 'AI assistant not configured' },
      { status: 503 }
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch (err) {
    reportServerError('api/safety/suggest-toolbox', err)
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = SuggestToolboxBodySchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { scopeOfWork, location, hazards, weather } = parsed.data

  if (!scopeOfWork) {
    return Response.json({ error: 'No scope of work provided' }, { status: 400 })
  }

  const userMessage = [
    `Scope of work: ${scopeOfWork}`,
    location ? `Location: ${location}` : null,
    hazards.length > 0 ? `Identified hazards: ${hazards.join(', ')}` : null,
    weather ? `Weather conditions: ${weather}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const client = new Anthropic({ apiKey: key, timeout: ANTHROPIC_TIMEOUT_MS })

    const message = await client.messages.parse({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      output_config: { format: zodOutputFormat(ToolboxTalkSchema) },
    })

    const result = message.parsed_output
    if (!result) {
      return Response.json({ error: 'Failed to generate toolbox talk' }, { status: 502 })
    }

    return Response.json({
      title: result.title,
      talking_points: result.talking_points,
      discussion_question: result.discussion_question,
    })
  } catch (err) {
    reportServerError('api/safety/suggest-toolbox', err)
    console.error('[sage] suggest-toolbox failed:', err instanceof Error ? err.message : err)
    return Response.json(
      { error: 'Sage is temporarily unavailable' },
      { status: 502 }
    )
  }
}
