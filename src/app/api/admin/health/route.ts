import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { kv } from '@vercel/kv'

export const dynamic = 'force-dynamic'

/**
 * Admin-only deployment health check. Reports which integrations are
 * configured (booleans/status only — never values) and live-pings KV.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let kvStatus: 'connected' | 'error' | 'not-configured' = 'not-configured'
  if (process.env.KV_REST_API_URL) {
    try {
      await kv.incr('health:probe')
      kvStatus = 'connected'
    } catch {
      kvStatus = 'error'
    }
  }

  return Response.json({
    kv: kvStatus,
    googleAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    emailLogin: process.env.ALLOW_EMAIL_LOGIN === '1',
    emailLoginCode: !!process.env.EMAIL_LOGIN_CODE,
    nextauthSecret: !!process.env.NEXTAUTH_SECRET,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    aiAssistFlag: process.env.NEXT_PUBLIC_AI_ASSIST === '1',
    resend: !!process.env.RESEND_API_KEY,
    slackWebhook: !!process.env.SLACK_WEBHOOK_URL,
    notion: !!process.env.NOTION_API_KEY,
    env: process.env.NODE_ENV,
  })
}
