import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You are Sage, an OSHA-trained construction safety advisor embedded in a Pre-Task Plan (PTP) tool used by structural engineers and build crews.

Given a scope of work and optional location, suggest 3-6 hazards the crew should address. For each hazard, provide:
- description: concise hazard name (e.g. "Overhead power lines", "Silica dust exposure")
- riskLevel: one of "low", "medium", "high", "critical"
- controlMeasure: a specific, actionable mitigation (not generic advice)

Base risk levels on OSHA severity × probability. Reference:
- 29 CFR 1926 (Construction)
- 29 CFR 1910 (General Industry)
- Cal/OSHA Title 8
- NFPA 51B (Hot Work)

Respond ONLY with a JSON object: { "hazards": [...] }
No markdown, no explanation, no preamble. Just the JSON object.`

// Allow the Claude call enough headroom; Vercel's default function timeout is
// 10s which can cut off generation. 30s is well within Hobby plan limits.
export const maxDuration = 30

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return Response.json(
      { hazards: [], error: 'ANTHROPIC_API_KEY not configured' },
      { status: 503 }
    )
  }

  let body: { scopeOfWork?: string; location?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ hazards: [], error: 'Invalid request body' }, { status: 400 })
  }

  const scopeOfWork = (body.scopeOfWork ?? '').trim()
  if (!scopeOfWork) {
    return Response.json({ hazards: [], error: 'No scope of work provided' })
  }

  const userMessage = [
    `Scope of work: ${scopeOfWork}`,
    body.location ? `Location: ${body.location}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const client = new Anthropic({ apiKey: key })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const raw =
      message.content[0]?.type === 'text' ? message.content[0].text : ''

    // Claude sometimes wraps JSON in markdown fences despite instructions
    const text = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '')

    const parsed = JSON.parse(text)
    const hazards = Array.isArray(parsed?.hazards) ? parsed.hazards : []

    const valid = hazards
      .filter(
        (h: Record<string, unknown>) =>
          typeof h.description === 'string' &&
          typeof h.controlMeasure === 'string' &&
          ['low', 'medium', 'high', 'critical'].includes(h.riskLevel as string)
      )
      .slice(0, 8)

    return Response.json({ hazards: valid })
  } catch (err) {
    console.error('[sage] suggest-hazards failed:', err instanceof Error ? err.message : err)
    const isSyntax = err instanceof SyntaxError
    return Response.json(
      { hazards: [], error: isSyntax ? 'Sage returned an unexpected format — try again' : 'Sage is temporarily unavailable' },
      { status: 502 }
    )
  }
}
