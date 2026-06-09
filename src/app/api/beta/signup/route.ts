import { addSignup, type BetaSignup } from '@/lib/beta'
import { sendEhsNotification } from '@/lib/email-notify'
import { sendSlackMessage } from '@/lib/slack-notify'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit(`beta-signup:${ip}`, 5, 60_000)
  if (!rl.ok) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const company = String(body.company ?? '').trim()
  const role = String(body.role ?? '').trim()
  const crewSize = String(body.crewSize ?? '').trim()
  const reason = String(body.reason ?? '').trim()

  if (!name || !email || !company || !role) {
    return Response.json({ error: 'Name, email, company, and role are required' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 })
  }
  if (name.length > 100 || email.length > 200 || company.length > 200 || reason.length > 1000) {
    return Response.json({ error: 'Input too long' }, { status: 400 })
  }

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
      `📋 *Beta signup:* ${name} (${email})\n` +
      `${company} · ${role}${crewSize ? ` · ${crewSize}` : ''}\n` +
      `${reason ? `> ${reason}\n` : ''}` +
      `<${appUrl}/admin/beta|Review in admin>`
    ),
  ])

  return Response.json({ ok: true, id })
}
