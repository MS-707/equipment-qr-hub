'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import en from '@/messages/en.json'
import es from '@/messages/es.json'

export type Locale = 'en' | 'es'

const STORAGE_KEY = 'sage-locale'

type MessageTree = { [key: string]: string | MessageTree }

const bundles: Record<Locale, MessageTree> = { en, es }

function resolve(tree: MessageTree, key: string): string | undefined {
  const parts = key.split('.')
  let node: MessageTree | string = tree
  for (const p of parts) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as MessageTree)[p]
  }
  return typeof node === 'string' ? node : undefined
}

interface I18nCtx {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const Ctx = createContext<I18nCtx>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === 'undefined') return 'en'
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'es' ? 'es' : 'en'
  })

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    localStorage.setItem(STORAGE_KEY, l)
    document.documentElement.lang = l
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      let str = resolve(bundles[locale], key) ?? resolve(bundles.en, key) ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(`{${k}}`, String(v))
        }
      }
      return str
    },
    [locale],
  )

  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>
}

export function useT() {
  const { t } = useContext(Ctx)
  return t
}

export function useLocale() {
  return useContext(Ctx)
}
