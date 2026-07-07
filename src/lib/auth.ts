/**
 * NextAuth configuration — server only.
 *
 * Identity is the backbone of the audit trail. Auth is intentionally a swappable
 * seam: Google (mytra domain) is the production provider, but the providers array
 * is built dynamically so Slack / Rippling / SSO can be added later without
 * touching callers.
 *
 * Domain restriction is enforced SERVER-SIDE (Google `hd` is only a UI hint).
 *
 * Dev/demo sign-in: enabled when NODE_ENV !== production AND either
 * ALLOW_DEV_LOGIN=1 is set explicitly, or Google OAuth is not configured at all
 * (zero-config first run; opt out with ALLOW_DEV_LOGIN=0). Never available in
 * production builds regardless of env vars.
 */

import type { NextAuthOptions } from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { timingSafeEqual } from 'crypto'
import { isFirstLogin } from '@/lib/user-tracker'
import { sendSlackMessage, escapeSlack } from '@/lib/slack-notify'
import { isAdmin } from '@/lib/admin'
import { log } from '@/lib/log'
import { resolveRole } from '@/lib/roles'

const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS ?? 'mytra.ai')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean)

export function emailAllowed(email?: string | null): boolean {
  if (!email) return false
  const domain = email.split('@')[1]?.toLowerCase()
  return !!domain && ALLOWED_DOMAINS.includes(domain)
}

const hasGoogle = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
const isProduction = process.env.NODE_ENV === 'production'
// Zero-config first run: with no Google OAuth configured in non-production,
// register the dev provider unless explicitly opted out (ALLOW_DEV_LOGIN=0),
// so a fresh clone can sign in without any .env.local. The production gate
// is unconditional.
const allowDevLogin =
  (process.env.ALLOW_DEV_LOGIN === '1' ||
    (!hasGoogle && process.env.ALLOW_DEV_LOGIN !== '0')) &&
  !isProduction

// Email login has no password, so in production it is only available when an
// EMAIL_LOGIN_CODE is configured and presented at sign-in. Without this gate,
// anyone could sign in as any allowed-domain address (including admins).
const emailLoginCode = process.env.EMAIL_LOGIN_CODE ?? ''

function safeCodeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}
const allowEmailLogin =
  process.env.ALLOW_EMAIL_LOGIN === '1' && (!isProduction || emailLoginCode.length > 0)

const providers: NextAuthOptions['providers'] = []

if (hasGoogle) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: { params: { hd: ALLOWED_DOMAINS[0], prompt: 'select_account' } },
    })
  )
}

if (allowDevLogin || allowEmailLogin) {
  providers.push(
    Credentials({
      id: 'dev',
      name: 'Company email',
      credentials: {
        name: { label: 'Full name', type: 'text' },
        email: { label: 'Company email', type: 'email' },
        code: { label: 'Access code', type: 'password' },
      },
      async authorize(creds) {
        const email = (creds?.email ?? '').toString().trim().toLowerCase()
        const name = (creds?.name ?? '').toString().trim()
        if (!emailAllowed(email)) return null
        // Identity assurance: once a stronger provider (Google OAuth) exists,
        // the shared EMAIL_LOGIN_CODE must never mint an elevated session in
        // production — anyone holding the code could otherwise sign in AS an
        // admin/ehs address with a freeform name; elevated roles must use
        // OAuth. But when NO OAuth is configured the shared code is the only
        // door for everyone, so blocking admins there just locks them out of
        // their own app with no alternative — gate the block on hasGoogle.
        if (isProduction && hasGoogle && resolveRole(email) !== 'worker') {
          log('warn', 'code-login-blocked-elevated', { email })
          return null
        }
        const code = (creds?.code ?? '').toString()
        if (isProduction && (!emailLoginCode || !safeCodeCompare(code, emailLoginCode))) {
          log('warn', 'code-login-failed', { email })
          return null
        }
        log('info', 'code-login', { email, mode: isProduction ? 'production' : 'dev' })
        return { id: email, name: name || email.split('@')[0], email }
      },
    })
  )
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 },
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider === 'google') {
        const p = profile as { email?: string; email_verified?: boolean } | undefined
        if (!emailAllowed(p?.email) || p?.email_verified !== true) return false
      }

      // Awaited deliberately: fire-and-forget promises freeze with the lambda
      // when the response is sent and only complete on the next invocation
      // (notifications arrived a page-refresh late). Failures never block sign-in.
      const email = user.email ?? (profile as { email?: string } | undefined)?.email
      if (email) {
        try {
          if (await isFirstLogin(email)) {
            const name = user.name || email.split('@')[0]
            await sendSlackMessage(`🆕 *${escapeSlack(name)}* (${escapeSlack(email)}) just signed into Sage EHS for the first time.`)
          }
        } catch {
          // notification is best-effort
        }
      }

      return true
    },
    async jwt({ token, profile }) {
      const picture = (profile as { picture?: string } | undefined)?.picture
      if (picture) token.picture = picture
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email ?? session.user.email
        session.user.name = token.name ?? session.user.name
        session.user.image = (token.picture as string | undefined) ?? session.user.image
        session.user.isAdmin = isAdmin(session.user.email)
        session.user.role = resolveRole(session.user.email)
      }
      return session
    },
  },
  // Drive sign-in/errors back through our own AuthGate screen at /safety.
  pages: { signIn: '/safety', error: '/safety' },
}

/** Exposed so the client can tailor the sign-in screen (Google button vs dev form). */
export const authConfigFlags = { hasGoogle, allowDevLogin: allowDevLogin || allowEmailLogin }
