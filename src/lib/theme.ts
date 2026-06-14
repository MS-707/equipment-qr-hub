'use client'

import { useState, useEffect, useCallback } from 'react'

export type ThemePreference = 'dark' | 'light' | 'auto'
export type ResolvedTheme = 'dark' | 'light'

const STORAGE_KEY = 'sage-theme'
const THEME_COLORS: Record<ResolvedTheme, string> = {
  dark: '#0A0A0A',
  light: '#FFFFFF',
}

export function getStoredTheme(): ThemePreference {
  try {
    const val = localStorage.getItem(STORAGE_KEY)
    if (val === 'dark' || val === 'light' || val === 'auto') return val
  } catch {}
  return 'auto'
}

export function setStoredTheme(theme: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {}
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === 'dark' || pref === 'light') return pref
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.dataset.theme = resolved
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLORS[resolved])
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') return 'auto'
    return getStoredTheme()
  })

  const resolvedTheme = resolveTheme(theme)

  const setTheme = useCallback((next: ThemePreference) => {
    setStoredTheme(next)
    setThemeState(next)
    applyTheme(resolveTheme(next))
  }, [])

  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    if (theme !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme(resolveTheme('auto'))
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return { theme, resolvedTheme, setTheme } as const
}
