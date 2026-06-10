import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'

const SYSTEM_PROMPT = `You are Sage, an experienced EHS safety advisor. A worker has uploaded a planning document (task plan, method statement, scope of work, or similar) and wants to create a Job Hazard Analysis from it.

Your job:
1. Read the document carefully.
2. Extract the discrete WORK STEPS in the order they would be performed. If the document describes phases or stages, break them into individual actionable steps. Aim for 4-12 steps.
3. For each step, provide:
   - taskActivity: a concise description of what is done (1-2 sentences max)
   - hazards: the hazard(s) the team should consider (1-3 hazards, newline-separated). Be specific to the activity.
   - riskLevel: one of "low", "medium", "high", "critical", rated BEFORE controls using a 5×5 risk matrix (severity × likelihood)
   - controls: specific, actionable mitigations (not generic advice)
   - residualRiskLevel: risk AFTER controls are applied (should typically be lower)
4. Also extract:
   - suggestedTitle: a concise job/task title for the JHA
   - suggestedPpe: array of PPE items mentioned or implied (use short labels like "Hard Hat", "Safety Glasses", "Gloves", "Hi-Vis Vest", "Steel-Toe Boots", "Hearing Protection", "Fall Harness", "Respirator", "Face Shield")
   - suggestedLocation: work location if mentioned, otherwise empty string
   - suggestedDepartment: department/team if mentioned, otherwise empty string

RISK MATRIX: Severity (1-5) × Likelihood (1-5) → low (1-4), medium (5-9), high (10-15), critical (16-25)

If the document is not a work plan or has no extractable steps, return an empty steps array and set suggestedTitle to "". Do not invent content that isn't supported by the document.`

const ParsedJhaSchema = z.object({
  suggestedTitle: z.string(),
  suggestedPpe: z.array(z.string()),
  suggestedLocation: z.string(),
  suggestedDepartment: z.string(),
  steps: z.array(
    z.object({
      taskActivity: z.string(),
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
    return Response.json({ error: 'AI assist is not enabled' }, { status: 404 })
  }

  const { session, error } = await requireSession()
  if (error) return error

  const rl = rateLimit(`parse-doc:${session!.user!.email}`, 5, 60_000)
  if (!rl.ok) {
    return Response.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return Response.json({ error: 'AI assistant not configured' }, { status: 503 })
  }

  let body: { documentText?: string; fileName?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const documentText = (body.documentText ?? '').trim()
  if (!documentText) {
    return Response.json({ error: 'No document text provided' }, { status: 400 })
  }

  // Cap at ~50k chars to stay within reasonable context usage
  const bounded = documentText.slice(0, 50_000)
  const fileName = (body.fileName ?? 'uploaded document').slice(0, 200)

  const userMessage = `Here is the planning document "${fileName}":\n\n---\n${bounded}\n---\n\nExtract work steps and hazard analysis from this document.`

  try {
    const client = new Anthropic({ apiKey: key })
    const message = await client.messages.parse({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      output_config: { format: zodOutputFormat(ParsedJhaSchema) },
    })
    const result = message.parsed_output
    if (!result || result.steps.length === 0) {
      return Response.json({ error: 'Could not extract work steps from this document. Make sure it describes a task or procedure.' }, { status: 422 })
    }
    return Response.json(result)
  } catch (err) {
    console.error('[sage] parse-document failed:', err instanceof Error ? err.message : err)
    return Response.json({ error: 'Sage is temporarily unavailable' }, { status: 502 })
  }
}
