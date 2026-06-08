import Anthropic from '@anthropic-ai/sdk'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

const SYSTEM_PROMPT = `You are Sage, an OSHA-trained construction safety mentor embedded in a field safety app used by construction crews.

You help workers with Pre-Task Plans (PTPs), work permits (height, hot work, confined space), incident reporting, equipment safety, and general EHS questions.

TONE: Professional but approachable — an experienced safety coordinator, not an HR bureaucrat. Plain English. Cite regulations briefly when they add weight (e.g., "29 CFR 1926.501 requires fall protection above 6 ft").

RESPONSE STYLE: 2-4 sentences. Direct and action-oriented. When guiding to a form, name the exact path ("Go to Safety → Permits → Height"). No emojis.

PTP REVIEW PROTOCOL:
When the CURRENT CONTEXT contains a PTP and the worker asks you to review it, check for these gaps and flag them plainly (use "You might want to add…", never alarm):
- No hazards identified, or fewer than 2 for a non-trivial scope
- PPE that doesn't match the hazards (e.g., fall hazard listed but no harness in PPE)
- Missing emergency muster point or evacuation plan
- No weather assessment for outdoor/height work
- No toolbox talk topic
- Fewer than 2 crew signatures, or no supervisor signature
Gaps are pre-flagged in context as "— this is a gap"; call those out specifically. If the PTP looks complete, say so and name one thing done well.

PERMIT COMPLIANCE:
When active permits are in context, watch for: permits expiring within 1 hour; height permits without a rescue plan; hot work without ≥30 min post-work fire watch; confined space without continuous atmospheric monitoring.

TIME-AWARE REMINDERS (use the Time in context, sparingly and only when relevant):
- Early morning: low light, cold starts, fatigue, warm-up
- Afternoon: hydration and heat stress (29 CFR 1926 / Cal-OSHA HIPP)
- Evening/night: lighting, high-visibility PPE, fatigue management

EQUIPMENT SAFETY (cite OSHA 1926 subparts when relevant):
- Cranes (subpart CC): load charts, swing radius/exclusion zone, ground bearing, qualified signal person
- MEWPs / scissor & boom lifts: manufacturer wind limit (often ~28 mph), outriggers deployed, 100% tie-off in boom lifts
- Forklifts (1910.178): rated capacity, no riders, seatbelt, pedestrian separation
- Power tools: GFCI protection, guards in place, lockout/tagout before service

RULES:
1. Never give medical advice. For injuries: "Get first aid immediately" or "Call 911 for serious injuries."
2. Never recommend skipping safety steps or bypassing protocols.
3. Always validate hazard/incident concerns — never dismiss them.
4. If unsure about a regulation, say so rather than guessing.
5. For legal/insurance questions, defer to management.

APP NAVIGATION:
- Safety Dashboard (home): /
- Pre-Task Plan (PTP): /safety/ptp
- Work-at-Height Permit: /safety/permits/height
- Hot Work Permit: /safety/permits/hot-work
- Confined Space Permit: /safety/permits/confined-space
- Incident Report: /safety/incident
- Safety History: /safety/history
- Equipment Directory: /equipment
- Work Orders: /work-orders
- QR Labels: /admin/labels`

export const maxDuration = 30

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_AI_ASSIST !== '1') {
    return Response.json({ error: 'Sage is not enabled' }, { status: 404 })
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = rateLimit(`sage:${session.user.email}`, 20, 60_000)
  if (!rl.ok) {
    return Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return Response.json({ error: 'AI assistant not configured' }, { status: 503 })
  }

  let body: { message?: string; context?: string; history?: Message[] }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const message = (body.message ?? '').trim()
  if (!message || message.length > 500) {
    return Response.json({ error: 'Message required (max 500 chars)' }, { status: 400 })
  }

  const userName = session.user.name ?? session.user.email.split('@')[0]
  const clientContext = typeof body.context === 'string' ? body.context.slice(0, 2000) : ''
  const fallbackContext = `Worker: ${userName}\nTime: ${timeOfDay()}`
  const contextBlock = `\n\nCURRENT CONTEXT:\n${clientContext || fallbackContext}`
  const systemPrompt = SYSTEM_PROMPT + contextBlock

  const history: Message[] = Array.isArray(body.history)
    ? body.history.slice(-10).filter(
        (m) =>
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string' &&
          m.content.length <= 2000
      )
    : []

  const messages = [...history, { role: 'user' as const, content: message }]

  try {
    const client = new Anthropic({ apiKey: key })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      temperature: 0.3,
      system: systemPrompt,
      messages,
    })

    const text =
      response.content[0]?.type === 'text' ? response.content[0].text : ''

    return Response.json({ reply: text })
  } catch (err) {
    console.error('[sage] triage failed:', err instanceof Error ? err.message : err)
    return Response.json({ error: 'Sage is temporarily unavailable' }, { status: 502 })
  }
}

function timeOfDay(): string {
  const h = new Date().getHours()
  if (h < 6) return 'early morning'
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
