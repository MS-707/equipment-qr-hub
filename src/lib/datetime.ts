/** Helpers for <input type="datetime-local"> ↔ ISO conversion. */

import { getStoredLocale, type Locale } from '@/lib/i18n-core'

// Locale-aware date formatting (ES-7): 'es' renders es-419 (16 jul 2026),
// 'en' keeps the historical en-US output byte-identical. Callers rendering a
// RECORD pass the record's locale stamp; live-UI callers may omit the param
// (stored device preference). The kill switch gates COPY, not date shapes —
// a worker who chose es keeps es dates even when translations are pulled.
const DATE_LOCALE: Record<Locale, string> = { en: 'en-US', es: 'es-419' }

/** Format a Date as a `datetime-local` value (local time, no timezone). */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Parse a `datetime-local` (or any parseable) value into an ISO string; falls back to now. */
export function toIso(local: string): string {
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

export function formatDate(iso: string, locale: Locale = getStoredLocale()): string {
  return new Date(iso).toLocaleDateString(DATE_LOCALE[locale], { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(iso: string, locale: Locale = getStoredLocale()): string {
  return new Date(iso).toLocaleDateString(DATE_LOCALE[locale], {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

/** Time-only variant (e.g. crew signature rows). */
export function formatTime(iso: string, locale: Locale = getStoredLocale()): string {
  return new Date(iso).toLocaleTimeString(DATE_LOCALE[locale], { hour: 'numeric', minute: '2-digit' })
}

/** Long weekday form (dashboard header). */
export function formatLongDate(d: Date, locale: Locale = getStoredLocale()): string {
  return d.toLocaleDateString(DATE_LOCALE[locale], { weekday: 'long', month: 'long', day: 'numeric' })
}

/** Today's date as YYYY-MM-DD in the device's local timezone. */
export function localToday(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Now and now+`hours`, as datetime-local input values — convenient permit defaults. */
export function defaultValidityWindow(hours = 8): { from: string; until: string } {
  const now = new Date()
  const until = new Date(now.getTime() + hours * 60 * 60 * 1000)
  return { from: toLocalInput(now), until: toLocalInput(until) }
}
