import { verifyReviewToken } from '@/lib/review-token'
import { getReviewSubmission, decideReview } from '@/lib/review-store'
import { isEmailConfigured } from '@/lib/email-notify'
import { rateLimit } from '@/lib/rate-limit'
import { ReviewDecideBodySchema } from '@/lib/beta-decide-schemas'
import { fetchWithTimeout } from '@/lib/fetch-timeout'
import { reportServerError } from '@/lib/report-error'
import { appendAudit } from '@/lib/audit-log'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { isEhsOrAdmin } from '@/lib/roles'

const RESEND_URL = 'https://api.resend.com/emails'

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_EHS_REVIEW !== '1') {
    return Response.json({ error: 'EHS review is not enabled' }, { status: 404 })
  }

  const ip =
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean).pop() ??
    'unknown'
  const rl = await rateLimit(`review-decide:${ip}`, 10, 60_000)
  if (!rl.ok) {
    return Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch (err) {
    reportServerError('api/safety/review/decide', err)
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsedBody = ReviewDecideBodySchema.safeParse(raw)
  if (!parsedBody.success) {
    // The only fatal schema failure is the token (note is .catch-tolerant),
    // so the pre-schema error message still fits.
    return Response.json({ error: 'Missing token' }, { status: 400 })
  }
  const { token, note, recordId: bodyRecordId, action: bodyAction } = parsedBody.data

  // Two authorization paths: the HMAC email-link token (EHS decides from
  // their inbox, no session), or a signed-in session with the ehs/admin
  // role deciding in-app (EN-9). Workers get 403 on the session path.
  let target: { recordId: string; action: 'approve' | 'reject' }
  let actor = 'EHS reviewer (via email link)'
  if (token) {
    const parsed = verifyReviewToken(token)
    if (!parsed) {
      return Response.json({ error: 'Invalid or expired link. Review links expire after 24 hours.' }, { status: 403 })
    }
    target = { recordId: parsed.recordId, action: parsed.action }
  } else if (bodyRecordId && bodyAction) {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email
    if (!email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isEhsOrAdmin(email)) {
      return Response.json({ error: 'EHS or admin role required' }, { status: 403 })
    }
    target = { recordId: bodyRecordId, action: bodyAction }
    actor = email
  } else {
    return Response.json({ error: 'Missing token' }, { status: 400 })
  }

  let submission
  try {
    submission = await getReviewSubmission(target.recordId)
  } catch (err) {
    reportServerError('api/safety/review/decide', err)
    return Response.json({ error: 'Storage temporarily unavailable, try again shortly' }, { status: 503 })
  }
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

  const status = target.action === 'approve' ? 'approved' as const : 'rejected' as const
  // note is already truncated to 500 chars by ReviewDecideBodySchema
  let decided
  try {
    decided = await decideReview(target.recordId, status, actor, note)
  } catch (err) {
    reportServerError('api/safety/review/decide', err)
    return Response.json({ error: 'Storage temporarily unavailable, try again shortly' }, { status: 503 })
  }
  if (!decided) {
    return Response.json({ error: 'Failed to record decision' }, { status: 500 })
  }

  await appendAudit({ actor, action: `review-${status}`, target: target.recordId })

  // Propagate the decision to the record's Notion page (best-effort): the
  // device poller reads the 'EHS Review' property, so without this PATCH an
  // email-link decision left the worker's local record "Awaiting sign-on"
  // forever. The decision itself stands even if Notion is down.
  await patchNotionDecision(decided)

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

  const ip =
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean).pop() ??
    'unknown'
  const rl = await rateLimit(`review-decide:${ip}`, 10, 60_000)
  if (!rl.ok) {
    return Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })
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

  let submission
  try {
    submission = await getReviewSubmission(parsed.recordId)
  } catch (err) {
    reportServerError('api/safety/review/decide', err)
    return Response.json({ error: 'Storage temporarily unavailable, try again shortly' }, { status: 503 })
  }
  if (!submission) {
    return Response.json({ error: 'Submission not found' }, { status: 404 })
  }

  if (submission.status !== 'pending') {
    return Response.json({
      recordId: submission.recordId,
      status: submission.status,
      action: parsed.action,
    })
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

async function patchNotionDecision(sub: import('@/lib/review-store').ReviewSubmission): Promise<void> {
  const key = process.env.NOTION_API_KEY
  if (!key || !sub.notionPageId) return
  try {
    const properties: Record<string, unknown> = {
      'EHS Review': { select: { name: sub.status === 'approved' ? 'Approved' : 'Rejected' } },
      'Reviewed By': { rich_text: [{ text: { content: (sub.decidedBy ?? 'EHS reviewer').slice(0, 200) } }] },
    }
    if (sub.note) {
      properties['EHS Review Note'] = { rich_text: [{ text: { content: sub.note.slice(0, 500) } }] }
    }
    const res = await fetchWithTimeout(`https://api.notion.com/v1/pages/${sub.notionPageId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${key}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties }),
    })
    if (!res.ok) reportServerError('api/safety/review/decide', new Error(`Notion PATCH error: ${await res.text()}`))
  } catch (e) {
    reportServerError('api/safety/review/decide', e)
  }
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
    const res = await fetchWithTimeout(RESEND_URL, {
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
      reportServerError('api/safety/review/decide', new Error(`email error: ${await res.text()}`))
      return false
    }
    return true
  } catch (e) {
    reportServerError('api/safety/review/decide', e)
    return false
  }
}
