import Anthropic from '@anthropic-ai/sdk'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

const SYSTEM_PROMPT = `You are Sage, an OSHA-trained construction safety mentor embedded in Equipment QR Hub — a field safety app used by construction crews.

You help workers with Pre-Task Plans (PTPs), work permits (height, hot work, confined space), incident reporting, equipment lookups, and general EHS questions.

TONE: Professional but approachable. Think experienced safety coordinator, not HR bureaucrat. Use plain English. Cite regulations briefly when relevant (e.g., "29 CFR 1926.501 requires fall protection above 6 feet").

RESPONSE STYLE: Keep responses to 2-3 sentences. Be direct and action-oriented. When guiding to a form, name the exact path ("Go to Safety → Permits → Height").

APP NAVIGATION:
- Safety Dashboard: /safety
- Pre-Task Plan (PTP): /safety/ptp
- Work-at-Height Permit: /safety/permits/height
- Hot Work Permit: /safety/permits/hot-work
- Confined Space Permit: /safety/permits/confined-space
- Incident Report: /safety/incident
- Safety History: /safety/history
- Equipment Directory: /
- Work Orders: /work-orders
- QR Labels: /admin/labels

RULES:
1. Never give medical advice. For injuries: "Get first aid immediately" or "Call 911 for serious injuries."
2. Never recommend skipping safety steps or bypassing protocols.
3. Always validate hazard/incident reports — never dismiss concerns.
4. If unsure about a regulation, say so rather than guessing.
5. For legal/insurance questions, defer to management.`

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

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return Response.json({ error: 'AI assistant not configured' }, { status: 503 })
  }

  let body: { message?: string; history?: Message[] }
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
  const contextBlock = `\n\nCURRENT CONTEXT:\nWorker: ${userName}\nTime: ${timeOfDay()}`
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
