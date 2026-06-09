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
 * Dev/demo sign-in: enabled ONLY when ALLOW_DEV_LOGIN=1 AND NODE_ENV !== production.
 * Never available in production builds regardless of env vars.
 */

import type { NextAuthOptions } from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { isFirstLogin } from '@/lib/user-tracker'
import { sendSlackMessage } from '@/lib/slack-notify'

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
const allowDevLogin = process.env.ALLOW_DEV_LOGIN === '1' && !isProduction
const allowEmailLogin = process.env.ALLOW_EMAIL_LOGIN === '1'

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
      },
      async authorize(creds) {
        const email = (creds?.email ?? '').toString().trim().toLowerCase()
        const name = (creds?.name ?? '').toString().trim()
        if (!emailAllowed(email)) return null
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

      const email = user.email ?? (profile as { email?: string } | undefined)?.email
      if (email) {
        isFirstLogin(email).then((first) => {
          if (first) {
            const name = user.name || email.split('@')[0]
            sendSlackMessage(`🆕 *${name}* (${email}) just signed into Sage EHS for the first time.`)
          }
        }).catch(() => {})
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
      }
      return session
    },
  },
  // Drive sign-in/errors back through our own AuthGate screen at /safety.
  pages: { signIn: '/safety', error: '/safety' },
}

/** Exposed so the client can tailor the sign-in screen (Google button vs dev form). */
export const authConfigFlags = { hasGoogle, allowDevLogin: allowDevLogin || allowEmailLogin }
