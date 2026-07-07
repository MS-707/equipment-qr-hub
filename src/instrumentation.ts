/**
 * Next.js instrumentation hook — the ONLY place @sentry/nextjs v10 loads its
 * server/edge init on Next 14 (the sentry.*.config.ts files do nothing unless
 * imported here). Each config no-ops when NEXT_PUBLIC_SENTRY_DSN is unset, so
 * this file is safe in every environment.
 */
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
