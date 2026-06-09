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

const store = new Map<string, ReviewSubmission>()

export function storeReviewSubmission(data: {
  recordId: string
  recordType: SafetyRecordType
  projectName: string
  location: string
  submitterName: string
  submitterEmail: string
}): ReviewSubmission {
  const submission: ReviewSubmission = {
    ...data,
    recordLabel: SAFETY_TYPE_LABELS[data.recordType] ?? data.recordType,
    submittedAt: new Date().toISOString(),
    status: 'pending',
  }
  store.set(data.recordId, submission)
  return submission
}

export function getReviewSubmission(recordId: string): ReviewSubmission | undefined {
  return store.get(recordId)
}

export function decideReview(
  recordId: string,
  action: 'approved' | 'rejected',
  decidedBy: string,
  note?: string
): ReviewSubmission | undefined {
  const sub = store.get(recordId)
  if (!sub) return undefined
  if (sub.status !== 'pending') return sub
  sub.status = action
  sub.decidedAt = new Date().toISOString()
  sub.decidedBy = decidedBy
  sub.note = note
  return sub
}
