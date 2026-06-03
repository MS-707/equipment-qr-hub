/** Helpers for <input type="datetime-local"> ↔ ISO conversion. */

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

/** Now and now+`hours`, as datetime-local input values — convenient permit defaults. */
export function defaultValidityWindow(hours = 8): { from: string; until: string } {
  const now = new Date()
  const until = new Date(now.getTime() + hours * 60 * 60 * 1000)
  return { from: toLocalInput(now), until: toLocalInput(until) }
}
