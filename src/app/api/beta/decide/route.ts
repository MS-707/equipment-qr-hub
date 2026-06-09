import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { updateSignupStatus, getAllSignups, type BetaStatus } from '@/lib/beta'
import { sendBetaEmail } from './email'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { id?: string; status?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const id = String(body.id ?? '')
  const status = body.status as BetaStatus
  if (!id || (status !== 'approved' && status !== 'rejected')) {
    return Response.json({ error: 'id and status (approved|rejected) required' }, { status: 400 })
  }

  const signup = await updateSignupStatus(id, status)
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

  return Response.json({ signups: await getAllSignups() })
}
