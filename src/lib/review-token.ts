import { createHmac, timingSafeEqual } from 'crypto'

/**
 * HMAC-signed, expiring tokens for the emailed approve/reject review links.
 * The decide endpoint is unauthenticated by design (one-tap from email), so
 * the token signature is the entire authorization — there is deliberately no
 * fallback secret: forging a token would forge an EHS approval.
 */
function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.REVIEW_TOKEN_SECRET
  if (!secret) {
    throw new Error(
      'review-token: NEXTAUTH_SECRET or REVIEW_TOKEN_SECRET must be set — refusing to sign or verify review tokens without a secret'
    )
  }
  return secret
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex')
}

export function createReviewToken(recordId: string, action: 'approve' | 'reject'): string {
  const payload = `${recordId}:${action}:${Math.floor(Date.now() / 1000)}`
  return Buffer.from(`${payload}:${sign(payload)}`).toString('base64url')
}

export function verifyReviewToken(token: string): { recordId: string; action: 'approve' | 'reject'; ts: number } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const parts = decoded.split(':')
    if (parts.length !== 4) return null
    const [recordId, action, tsStr, sig] = parts
    if (action !== 'approve' && action !== 'reject') return null
    const ts = parseInt(tsStr, 10)
    if (isNaN(ts)) return null

    // Token expires after 7 days
    const age = Math.floor(Date.now() / 1000) - ts
    if (age > 7 * 24 * 60 * 60) return null

    const expected = Buffer.from(sign(`${recordId}:${action}:${tsStr}`))
    const provided = Buffer.from(sig)
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null

    return { recordId, action, ts }
  } catch {
    return null
  }
}
