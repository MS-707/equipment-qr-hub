'use client'

import { useEffect, useState } from 'react'
import { useSession, signIn, getProviders } from 'next-auth/react'
import { ShieldCheck, WifiOff, Loader2 } from 'lucide-react'
import { setCurrentIdentity, getCurrentIdentity } from '@/lib/identity'

type ProvidersMap = Awaited<ReturnType<typeof getProviders>>

/**
 * Gates every /safety/* page.
 *
 * - Authenticated → render children (and cache identity for offline use).
 * - Loading → spinner.
 * - Unauthenticated + online → sign-in screen (Google and/or dev email).
 * - Unauthenticated + offline + cached identity → render children with an
 *   "offline as {name}" banner (records attribute to the last verified login).
 * - Unauthenticated + offline + no cache → "connect once to sign in" screen.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [providers, setProviders] = useState<ProvidersMap>(null)
  const [online, setOnline] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [devName, setDevName] = useState('')
  const [devEmail, setDevEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getProviders()
      .then(setProviders)
      .catch(() => setProviders(null))
    setOnline(navigator.onLine)
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    const params = new URLSearchParams(window.location.search)
    const err = params.get('error')
    if (err) setAuthError(err)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      setCurrentIdentity({
        name: session.user.name || session.user.email || 'User',
        email: session.user.email,
        image: session.user.image,
      })
    }
  }, [status, session])

  if (status === 'authenticated') return <>{children}</>

  if (status === 'loading') {
    return (
      <Centered>
        <Loader2 className="w-6 h-6 text-mytra-purple animate-spin" />
        <p className="text-sm text-fg-2 mt-3">Checking your sign-in…</p>
      </Centered>
    )
  }

  // Unauthenticated
  const cached = getCurrentIdentity()

  if (!online && cached) {
    return (
      <>
        <div className="no-print bg-warn/10 border-b border-warn/20 px-4 py-2 text-center">
          <p className="text-xs text-warn/80 inline-flex items-center gap-1.5">
            <WifiOff className="w-3.5 h-3.5" />
            Offline — signed in as {cached.name}. Records will sync when you reconnect.
          </p>
        </div>
        {children}
      </>
    )
  }

  if (!online && !cached) {
    return (
      <Centered>
        <WifiOff className="w-8 h-8 text-fg-3" />
        <h2 className="text-base font-semibold text-fg mt-3">Sign in once to work offline</h2>
        <p className="text-sm text-fg-2 mt-1 max-w-xs">
          Connect to the internet and sign in with your Mytra account. After that, Sage
          works offline on this device.
        </p>
      </Centered>
    )
  }

  // Online + unauthenticated → sign-in
  const hasGoogle = !!(providers && providers.google)
  const hasDev = !!(providers && providers.dev)

  async function devSubmit(e: React.FormEvent) {
    e.preventDefault()
    setAuthError(null)
    setSubmitting(true)
    const res = await signIn('dev', { redirect: false, name: devName, email: devEmail })
    setSubmitting(false)
    if (res?.error) {
      setAuthError('AccessDenied')
    } else if (res?.ok) {
      // Credentials sign-in succeeded — refresh so the session is picked up.
      window.location.reload()
    }
  }

  return (
    <Centered>
      <div className="w-full max-w-sm bg-mytra-card shadow-card border border-mytra-border rounded-xl p-6 animate-fadeInUp">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-6 h-6 text-mytra-purple" />
          <span className="text-lg font-bold text-fg">Sage</span>
          <span className="text-xs bg-mytra-purple/20 text-mytra-purple rounded px-1.5 py-0.5 font-medium">
            Mytra EHS
          </span>
        </div>
        <p className="text-sm text-fg-2 mb-5">
          Sign in with your Mytra account to access safety forms. Your identity is recorded on every
          plan, permit, and signature.
        </p>

        {authError && (
          <div className="mb-4 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
            <p className="text-xs text-danger/80">
              {authError === 'AccessDenied'
                ? "That account isn't on the Mytra domain. Use your @mytra.ai email."
                : 'Sign-in failed. Please try again.'}
            </p>
          </div>
        )}

        {hasGoogle && (
          <button
            type="button"
            onClick={() => signIn('google')}
            className="w-full py-3 rounded-lg text-sm font-semibold bg-white text-gray-900
                       hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
          >
            Continue with Google
          </button>
        )}

        {hasGoogle && hasDev && (
          <div className="flex items-center gap-3 my-4">
            <div className="h-px bg-mytra-border flex-1" />
            <span className="text-xs uppercase tracking-wider text-fg-4">or</span>
            <div className="h-px bg-mytra-border flex-1" />
          </div>
        )}

        {hasDev && (
          <form onSubmit={devSubmit} className="space-y-3">
            <div>
              <label htmlFor="dev-name" className="block text-xs text-fg-2 mb-1">
                Full name
              </label>
              <input
                id="dev-name"
                type="text"
                value={devName}
                onChange={(e) => setDevName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3
                           text-sm text-fg placeholder:text-fg-4
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple"
              />
            </div>
            <div>
              <label htmlFor="dev-email" className="block text-xs text-fg-2 mb-1">
                Company email
              </label>
              <input
                id="dev-email"
                type="email"
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                placeholder="you@mytra.ai"
                className="w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3
                           text-sm text-fg placeholder:text-fg-4
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !devEmail.trim()}
              className="w-full py-3 rounded-lg text-sm font-semibold transition-colors
                         bg-mytra-purple text-white hover:bg-mytra-purple-hover
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
            {!hasGoogle && (
              <p className="text-xs text-fg-4 text-center">
                Dev sign-in (Google not configured yet). Restricted to the Mytra email domain.
              </p>
            )}
          </form>
        )}

        {!hasGoogle && !hasDev && (
          <p className="text-sm text-fg-2">
            No sign-in method is configured. Set Google OAuth env vars or enable dev login.
          </p>
        )}
      </div>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      {children}
    </div>
  )
}
