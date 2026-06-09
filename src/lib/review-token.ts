import { createHmac } from 'crypto'

const SECRET = process.env.NEXTAUTH_SECRET || process.env.REVIEW_TOKEN_SECRET || 'sage-ehs-review-fallback'

export function createReviewToken(recordId: string, action: 'approve' | 'reject'): string {
  const payload = `${recordId}:${action}:${Math.floor(Date.now() / 1000)}`
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 16)
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
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

    const expected = createHmac('sha256', SECRET).update(`${recordId}:${action}:${tsStr}`).digest('hex').slice(0, 16)
    if (sig !== expected) return null

    return { recordId, action, ts }
  } catch {
    return null
  }
}
