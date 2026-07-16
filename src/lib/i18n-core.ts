/**
 * i18n core — pure TS, no React. The provider (src/lib/i18n.tsx) wraps this;
 * lib code (date labels, share text, toasts built outside components) imports
 * getT() from HERE so it never pulls JSX into non-React modules (ES-7).
 *
 * Design contract (docs/i18n/DESIGN.md is binding):
 * - Interpolation replaces ALL occurrences (split/join, no regex escaping).
 * - Plurals via Intl.PluralRules: keys with {count} may define `.one`/`.other`
 *   siblings; t() picks the right variant — no "(s)" hacks in safety copy.
 * - Typed keys: t()'s key param is the generated union in i18n-keys.d.ts
 *   (scripts/gen-i18n-keys.mjs), so a typo is a tsc error.
 * - Storage key is sage-locale-v2 — v1 ('sage-locale') is still purged by a
 *   legacy cleanup and must never be reused. Future breaking changes bump to
 *   v3 and IGNORE v2; never another purge-on-every-load.
 * - Dev-only diagnostics: missing keys and unreplaced {vars} warn in
 *   development; production stays silent (fallback chain: locale → en → key).
 */

import en from '@/messages/en.json'
import es from '@/messages/es.json'
import type { MessageKey } from '@/lib/i18n-keys'

export type Locale = 'en' | 'es'

export const LOCALE_STORAGE_KEY = 'sage-locale-v2'
export const FLAG_STORAGE_KEY = 'sage-i18n-flag-v1'

type MessageTree = { [key: string]: string | MessageTree }
const bundles: Record<Locale, MessageTree> = { en: en as MessageTree, es: es as MessageTree }

export type I18nFlags = { esEnabled: boolean; suppressedNamespaces: string[] }
export const DEFAULT_FLAGS: I18nFlags = { esEnabled: true, suppressedNamespaces: [] }

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

export function effectiveLocale(locale: Locale, flags: I18nFlags): Locale {
  return flags.esEnabled ? locale : 'en'
}

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
