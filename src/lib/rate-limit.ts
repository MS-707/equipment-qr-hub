const windows = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { ok: boolean; retryAfter: number } {
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
