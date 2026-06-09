/**
 * Tracks known users to detect first-time logins.
 * Uses Vercel KV when available, in-memory Set for local dev.
 */

import { kv } from '@vercel/kv'

const KV_KEY = 'known-users'

function kvEnabled(): boolean {
  return !!process.env.KV_REST_API_URL
}

const memSet = new Set<string>()

export async function isFirstLogin(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase()

  if (kvEnabled()) {
    const added = await kv.sadd(KV_KEY, normalized)
    return added === 1
  }

  if (memSet.has(normalized)) return false
  memSet.add(normalized)
  return true
}
