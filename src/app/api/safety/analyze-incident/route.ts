import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'
import { IncidentRequestSchema } from '@/lib/analyze-schemas'
import { ANTHROPIC_TIMEOUT_MS } from '@/lib/fetch-timeout'

const SYSTEM_PROMPT = `You are Sage, an experienced construction safety incident analyst embedded in an EHS incident reporting tool.

Given an incident description and context, perform a root cause analysis using the 5-Why methodology and the Hierarchy of Controls framework.

CRITICAL INSTRUCTION: Look past "human error" to systemic causes. When a worker made a mistake, ask WHY the system allowed that mistake to happen. Common systemic causes include:
- Missing or inadequate machine guarding
- Lack of lockout/tagout procedures
- Insufficient training or competency verification
- Absent or unclear standard operating procedures
- Management system gaps (inspections, audits, maintenance schedules)
- Inadequate engineering controls
- Poor hazard communication
- Missing pre-task planning

For each root cause, provide a why-chain (minimum 3 levels deep) that traces from the immediate event to the systemic failure.

For corrective actions, use the Hierarchy of Controls (most effective first):
1. Elimination — remove the hazard entirely
2. Substitution — replace with something less hazardous
3. Engineering — isolate people from the hazard (guarding, ventilation, barriers)
4. Administrative — change the way people work (procedures, training, signage)
5. PPE — protect the worker (last resort)

Prioritize higher-level controls. Every incident should have at least one engineering or administrative control recommendation.`

const AnalysisSchema = z.object({
  rootCauses: z.array(z.object({
    cause: z.string(),
    category: z.enum(['equipment', 'process', 'training', 'environment', 'management']),
    whyChain: z.array(z.string()),
  })),
  correctiveActions: z.array(z.object({
    action: z.string(),
    controlLevel: z.enum(['elimination', 'substitution', 'engineering', 'administrative', 'ppe']),
    priority: z.enum(['immediate', 'short-term', 'long-term']),
  })),
})

export const maxDuration = 60

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_AI_ASSIST !== '1') {
    return Response.json({ rootCauses: [], correctiveActions: [], error: 'AI assist is not enabled' }, { status: 404 })
  }

  const { session, error } = await requireSession()
  if (error) return error

  const rl = await rateLimit(`incident-analysis:${session?.user?.email || 'unknown'}`, 5, 60_000)
  if (!rl.ok) {
    return Response.json({ rootCauses: [], correctiveActions: [], error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return Response.json(
      { rootCauses: [], correctiveActions: [], error: 'AI assistant not configured' },
      { status: 503 }
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json({ rootCauses: [], correctiveActions: [], error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = IncidentRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ rootCauses: [], correctiveActions: [], error: 'Invalid request body' }, { status: 400 })
  }
  const body = parsed.data

  const description = body.description ?? ''
  if (!description) {
    return Response.json({ rootCauses: [], correctiveActions: [], error: 'No description provided' }, { status: 400 })
  }

  const incidentType = body.incidentType ?? ''
  const severity = body.severity ?? ''
  const bodyPartAffected = body.bodyPartAffected ?? ''
  const immediateActions = body.immediateActions ?? ''
  const location = body.location ?? ''

  const userMessage = [
    `Incident type: ${incidentType || 'not specified'}`,
    `Severity: ${severity || 'not specified'}`,
    location ? `Location: ${location}` : null,
    bodyPartAffected ? `Body part affected: ${bodyPartAffected}` : null,
    `\nIncident description:\n${description}`,
    immediateActions ? `\nImmediate actions taken:\n${immediateActions}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const client = new Anthropic({ apiKey: key, timeout: ANTHROPIC_TIMEOUT_MS })

    const message = await client.messages.parse({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      output_config: { format: zodOutputFormat(AnalysisSchema) },
    })

    const result = message.parsed_output ?? { rootCauses: [], correctiveActions: [] }
    return Response.json(result)
  } catch (err) {
    console.error('[sage] analyze-incident failed:', err instanceof Error ? err.message : err)
    return Response.json(
      { rootCauses: [], correctiveActions: [], error: 'Sage is temporarily unavailable' },
      { status: 502 }
    )
  }
}
