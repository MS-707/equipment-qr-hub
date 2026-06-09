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

const IDENTITY_TTL_MS = 72 * 60 * 60 * 1000

export function getCurrentIdentity(): Identity | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY)
    if (!raw) return null
    const id = JSON.parse(raw) as Identity
    if (id.verifiedAt && Date.now() - new Date(id.verifiedAt).getTime() > IDENTITY_TTL_MS) {
      localStorage.removeItem(CURRENT_USER_KEY)
      return null
    }
    return id
  } catch {
    return null
  }
}

export function clearCurrentIdentity(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(CURRENT_USER_KEY)
  } catch {
    /* non-fatal */
  }
}
