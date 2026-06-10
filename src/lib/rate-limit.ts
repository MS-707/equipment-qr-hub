/**
 * Rate limiting backed by Vercel KV when available (shared across serverless
 * instances), with an in-memory fallback for local dev. The fallback is
 * per-instance only — on serverless it resets with every cold start, so KV
 * must be configured for limits to hold in production.
 *
 * KV failures fail open via the in-memory path: a degraded limiter should not
 * take safety tooling down with it.
 */

import { kv } from '@vercel/kv'

const windows = new Map<string, { count: number; resetAt: number }>()
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 60_000

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  windows.forEach((v, k) => {
    if (now >= v.resetAt) windows.delete(k)
  })
}

function memoryLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { ok: boolean; retryAfter: number } {
  cleanup()
  const now = Date.now()
  const entry = windows.get(key)

  if (!entry || now >= entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }

  if (entry.count >= maxRequests) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }

  entry.count++
  return { ok: true, retryAfter: 0 }
}

export async function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ ok: boolean; retryAfter: number }> {
  if (!process.env.KV_REST_API_URL) {
    return memoryLimit(key, maxRequests, windowMs)
  }

  try {
    const bucket = Math.floor(Date.now() / windowMs)
    const kvKey = `rl:${key}:${bucket}`
    const count = await kv.incr(kvKey)
    if (count === 1) {
      await kv.expire(kvKey, Math.ceil(windowMs / 1000) + 1)
    }
    if (count > maxRequests) {
      const retryAfter = Math.ceil(((bucket + 1) * windowMs - Date.now()) / 1000)
      return { ok: false, retryAfter: Math.max(retryAfter, 1) }
    }
    return { ok: true, retryAfter: 0 }
  } catch (e) {
    console.error('[rate-limit] KV error, using in-memory fallback:', e instanceof Error ? e.message : e)
    return memoryLimit(key, maxRequests, windowMs)
  }
}
