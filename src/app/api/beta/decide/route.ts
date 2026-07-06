import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { updateSignupStatus, getAllSignups } from '@/lib/beta'
import { BetaDecideBodySchema } from '@/lib/beta-decide-schemas'
import { sendBetaEmail } from './email'
import { reportServerError } from '@/lib/report-error'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch (err) {
    reportServerError('api/beta/decide', err)
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = BetaDecideBodySchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: 'id and status (approved|rejected) required' }, { status: 400 })
  }
  const { id, status } = parsed.data

  let signup
  try {
    signup = await updateSignupStatus(id, status)
  } catch (err) {
    reportServerError('api/beta/decide', err)
    return Response.json({ error: 'Storage temporarily unavailable, try again shortly' }, { status: 503 })
  }
  if (!signup) {
    return Response.json({ error: 'Signup not found' }, { status: 404 })
  }

  await sendBetaEmail(signup, status)

  return Response.json({ ok: true, signup })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    return Response.json({ signups: await getAllSignups() })
  } catch (err) {
    reportServerError('api/beta/decide', err)
    return Response.json({ error: 'Storage temporarily unavailable, try again shortly' }, { status: 503 })
  }
}
