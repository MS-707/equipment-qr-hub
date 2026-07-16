'use client'

import { useEffect, useState } from 'react'
import { useSession, signIn, getProviders } from 'next-auth/react'
import { ShieldCheck, WifiOff, Loader2 } from 'lucide-react'
import { setCurrentIdentity, getCurrentIdentity, isIdentityStale, isIdentityAging } from '@/lib/identity'
import { btnPrimaryCls } from '@/lib/form-styles'
import { useT } from '@/lib/i18n'

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
  const t = useT()
  const { data: session, status } = useSession()
  const [providers, setProviders] = useState<ProvidersMap>(null)
  const [online, setOnline] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [devName, setDevName] = useState('')
  const [devEmail, setDevEmail] = useState('')
  const [devCode, setDevCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // In production builds, email login requires the shared access code
  // (EMAIL_LOGIN_CODE) — the provider is only registered when one is set.
  const needsCode = process.env.NODE_ENV === 'production'

  useEffect(() => {
    setMounted(true)
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

  // Providers are only needed to render the sign-in screen — fetching them on
  // every mount added a network request to every gated page navigation.
  useEffect(() => {
    if (status !== 'unauthenticated') return
    getProviders()
      .then(setProviders)
      .catch(() => setProviders(null))
  }, [status])

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
    // Optimistic render: a fresh cached identity means this device signed in
    // recently — paint the page immediately and let the session round-trip
    // reconcile in the background (an expired session re-renders into the
    // sign-in screen). Removes one network RTT from every cold page open on
    // slow field connections. The `mounted` gate avoids an SSR hydration
    // mismatch (the server can't read localStorage).
    if (mounted && getCurrentIdentity() && !isIdentityStale()) {
      return <>{children}</>
    }
    return (
      <Centered>
        <Loader2 className="w-6 h-6 text-mytra-purple animate-spin" />
        <p className="text-sm text-fg-2 mt-3">{t('auth.checkingSignIn', undefined, 'Checking your sign-in…')}</p>
      </Centered>
    )
  }

  // Unauthenticated
  const cached = getCurrentIdentity()

  if (!online && cached && !isIdentityStale()) {
    const aging = isIdentityAging()
    return (
      <>
        <div className="no-print bg-warn/10 border-b border-warn/20 px-4 py-2 text-center">
          <p className="text-xs text-warn/80 inline-flex items-center gap-1.5">
            <WifiOff className="w-3.5 h-3.5" />
            {aging
              ? t('auth.offlineAgingBanner', { name: cached.name })
              : t('auth.offlineBanner', { name: cached.name })}
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
        <h2 className="text-base font-semibold text-fg mt-3">{t('auth.offlineNoCacheTitle', undefined, 'Sign in once to work offline')}</h2>
        <p className="text-sm text-fg-2 mt-1 max-w-xs">
          {t('auth.offlineNoCacheBody', undefined, 'Connect to the internet and sign in with your company account. After that, Sage works offline on this device.')}
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
    const res = await signIn('dev', { redirect: false, name: devName, email: devEmail, code: devCode })
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
      <div className="relative w-full max-w-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 w-[520px] h-[520px] -translate-x-1/2 rounded-full bg-mytra-purple/10 blur-3xl animate-glowPulse [will-change:opacity]"
        />
      <div className="relative w-full bg-mytra-card shadow-card border border-mytra-border rounded-xl p-6 animate-fadeInUp">
        <div className="flex items-center gap-2 mb-1 animate-blurIn" style={{ animationDelay: '60ms' }}>
          <ShieldCheck className="w-6 h-6 text-mytra-purple" />
          <span className="text-lg font-bold text-fg">Sage</span>
          <span className="text-xs bg-mytra-purple/20 text-mytra-purple rounded px-1.5 py-0.5 font-medium">
            EHS
          </span>
        </div>
        <p className="text-sm text-fg-2 mb-5 animate-blurIn" style={{ animationDelay: '120ms' }}>
          {t('auth.intro', undefined, 'Sign in with your company account to access safety forms. Your identity is recorded on every plan, permit, and signature.')}
        </p>

        {authError && (
          <div className="mb-4 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
            <p className="text-xs text-danger/80">
              {authError === 'AccessDenied'
                ? needsCode
                  ? t('auth.errAccessDeniedCode')
                  : t('auth.errAccessDenied')
                : t('auth.errGeneric', undefined, 'Sign-in failed. Please try again.')}
            </p>
          </div>
        )}

        {hasGoogle && (
          <button
            type="button"
            onClick={() => signIn('google')}
            className="w-full py-3 rounded-lg text-sm font-semibold bg-white text-black
                       hover:opacity-90 transition-colors flex items-center justify-center gap-2"
          >
            {t('auth.continueGoogle', undefined, 'Continue with Google')}
          </button>
        )}

        {hasGoogle && hasDev && (
          <div className="flex items-center gap-3 my-4">
            <div className="h-px bg-mytra-border flex-1" />
            <span className="text-xs uppercase tracking-wider text-fg-4">{t('common.or', undefined, 'or')}</span>
            <div className="h-px bg-mytra-border flex-1" />
          </div>
        )}

        {hasDev && (
          <form onSubmit={devSubmit} className="space-y-3">
            <div>
              <label htmlFor="dev-name" className="block text-xs text-fg-2 mb-1">
                {t('auth.fullName', undefined, 'Full name')}
              </label>
              <input
                id="dev-name"
                type="text"
                autoCapitalize="words"
                autoComplete="name"
                value={devName}
                onChange={(e) => setDevName(e.target.value)}
                placeholder={t('auth.namePlaceholder', undefined, 'Your name')}
                className="w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3
                           text-sm text-fg placeholder:text-fg-4
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple"
              />
            </div>
            <div>
              <label htmlFor="dev-email" className="block text-xs text-fg-2 mb-1">
                {t('auth.companyEmail', undefined, 'Company email')}
              </label>
              <input
                id="dev-email"
                type="email"
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder', undefined, 'Your company email')}
                className="w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3
                           text-sm text-fg placeholder:text-fg-4
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple"
              />
            </div>
            {needsCode && (
              <div>
                <label htmlFor="dev-code" className="block text-xs text-fg-2 mb-1">
                  {t('auth.accessCode', undefined, 'Access code')}
                </label>
                <input
                  id="dev-code"
                  type="password"
                  value={devCode}
                  onChange={(e) => setDevCode(e.target.value)}
                  placeholder={t('auth.codePlaceholder', undefined, 'Shared access code')}
                  className="w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3
                             text-sm text-fg placeholder:text-fg-4
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={submitting || !devEmail.trim() || (needsCode && !devCode.trim())}
              className={`${btnPrimaryCls} w-full py-3 text-sm font-semibold`}
            >
              {submitting ? t('auth.signingIn', undefined, 'Signing in…') : t('auth.signIn', undefined, 'Sign in')}
            </button>
            {!hasGoogle && (
              <p className="text-xs text-fg-4 text-center">
                {t('auth.devNote', undefined, 'Dev sign-in (Google not configured yet). Restricted to the approved email domain.')}
              </p>
            )}
          </form>
        )}

        {!hasGoogle && !hasDev && (
          <div className="space-y-3">
            <p className="text-sm text-fg-2">
              {t('auth.notConfigured', undefined, 'Sign-in is not configured yet. Ask your administrator to set up Google OAuth or enable development login.')}
            </p>
            <a
              href="/equipment"
              className="block w-full py-2.5 rounded-lg text-sm font-medium text-center
                         border border-mytra-border text-fg-2 hover:bg-mytra-card-hover transition-colors"
            >
              {t('auth.browseEquipment', undefined, 'Browse equipment without signing in')}
            </a>
          </div>
        )}
        <p className="text-xs text-fg-4 text-center mt-4">
          {t('auth.agreePrefix', undefined, 'By signing in you agree to our')}{' '}
          <a href="/terms" className="text-mytra-purple hover:underline">{t('auth.terms', undefined, 'Terms')}</a>
          {' '}{t('common.and', undefined, 'and')}{' '}
          <a href="/privacy" className="text-mytra-purple hover:underline">{t('auth.privacy', undefined, 'Privacy Policy')}</a>.
        </p>
      </div>
      </div>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  // relative + overflow-hidden bounds the decorative sign-in glow (a fixed
  // 520px circle) to this section so it can never cause horizontal scroll on
  // phones — same containment pattern as the beta page backdrop.
  return (
    <div className="relative w-full overflow-hidden min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      {children}
    </div>
  )
}
