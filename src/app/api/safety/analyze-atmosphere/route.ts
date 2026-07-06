import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'
import { AtmoRequestSchema } from '@/lib/analyze-schemas'
import { ANTHROPIC_TIMEOUT_MS } from '@/lib/fetch-timeout'
import { reportServerError } from '@/lib/report-error'

const SYSTEM_PROMPT = `You are an expert confined space atmospheric analyst for a construction safety platform called Sage EHS.

Given gas meter readings and the context of the confined space, provide a nuanced atmospheric analysis. Focus on:
- Cross-gas interactions (e.g. low O2 + elevated H2S suggests displacement, LEL + enriched O2 = extreme explosion risk)
- Context-specific risks based on the space description and identified hazards
- Actionable guidance that goes beyond what a simple threshold check provides
- Whether the combination of readings tells a different story than each reading individually

Be direct, authoritative, and safety-first. If readings are dangerous, say so clearly. Do not hedge on safety-critical judgments.`

const AtmoAlertSchema = z.object({
  gas: z.string(),
  reading: z.number(),
  threshold: z.string(),
  severity: z.enum(['safe', 'warning', 'danger', 'idlh']),
  guidance: z.string(),
})

const AtmoAnalysisSchema = z.object({
  safe: z.boolean(),
  alerts: z.array(AtmoAlertSchema),
  recommendations: z.array(z.string()),
})

export const maxDuration = 60

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_AI_ASSIST !== '1') {
    return Response.json({ error: 'AI assist is not enabled' }, { status: 404 })
  }

  const { session, error } = await requireSession()
  if (error) return error

  const rl = await rateLimit(`atmo-analyze:${session?.user?.email || 'unknown'}`, 5, 60_000)
  if (!rl.ok) {
    return Response.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    )
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return Response.json({ error: 'AI assistant not configured' }, { status: 503 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch (err) {
    reportServerError('api/safety/analyze-atmosphere', err)
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = AtmoRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const body = parsed.data

  const readings = body.readings
  if (!readings) {
    return Response.json({ error: 'No readings provided' }, { status: 400 })
  }

  const spaceDescription = body.spaceDescription ?? ''
  const hazards = body.hazards ?? []

  const lines = [
    'Atmospheric readings:',
    readings.oxygen != null ? `  O2: ${readings.oxygen}%` : '  O2: not measured',
    readings.lel != null ? `  LEL: ${readings.lel}%` : '  LEL: not measured',
    readings.co != null ? `  CO: ${readings.co} ppm` : '  CO: not measured',
    readings.h2s != null ? `  H2S: ${readings.h2s} ppm` : '  H2S: not measured',
  ]
  if (spaceDescription) lines.push(`\nSpace: ${spaceDescription}`)
  if (hazards.length > 0) lines.push(`\nIdentified hazards: ${hazards.join(', ')}`)

  try {
    const client = new Anthropic({ apiKey: key, timeout: ANTHROPIC_TIMEOUT_MS })
    const message = await client.messages.parse({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: lines.join('\n') }],
      output_config: { format: zodOutputFormat(AtmoAnalysisSchema) },
    })

    const analysis = message.parsed_output
    if (!analysis) {
      return Response.json({ error: 'Failed to parse analysis' }, { status: 502 })
    }

    return Response.json({ analysis })
  } catch (err) {
    reportServerError('api/safety/analyze-atmosphere', err)
    console.error('[sage] analyze-atmosphere failed:', err instanceof Error ? err.message : err)
    return Response.json({ error: 'Sage is temporarily unavailable' }, { status: 502 })
  }
}
