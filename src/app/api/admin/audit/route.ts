import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { recentAudit } from '@/lib/audit-log'
import { reportServerError } from '@/lib/report-error'

export const dynamic = 'force-dynamic'

/**
 * Admin-only view of the privileged-action audit trail (newest first).
 * Gated exactly like /api/admin/health: session + isAdmin.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limitParam = Number(new URL(req.url).searchParams.get('limit'))
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 100

  try {
    const entries = await recentAudit(limit)
    return Response.json({ entries })
  } catch (err) {
    reportServerError('api/admin/audit', err)
    return Response.json({ error: 'Storage temporarily unavailable, try again shortly' }, { status: 503 })
  }
}
