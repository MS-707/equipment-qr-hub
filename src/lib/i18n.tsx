'use client'

/**
 * i18n provider — revival of the June attempt with its defects fixed
 * (docs/i18n/DESIGN.md is the binding spec; the failure autopsy lives there).
 * The pure translation core (resolve/interpolate/plural/fallback) lives in
 * src/lib/i18n-core.ts so lib code and tests never import JSX; this file owns
 * only the React state:
 *
 * - Hydration-safe: state starts 'en' (matches SSR) and the stored locale is
 *   applied in useLayoutEffect — synchronous pre-paint, no English flash.
 * - Kill switch: /api/i18n/status ({esEnabled, suppressedNamespaces}) is
 *   fetched on mount AND on foreground so a bad translation can be pulled
 *   fleet-wide in minutes without a deploy (see docs/i18n/OPERATIONS.md,
 *   lands with ES-M6). Last-known-good persists for offline starts.
 */

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import {
  DEFAULT_FLAGS,
  FLAG_STORAGE_KEY,
  LOCALE_STORAGE_KEY,
  effectiveLocale,
  getT,
  type I18nFlags,
  type Locale,
  type TFunction,
} from '@/lib/i18n-core'

export {
  DEFAULT_FLAGS,
  FLAG_STORAGE_KEY,
  LOCALE_STORAGE_KEY,
  getT,
  type I18nFlags,
  type Locale,
  type TFunction,
}

interface I18nCtx {
  locale: Locale
  setLocale: (l: Locale) => void
  flags: I18nFlags
  t: TFunction
}

const Ctx = createContext<I18nCtx>({
  locale: 'en',
  setLocale: () => {},
  flags: DEFAULT_FLAGS,
  t: (key, vars, defaultEn) => getT('en')(key, vars, defaultEn),
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')
  const [flags, setFlags] = useState<I18nFlags>(DEFAULT_FLAGS)

  // Pre-paint (synchronous) read of the stored locale — no English flash,
  // no hydration mismatch (initial render state matches SSR's 'en').
  useLayoutEffect(() => {
    try {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
      if (saved === 'es') setLocaleState('es')
      const savedFlags = localStorage.getItem(FLAG_STORAGE_KEY)
      if (savedFlags) setFlags({ ...DEFAULT_FLAGS, ...JSON.parse(savedFlags) })
    } catch { /* storage unavailable */ }
  }, [])

  // Kill-switch flags: mount + every return to foreground (field PWAs stay
  // open for whole shifts — mount-only would delay a pull by hours).
  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      fetch('/api/i18n/status')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled || !data) return
          const next: I18nFlags = {
            esEnabled: data.esEnabled !== false,
            suppressedNamespaces: Array.isArray(data.suppressedNamespaces) ? data.suppressedNamespaces : [],
          }
          setFlags(next)
          try { localStorage.setItem(FLAG_STORAGE_KEY, JSON.stringify(next)) } catch { /* full */ }
        })
        .catch(() => { /* offline — last-known-good stands */ })
    }
    refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    try { localStorage.setItem(LOCALE_STORAGE_KEY, l) } catch { /* full */ }
    document.documentElement.lang = effectiveLocale(l, flags)
  }, [flags])

  useEffect(() => {
    document.documentElement.lang = effectiveLocale(locale, flags)
  }, [locale, flags])

  const t = useCallback<TFunction>((key, vars, defaultEn) => getT(locale, flags)(key, vars, defaultEn), [locale, flags])

  return <Ctx.Provider value={{ locale, setLocale, flags, t }}>{children}</Ctx.Provider>
}

export function useT(): TFunction {
  return useContext(Ctx).t
}

export function useLocale() {
  const { locale, setLocale, flags } = useContext(Ctx)
  return { locale, setLocale, flags }
}
