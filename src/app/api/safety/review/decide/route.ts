import { verifyReviewToken } from '@/lib/review-token'
import { getReviewSubmission, decideReview } from '@/lib/review-store'
import { isEmailConfigured } from '@/lib/email-notify'
import { rateLimit } from '@/lib/rate-limit'
import { ReviewDecideBodySchema } from '@/lib/beta-decide-schemas'

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
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsedBody = ReviewDecideBodySchema.safeParse(raw)
  if (!parsedBody.success) {
    // The only fatal schema failure is the token (note is .catch-tolerant),
    // so the pre-schema error message still fits.
    return Response.json({ error: 'Missing token' }, { status: 400 })
  }
  const { token, note } = parsedBody.data

  const parsed = verifyReviewToken(token)
  if (!parsed) {
    return Response.json({ error: 'Invalid or expired link. Review links expire after 24 hours.' }, { status: 403 })
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

  const status = parsed.action === 'approve' ? 'approved' as const : 'rejected' as const
  // note is already truncated to 500 chars by ReviewDecideBodySchema
  const decided = await decideReview(parsed.recordId, status, 'EHS reviewer (via email link)', note)
  if (!decided) {
    return Response.json({ error: 'Failed to record decision' }, { status: 500 })
  }

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

  const submission = await getReviewSubmission(parsed.recordId)
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
    const res = await fetch(`https://api.notion.com/v1/pages/${sub.notionPageId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${key}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties }),
    })
    if (!res.ok) console.error('[review-decide] Notion PATCH error:', await res.text())
  } catch (e) {
    console.error('[review-decide] Notion PATCH failed:', e instanceof Error ? e.message : e)
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
