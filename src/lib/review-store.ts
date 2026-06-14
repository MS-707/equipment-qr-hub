import { kv } from '@/lib/kv'
import { SAFETY_TYPE_LABELS, type SafetyRecordType } from '@/lib/safety-types'

export interface ReviewSubmission {
  recordId: string
  recordType: SafetyRecordType
  recordLabel: string
  projectName: string
  location: string
  submitterName: string
  submitterEmail: string
  submittedAt: string
  status: 'pending' | 'approved' | 'rejected'
  decidedAt?: string
  decidedBy?: string
  note?: string
}

const KV_PREFIX = 'review:'

function kvEnabled(): boolean {
  return !!process.env.KV_REST_API_URL
}

const memStore = new Map<string, ReviewSubmission>()

export async function storeReviewSubmission(data: {
  recordId: string
  recordType: SafetyRecordType
  projectName: string
  location: string
  submitterName: string
  submitterEmail: string
}): Promise<ReviewSubmission> {
  const submission: ReviewSubmission = {
    ...data,
    recordLabel: SAFETY_TYPE_LABELS[data.recordType] ?? data.recordType,
    submittedAt: new Date().toISOString(),
    status: 'pending',
  }
  if (kvEnabled()) {
    await kv.set(`${KV_PREFIX}${data.recordId}`, submission, { ex: 60 * 60 * 24 * 7 })
  } else {
    memStore.set(data.recordId, submission)
  }
  return submission
}

export async function getReviewSubmission(recordId: string): Promise<ReviewSubmission | undefined> {
  if (kvEnabled()) {
    return await kv.get<ReviewSubmission>(`${KV_PREFIX}${recordId}`) ?? undefined
  }
  return memStore.get(recordId)
}

export async function decideReview(
  recordId: string,
  action: 'approved' | 'rejected',
  decidedBy: string,
  note?: string
): Promise<ReviewSubmission | undefined> {
  const cappedNote = note ? note.slice(0, 500) : undefined

  if (kvEnabled()) {
    const lockKey = `${KV_PREFIX}${recordId}:decided`
    const locked = await kv.set(lockKey, action, { nx: true, ex: 60 * 60 * 24 * 30 })
    if (!locked) {
      return await kv.get<ReviewSubmission>(`${KV_PREFIX}${recordId}`) ?? undefined
    }
    const sub = await kv.get<ReviewSubmission>(`${KV_PREFIX}${recordId}`)
    if (!sub) return undefined
    sub.status = action
    sub.decidedAt = new Date().toISOString()
    sub.decidedBy = decidedBy
    sub.note = cappedNote
    await kv.set(`${KV_PREFIX}${recordId}`, sub, { ex: 60 * 60 * 24 * 30 })
    return sub
  }

  const sub = memStore.get(recordId)
  if (!sub) return undefined
  if (sub.status !== 'pending') return sub
  sub.status = action
  sub.decidedAt = new Date().toISOString()
  sub.decidedBy = decidedBy
  sub.note = cappedNote
  return sub
}
