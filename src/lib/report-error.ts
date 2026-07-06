/**
 * Server-side error reporting: one call logs to the function console AND
 * captures to Sentry with a scope tag. Safe when Sentry is not initialized
 * (NEXT_PUBLIC_SENTRY_DSN unset → captureException is a no-op), and reporting
 * itself must never throw — a broken reporter cannot be allowed to turn a
 * degraded response into a crashed handler.
 */
import * as Sentry from '@sentry/nextjs'

export function reportServerError(scope: string, err: unknown): void {
  console.error(`[${scope}]`, err instanceof Error ? err.message : err)
  try {
    Sentry.captureException(err, { tags: { scope } })
  } catch {
    // never throw from the reporter
  }
}
