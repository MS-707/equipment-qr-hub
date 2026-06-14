/**
 * Admin role check — server-side authoritative, client reads from session.
 *
 * Admin users can change equipment status, manage authorized users,
 * delete work orders, record PM completions, and access /admin routes.
 * Regular workers can view everything, submit inspections, and create
 * safety records, but cannot modify system configuration.
 *
 * Server: ADMIN_EMAILS env var (not NEXT_PUBLIC_ — never ships to client).
 * Client: session.user.isAdmin flag set by the NextAuth session callback.
 */

const ADMIN_EMAILS: Set<string> = new Set(
  (process.env.ADMIN_EMAILS ?? 'mark.starr@mytra.ai')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
)

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.has(email.trim().toLowerCase())
}
