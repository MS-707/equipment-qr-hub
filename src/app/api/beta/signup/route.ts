import { addSignup, type BetaSignup } from '@/lib/beta'
import { sendEhsNotification } from '@/lib/email-notify'
import { sendSlackMessage, escapeSlack } from '@/lib/slack-notify'
import { rateLimit } from '@/lib/rate-limit'
import { BetaSignupBodySchema } from '@/lib/beta-decide-schemas'

export async function POST(req: Request) {
  // x-real-ip is set by Vercel; the last x-forwarded-for hop is the one the
  // platform appended (earlier hops are client-supplied and spoofable).
  const ip =
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean).pop() ??
    'unknown'
  const rl = await rateLimit(`beta-signup:${ip}`, 5, 60_000)
  if (!rl.ok) {
    return Response.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = BetaSignupBodySchema.safeParse(raw)
  if (!parsed.success) {
    // superRefine issues carry the exact messages tests pin ('required',
    // 'Invalid email address', 'Input too long'); plain type errors
    // (non-object body, non-string fields) fall back to the generic message.
    const message =
      parsed.error.issues.find((i) => i.code === 'custom')?.message ?? 'Invalid request body'
    return Response.json({ error: message }, { status: 400 })
  }
  const { name, email, company, role, crewSize, reason } = parsed.data

  const id = `beta-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const signup: BetaSignup = {
    id,
    name,
    email,
    company,
    role,
    crewSize,
    reason,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  await addSignup(signup)

  const appUrl = process.env.NEXTAUTH_URL || 'https://sage-ehs.mytra.ai'

  await Promise.all([
    sendEhsNotification({
      subject: `[Sage Beta] New signup: ${name} — ${company}`,
      text: [
        `New beta tester signup for Sage EHS`,
        ``,
        `Name: ${name}`,
        `Email: ${email}`,
        `Company: ${company}`,
        `Role: ${role}`,
        `Team size: ${crewSize || 'Not specified'}`,
        `Why they want access: ${reason || 'Not specified'}`,
        ``,
        `Submitted: ${new Date().toLocaleString()}`,
        ``,
        `Review and approve at: ${appUrl}/admin/beta`,
      ].join('\n'),
    }),
    sendSlackMessage(
      `📋 *Beta signup:* ${escapeSlack(name)} (${escapeSlack(email)})\n` +
      `${escapeSlack(company)} · ${escapeSlack(role)}${crewSize ? ` · ${escapeSlack(crewSize)}` : ''}\n` +
      `${reason ? `> ${escapeSlack(reason)}\n` : ''}` +
      `<${appUrl}/admin/beta|Review in admin>`
    ),
  ])

  return Response.json({ ok: true, id })
}
