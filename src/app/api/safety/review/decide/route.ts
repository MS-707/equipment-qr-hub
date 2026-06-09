import { verifyReviewToken } from '@/lib/review-token'
import { getReviewSubmission, decideReview } from '@/lib/review-store'
import { isEmailConfigured } from '@/lib/email-notify'

const RESEND_URL = 'https://api.resend.com/emails'

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_EHS_REVIEW !== '1') {
    return Response.json({ error: 'EHS review is not enabled' }, { status: 404 })
  }

  let body: { token: string; note?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { token, note } = body
  if (!token || typeof token !== 'string') {
    return Response.json({ error: 'Missing token' }, { status: 400 })
  }

  const parsed = verifyReviewToken(token)
  if (!parsed) {
    return Response.json({ error: 'Invalid or expired link. Review links expire after 7 days.' }, { status: 403 })
  }

  const submission = await getReviewSubmission(parsed.recordId)
  if (!submission) {
    return Response.json({ error: 'Review submission not found. It may have expired.' }, { status: 404 })
  }

  if (submission.status !== 'pending') {
    return Response.json({
      ok: true,
      alreadyDecided: true,
      status: submission.status,
      recordId: submission.recordId,
      recordLabel: submission.recordLabel,
    })
  }

  const adminEmail = process.env.EHS_NOTIFY_EMAIL || 'mark.starr@mytra.ai'
  const status = parsed.action === 'approve' ? 'approved' as const : 'rejected' as const
  const decided = await decideReview(parsed.recordId, status, adminEmail, note)
  if (!decided) {
    return Response.json({ error: 'Failed to record decision' }, { status: 500 })
  }

  let emailed = false
  if (isEmailConfigured() && decided.submitterEmail) {
    emailed = await sendDecisionEmail(decided)
  }

  return Response.json({
    ok: true,
    alreadyDecided: false,
    status: decided.status,
    recordId: decided.recordId,
    recordLabel: decided.recordLabel,
    employeeNotified: emailed,
  })
}

export async function GET(req: Request) {
  if (process.env.NEXT_PUBLIC_EHS_REVIEW !== '1') {
    return Response.json({ error: 'EHS review is not enabled' }, { status: 404 })
  }

  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) {
    return Response.json({ error: 'Missing token' }, { status: 400 })
  }

  const parsed = verifyReviewToken(token)
  if (!parsed) {
    return Response.json({ error: 'Invalid or expired link' }, { status: 403 })
  }

  const submission = await getReviewSubmission(parsed.recordId)
  if (!submission) {
    return Response.json({ error: 'Submission not found' }, { status: 404 })
  }

  return Response.json({
    recordId: submission.recordId,
    recordLabel: submission.recordLabel,
    projectName: submission.projectName,
    location: submission.location,
    submitterName: submission.submitterName,
    status: submission.status,
    action: parsed.action,
  })
}

async function sendDecisionEmail(sub: import('@/lib/review-store').ReviewSubmission): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || !sub.submitterEmail) return false

  const from = process.env.EHS_NOTIFY_FROM || 'Sage EHS <onboarding@resend.dev>'
  const firstName = sub.submitterName.split(' ')[0] || sub.submitterName
  const adminEmail = process.env.EHS_NOTIFY_EMAIL || 'mark.starr@mytra.ai'

  const isApproved = sub.status === 'approved'

  const subject = isApproved
    ? `Approved — ${sub.recordLabel} (${sub.recordId})`
    : `Action Needed — ${sub.recordLabel} (${sub.recordId})`

  const lines = isApproved
    ? [
        `Hi ${firstName},`,
        ``,
        `Your ${sub.recordLabel} has been reviewed and approved.`,
        ``,
        `Record: ${sub.recordId}`,
        `Project: ${sub.projectName || '—'}`,
        `Location: ${sub.location || '—'}`,
        sub.note ? `Note: ${sub.note}` : null,
        ``,
        `No further action is needed on your end.`,
        ``,
        `— Sage EHS`,
      ]
    : [
        `Hi ${firstName},`,
        ``,
        `Your ${sub.recordLabel} has been reviewed and requires revision.`,
        ``,
        `Record: ${sub.recordId}`,
        `Project: ${sub.projectName || '—'}`,
        `Location: ${sub.location || '—'}`,
        sub.note ? `Reviewer note: ${sub.note}` : null,
        ``,
        `Please reach out to EHS for more information (${adminEmail}).`,
        ``,
        `— Sage EHS`,
      ]

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: sub.submitterEmail,
        subject,
        text: lines.filter((l) => l !== null).join('\n'),
      }),
    })
    if (!res.ok) {
      console.error('[review-decide] email error:', await res.text())
      return false
    }
    return true
  } catch (e) {
    console.error('[review-decide] email failed:', e instanceof Error ? e.message : e)
    return false
  }
}
