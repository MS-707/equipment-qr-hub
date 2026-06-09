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

export function rateLimit(
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
