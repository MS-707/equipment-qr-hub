import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { requireSession } from '@/lib/api-auth'
import { ParseDocumentBodySchema } from '@/lib/doc-analysis-schemas'
import { rateLimit } from '@/lib/rate-limit'
import { ANTHROPIC_TIMEOUT_MS } from '@/lib/fetch-timeout'

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

RISK MATRIX (per EHS-MGT-001, 5×5 Severity × Likelihood):
  Severity: 1 Negligible (first aid only), 2 Minor (medical treatment, no permanent effects), 3 Moderate (lost-time injury, OSHA recordable), 4 Major (hospitalization, permanent disability), 5 Catastrophic (fatality or multiple severe injuries)
  Likelihood: 1 Rare (exceptional circumstances only), 2 Unlikely (not expected, controls would need to fail), 3 Possible (has occurred in similar operations), 4 Likely (will probably occur, current controls insufficient), 5 Almost Certain (expected to occur, controls absent or ineffective)
  Score = Severity × Likelihood → low (1-4), medium (5-9), high (10-16), critical (20-25)

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

  const rl = await rateLimit(`parse-doc:${session?.user?.email || 'unknown'}`, 5, 60_000)
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

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = ParseDocumentBodySchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const body = parsed.data

  const documentText = (body.documentText ?? '').trim()
  const documentBase64 = (body.documentBase64 ?? '').trim()
  if (!documentText && !documentBase64) {
    return Response.json({ error: 'No document provided' }, { status: 400 })
  }
  // ~4.2MB of base64 ≈ 3MB PDF — keeps the request under Vercel's body limit
  if (documentBase64.length > 4_200_000) {
    return Response.json({ error: 'PDF too large — keep it under 3MB' }, { status: 413 })
  }

  const fileName = (body.fileName ?? 'uploaded document').slice(0, 200)
  const instruction = `Extract work steps and hazard analysis from this planning document ("${fileName}").`

  // PDFs go to Claude natively as a document block; text formats inline.
  const content: Anthropic.MessageParam['content'] = documentBase64
    ? [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: documentBase64 },
        },
        { type: 'text', text: instruction },
      ]
    : [
        {
          type: 'text',
          text: `Here is the planning document "${fileName}":\n\n---\n${documentText.slice(0, 50_000)}\n---\n\n${instruction}`,
        },
      ]

  try {
    const client = new Anthropic({ apiKey: key, timeout: ANTHROPIC_TIMEOUT_MS })
    const message = await client.messages.parse({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
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
