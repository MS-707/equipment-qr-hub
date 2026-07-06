/**
 * Role resolution — server-side authoritative. Three roles with strict
 * precedence: admin > ehs > worker.
 *
 * - admin: ADMIN_EMAILS allowlist (see lib/admin.ts) — system configuration,
 *   beta decisions, audit access.
 * - ehs:   EHS_EMAILS allowlist — can decide EHS reviews in-app without an
 *   email link.
 * - worker: everyone else with an allowed-domain login.
 *
 * Env is read lazily (per call, not at module load) so tests can stub
 * EHS_EMAILS without module-cache gymnastics; these calls are O(list size)
 * on a handful of emails.
 */

import { isAdmin } from '@/lib/admin'

export type Role = 'admin' | 'ehs' | 'worker'

function ehsEmails(): Set<string> {
  return new Set(
    (process.env.EHS_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  )
}

export function resolveRole(email: string | null | undefined): Role {
  if (!email) return 'worker'
  const e = email.trim().toLowerCase()
  if (isAdmin(e)) return 'admin'
  if (ehsEmails().has(e)) return 'ehs'
  return 'worker'
}

export function isEhsOrAdmin(email: string | null | undefined): boolean {
  const role = resolveRole(email)
  return role === 'admin' || role === 'ehs'
}
