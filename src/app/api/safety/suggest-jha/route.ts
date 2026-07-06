import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'
import { SuggestJhaBodySchema } from '@/lib/suggest-schemas'
import { ANTHROPIC_TIMEOUT_MS } from '@/lib/fetch-timeout'
import { reportServerError } from '@/lib/report-error'

const SYSTEM_PROMPT = `You are Sage, an experienced EHS safety advisor embedded in a Job Hazard Analysis (JHA) tool used by engineers and operations teams.

You are given a job title and an ordered list of task STEPS the worker has written. For EACH step, analyse the work and return:
- hazards: the hazard(s) the team should consider for that specific step, as a short newline-separated list (1-3 hazards). Be specific to the activity, not generic.
- riskLevel: one of "low", "medium", "high", "critical", rated BEFORE controls using a standard 5×5 risk matrix (severity × likelihood).
- controls: specific, actionable mitigations for those hazards (not generic advice).
- residualRiskLevel: the risk level AFTER the controls you specified are properly applied. This should typically be lower than riskLevel, unless the hazard cannot be effectively mitigated.

RISK MATRIX (per EHS-MGT-001, 5×5 Severity × Likelihood):
  Severity: 1 Negligible (first aid only), 2 Minor (medical treatment, no permanent effects), 3 Moderate (lost-time injury, OSHA recordable), 4 Major (hospitalization, permanent disability), 5 Catastrophic (fatality or multiple severe injuries)
  Likelihood: 1 Rare (exceptional circumstances only), 2 Unlikely (not expected, controls would need to fail), 3 Possible (has occurred in similar operations), 4 Likely (will probably occur, current controls insufficient), 5 Almost Certain (expected to occur, controls absent or ineffective)
  Score = Severity × Likelihood → low (1-4), medium (5-9), high (10-16), critical (20-25)

Return exactly one analysis object per input step, in the same order. Do not cite specific regulatory codes in the output. Base your analysis on standard construction and industrial safety practice.`

const StepAnalysisSchema = z.object({
  steps: z.array(
    z.object({
      hazards: z.string(),
      riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
      controls: z.string(),
      residualRiskLevel: z.enum(['low', 'medium', 'high', 'critical']),
    })
  ),
})

export const maxDuration = 60

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_AI_ASSIST !== '1') {
    return Response.json({ steps: [], error: 'AI assist is not enabled' }, { status: 404 })
  }

  const { session, error } = await requireSession()
  if (error) return error

  const rl = await rateLimit(`jha:${session?.user?.email || 'unknown'}`, 10, 60_000)
  if (!rl.ok) {
    return Response.json(
      { steps: [], error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return Response.json({ steps: [], error: 'AI assistant not configured' }, { status: 503 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch (err) {
    reportServerError('api/safety/suggest-jha', err)
    return Response.json({ steps: [], error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = SuggestJhaBodySchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ steps: [], error: 'Invalid request body' }, { status: 400 })
  }
  const { jobTitle } = parsed.data
  const steps = parsed.data.steps.filter(Boolean)

  if (steps.length === 0) {
    return Response.json({ steps: [], error: 'No task steps provided' }, { status: 400 })
  }
  // Keep the request bounded — a JHA rarely exceeds a dozen steps.
  const boundedSteps = steps.slice(0, 15)

  const userMessage = [
    jobTitle ? `Job / task: ${jobTitle}` : null,
    '',
    'Task steps:',
    ...boundedSteps.map((s, i) => `${i + 1}. ${s}`),
  ]
    .filter((l) => l !== null)
    .join('\n')

  try {
    const client = new Anthropic({ apiKey: key, timeout: ANTHROPIC_TIMEOUT_MS })
    const message = await client.messages.parse({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      output_config: { format: zodOutputFormat(StepAnalysisSchema) },
    })
    const analysed = message.parsed_output?.steps ?? []
    // Align to the number of steps we sent, so the client can map by index.
    return Response.json({ steps: analysed.slice(0, boundedSteps.length) })
  } catch (err) {
    reportServerError('api/safety/suggest-jha', err)
    return Response.json({ steps: [], error: 'Sage is temporarily unavailable' }, { status: 502 })
  }
}
