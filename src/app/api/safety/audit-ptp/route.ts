import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'
import { AuditPtpRequestSchema } from '@/lib/analyze-schemas'
import { ANTHROPIC_TIMEOUT_MS } from '@/lib/fetch-timeout'
import { reportServerError } from '@/lib/report-error'

const SYSTEM_PROMPT = `You are Sage, an experienced EHS safety auditor embedded in a Pre-Task Plan (PTP) tool. You review completed PTPs before submission to catch critical safety gaps.

Given a full PTP record, audit it for completeness across these categories:

1. SCOPE-vs-HAZARD ALIGNMENT
   Check that the scope of work is covered by the hazard list. Examples:
   - "overhead work" or "steel erection" → expect "falling objects" hazard
   - "excavation" → expect "cave-in / trench collapse" hazard
   - "work near traffic" → expect "struck-by vehicle" hazard
   Flag any scope keywords that lack a corresponding hazard entry.

2. PPE-vs-HAZARD ALIGNMENT
   Check that PPE selections match the identified hazards:
   - Welding/hot work hazards → welding hood/shield PPE
   - Noise hazards → hearing protection
   - Height hazards → fall protection harness
   - Dust/silica/fume hazards → respirator
   Flag missing PPE for identified hazards.

3. PERMIT REQUIREMENTS
   - Height work (scaffold, MEWP, elevated platforms) → height permit
   - Hot work (welding, cutting, grinding with sparks) → hot work permit
   - Confined space entry → confined space permit
   Flag if hazards imply a permit but no permit is mentioned in scope or controls.

4. EMERGENCY READINESS
   - Muster point must be specified
   - First aid / eyewash location should be specified
   - Nearest hospital should be specified

5. CREW SIGN-OFF COMPLETENESS
   - At least one crew signature expected
   - Supervisor signature expected

6. MULTI-DAY PLAN VALIDITY
   If the PTP has a validUntil date beyond the PTP date (multi-day plan):
   - Flag that weather conditions may change day-to-day — each morning should include a weather check
   - Flag that crew members may differ day-to-day — daily verbal re-confirmation recommended
   - Flag that site conditions (excavations, scaffolding, deliveries) may change
   Rate as "warning" unless the scope involves rapidly changing conditions, then "blocker".

Rate each finding as:
- "blocker": a critical safety gap that should be resolved before work begins
- "warning": a gap worth reviewing but not necessarily a showstopper

Set overallRisk based on the worst finding severity and count:
- "low": no blockers, 0-1 warnings
- "medium": no blockers, 2+ warnings
- "high": 1-2 blockers
- "critical": 3+ blockers

If everything looks complete, return pass=true with an empty findings array and overallRisk="low".`

const AuditResultSchema = z.object({
  pass: z.boolean(),
  findings: z.array(z.object({
    category: z.string(),
    severity: z.enum(['blocker', 'warning']),
    finding: z.string(),
    suggestion: z.string(),
  })),
  overallRisk: z.enum(['low', 'medium', 'high', 'critical']),
})

export const maxDuration = 60

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_AI_ASSIST !== '1') {
    return Response.json({ error: 'AI assist is not enabled' }, { status: 404 })
  }

  const { session, error } = await requireSession()
  if (error) return error

  const rl = await rateLimit(`audit-ptp:${session?.user?.email || 'unknown'}`, 5, 60_000)
  if (!rl.ok) {
    return Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })
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
    reportServerError('api/safety/audit-ptp', err)
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = AuditPtpRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid or missing PTP record' }, { status: 400 })
  }
  const ptp = parsed.data.ptp

  const userMessage = [
    `Date: ${ptp.date}`,
    `Shift: ${ptp.shift}`,
    `Project: ${ptp.projectName || '(not specified)'}`,
    `Location: ${ptp.location || '(not specified)'}`,
    `Scope of work: ${ptp.scopeOfWork || '(not specified)'}`,
    '',
    `Hazards (${ptp.hazards?.length ?? 0}):`,
    ...(ptp.hazards ?? []).map((h) => `  - [${h.riskLevel}] ${h.description} | Control: ${h.controlMeasure}`),
    '',
    `PPE required: ${ptp.ppeRequired?.length ? ptp.ppeRequired.join(', ') : '(none selected)'}`,
    '',
    `Emergency muster point: ${ptp.emergencyMusterPoint || '(not specified)'}`,
    `Nearest hospital: ${ptp.nearestHospital || '(not specified)'}`,
    `First aid / eyewash: ${ptp.firstAidEyewashLocation || '(not specified)'}`,
    '',
    `Weather: ${ptp.weatherNotes || '(not noted)'}`,
    `Wind speed: ${ptp.windSpeed || '(not noted)'}`,
    '',
    `Heat illness plan: water=${ptp.heatIllnessPlan?.water}, shade=${ptp.heatIllnessPlan?.shade}, rest breaks=${ptp.heatIllnessPlan?.restBreaks}, high-heat procedures=${ptp.heatIllnessPlan?.highHeatProcedures}`,
    '',
    `Toolbox talk topic: ${ptp.toolboxTalkTopic || '(none)'}`,
    '',
    `Crew signatures: ${ptp.crewSignatures?.length ?? 0}`,
    `Supervisor signature: ${ptp.supervisorSignatureId ? 'yes' : 'no'}`,
  ].join('\n')

  try {
    const client = new Anthropic({ apiKey: key, timeout: ANTHROPIC_TIMEOUT_MS })

    const message = await client.messages.parse({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      output_config: { format: zodOutputFormat(AuditResultSchema) },
    })

    const result = message.parsed_output ?? { pass: true, findings: [], overallRisk: 'low' as const }

    return Response.json(result)
  } catch (err) {
    reportServerError('api/safety/audit-ptp', err)
    console.error('[sage] audit-ptp failed:', err instanceof Error ? err.message : err)
    return Response.json(
      { error: 'Sage is temporarily unavailable' },
      { status: 502 }
    )
  }
}
