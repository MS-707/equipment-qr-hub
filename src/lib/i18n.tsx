'use client'

/**
 * i18n provider — revival of the June attempt with its defects fixed
 * (docs/i18n/DESIGN.md is the binding spec; the failure autopsy lives there):
 *
 * - Interpolation replaces ALL occurrences (split/join, no regex escaping).
 * - Plurals via Intl.PluralRules: keys with {count} may define `.one`/`.other`
 *   siblings; t() picks the right variant — no "(s)" hacks in safety copy.
 * - Typed keys: t()'s key param is the generated union in i18n-keys.d.ts
 *   (scripts/gen-i18n-keys.mjs), so a typo is a tsc error.
 * - Storage key is sage-locale-v2 — v1 ('sage-locale') is still purged by a
 *   legacy cleanup and must never be reused. Future breaking changes bump to
 *   v3 and IGNORE v2; never another purge-on-every-load.
 * - Hydration-safe: state starts 'en' (matches SSR) and the stored locale is
 *   applied in useLayoutEffect — synchronous pre-paint, no English flash.
 * - Kill switch: /api/i18n/status ({esEnabled, suppressedNamespaces}) is
 *   fetched on mount AND on foreground so a bad translation can be pulled
 *   fleet-wide in minutes without a deploy (see docs/i18n/OPERATIONS.md,
 *   lands with ES-M6). Last-known-good persists for offline starts.
 * - Dev-only diagnostics: missing keys and unreplaced {vars} warn in
 *   development; production stays silent (fallback chain: locale → en → key).
 */

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import en from '@/messages/en.json'
import es from '@/messages/es.json'
import type { MessageKey } from '@/lib/i18n-keys'

export type Locale = 'en' | 'es'

export const LOCALE_STORAGE_KEY = 'sage-locale-v2'
export const FLAG_STORAGE_KEY = 'sage-i18n-flag-v1'

type MessageTree = { [key: string]: string | MessageTree }
const bundles: Record<Locale, MessageTree> = { en: en as MessageTree, es: es as MessageTree }

export type I18nFlags = { esEnabled: boolean; suppressedNamespaces: string[] }
const DEFAULT_FLAGS: I18nFlags = { esEnabled: true, suppressedNamespaces: [] }

function resolve(tree: MessageTree, key: string): string | undefined {
  let node: MessageTree | string | undefined = tree
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = node[part]
  }
  return typeof node === 'string' ? node : undefined
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return warnUnreplaced(template)
  let out = template
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v))
  }
  return warnUnreplaced(out)
}

function warnUnreplaced(s: string): string {
  if (process.env.NODE_ENV !== 'production' && /\{[a-zA-Z0-9_]+\}/.test(s)) {
    console.warn(`[i18n] unreplaced variable in "${s}"`)
  }
  return s
}

export type TFunction = (key: MessageKey, vars?: Record<string, string | number>, defaultEn?: string) => string

/** Non-hook translator for lib code (date labels, share text). */
export function getT(locale: Locale, flags: I18nFlags = DEFAULT_FLAGS): TFunction {
  const effective = effectiveLocale(locale, flags)
  return (key, vars, defaultEn) => {
    const ns = key.split('.')[0]
    const useEs = effective === 'es' && !flags.suppressedNamespaces.includes(ns)
    let template = useEs ? resolve(bundles.es, key) : undefined
    if (template === undefined) template = resolve(bundles.en, key)
    if (template === undefined) {
      if (process.env.NODE_ENV !== 'production') console.warn(`[i18n] missing key "${key}"`)
      template = defaultEn ?? key
    }
    // Plural selection: template may be a parent of .one/.other variants
    if (vars && typeof vars.count === 'number') {
      const branch = new Intl.PluralRules(effective).select(vars.count) === 'one' ? 'one' : 'other'
      const variant = useEs ? resolve(bundles.es, `${key}.${branch}`) : resolve(bundles.en, `${key}.${branch}`)
      const fallbackVariant = resolve(bundles.en, `${key}.${branch}`)
      if (variant !== undefined || fallbackVariant !== undefined) template = (variant ?? fallbackVariant)!
    }
    return interpolate(template, vars)
  }
}

function effectiveLocale(locale: Locale, flags: I18nFlags): Locale {
  return flags.esEnabled ? locale : 'en'
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
