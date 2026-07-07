/**
 * Client-safe identity cache.
 *
 * On a successful sign-in, AuthGate persists a minimal identity snapshot here.
 * This is the OFFLINE IDENTITY CACHE: after one verified login, the device
 * remembers who is signed in so users can complete and attribute safety records
 * with no network. Records created offline carry this identity and sync later.
 *
 * Kept separate from lib/auth.ts so client bundles never pull in next-auth's
 * server providers.
 */

import { safeParseIdentity } from '@/lib/schemas'

export interface Identity {
  name: string
  email: string | null
  image: string | null
  verifiedAt: string
}

export const CURRENT_USER_KEY = 'eqr-current-user'

export function setCurrentIdentity(id: { name: string; email?: string | null; image?: string | null }): void {
  if (typeof window === 'undefined') return
  const payload: Identity = {
    name: id.name,
    email: id.email ?? null,
    image: id.image ?? null,
    verifiedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(payload))
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

// Hard ceiling: after this, offline capture is locked until the worker can
// re-verify online. 30 days covers remote-site rotations; the owner may
// prefer a shorter window — see docs/roadmap/goals.json UX-9 notes.
const IDENTITY_TTL_MS = 30 * 24 * 60 * 60 * 1000
// Soft threshold: past this the identity still works offline but AuthGate
// shows a verify-when-online warning.
const IDENTITY_AGING_MS = 72 * 60 * 60 * 1000

export function getCurrentIdentity(): Identity | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY)
    if (!raw) return null
    return safeParseIdentity(raw)
  } catch {
    return null
  }
}

export function isIdentityStale(): boolean {
  const id = getCurrentIdentity()
  if (!id?.verifiedAt) return true
  return Date.now() - new Date(id.verifiedAt).getTime() > IDENTITY_TTL_MS
}

/** Older than the soft threshold but still within the hard TTL: usable
 *  offline, worth a "verify when you're back online" nudge. */
export function isIdentityAging(): boolean {
  const id = getCurrentIdentity()
  if (!id?.verifiedAt) return false
  const age = Date.now() - new Date(id.verifiedAt).getTime()
  return age > IDENTITY_AGING_MS && age <= IDENTITY_TTL_MS
}

export function clearCurrentIdentity(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(CURRENT_USER_KEY)
  } catch {
    /* non-fatal */
  }
}
