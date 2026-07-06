/**
 * Structured server logging: one JSON line per event so Vercel log drains
 * (and any future collector) can filter on fields instead of regexing prose.
 *
 * This module is the ONLY sanctioned console call site for server code —
 * route files must log through log() or reportServerError (EN-7). Never put
 * secrets or full request bodies in fields; names/emails only where the
 * legacy logs already carried them.
 */

type Level = 'info' | 'warn' | 'error'

export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  // route and outcome are first-class keys on every line (EN-7) so log
  // queries can always filter on them, even when a caller omits them.
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    route: fields.route ?? null,
    outcome: fields.outcome ?? null,
    ...fields,
  })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}
