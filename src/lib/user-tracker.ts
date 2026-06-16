/**
 * Tracks known users to detect first-time logins.
 * Uses Vercel KV when available, in-memory Set for local dev.
 */

import { kv } from '@/lib/kv'

const KV_KEY = 'known-users'
const KV_TTL_SECONDS = 90 * 24 * 3600 // 90 days

function kvEnabled(): boolean {
  return !!process.env.KV_REST_API_URL
}

const memSet = new Set<string>()

export async function isFirstLogin(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase()

  if (kvEnabled()) {
    const added = await kv.sadd(KV_KEY, normalized)
    await kv.expire(KV_KEY, KV_TTL_SECONDS)
    return added === 1
  }

  if (memSet.has(normalized)) return false
  memSet.add(normalized)
  return true
}
