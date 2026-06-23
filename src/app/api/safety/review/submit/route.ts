import type { SafetyRecord } from '@/lib/safety-types'
import { SAFETY_TYPE_LABELS } from '@/lib/safety-types'
import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'
import { sendEhsNotification, isEmailConfigured } from '@/lib/email-notify'
import { buildRecordSubject, buildRecordText } from '@/lib/record-share'
import { createReviewToken } from '@/lib/review-token'
import { storeReviewSubmission } from '@/lib/review-store'

const NOTION_VERSION = '2022-06-28'
const NOTION_ID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

function escapeSlack(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const DB_MAP: Record<string, string | undefined> = {
  'ptp': process.env.NOTION_PTP_DB_ID,
  'jha': process.env.NOTION_JHA_DB_ID || process.env.NOTION_PTP_DB_ID,
  'incident-report': process.env.NOTION_INCIDENTS_DB_ID,
  'height-permit': process.env.NOTION_PERMITS_DB_ID,
  'hot-work-permit': process.env.NOTION_PERMITS_DB_ID,
  'confined-space-permit': process.env.NOTION_PERMITS_DB_ID,
}

function dbForType(type: string): string | undefined {
  return DB_MAP[type]
}

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_EHS_REVIEW !== '1') {
    return Response.json({ error: 'EHS review is not enabled' }, { status: 404 })
  }

  const { session, error } = await requireSession()
  if (error) return error

  const rl = await rateLimit(`review:${session?.user?.email || 'unknown'}`, 5, 60_000)
  if (!rl.ok) {
    return Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })
  }

  const notionKey = process.env.NOTION_API_KEY
  const emailConfigured = isEmailConfigured()
  const slackUrl = process.env.SLACK_EHS_WEBHOOK_URL

  // At least one delivery channel must be configured, otherwise the submission
  // would silently go nowhere.
  if (!notionKey && !emailConfigured && !slackUrl) {
    return Response.json(
      { error: 'No EHS notification channel configured (set RESEND_API_KEY, NOTION_API_KEY, or SLACK_EHS_WEBHOOK_URL)' },
      { status: 503 }
    )
  }

  let body: { record: SafetyRecord; notionPageId: string | null }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { record, notionPageId } = body

  if (!record?.id || !record?.type) {
    return Response.json({ error: 'Missing record id or type' }, { status: 400 })
  }

  if (notionPageId && !NOTION_ID_RE.test(notionPageId)) {
    return Response.json({ error: 'Invalid Notion page ID' }, { status: 400 })
  }

  // ── Notion (optional record store) ───────────────────────────
  let pageId = notionPageId
  let notionOk = false
  if (notionKey) {
    try {
      if (!pageId) {
        const syncResult = await syncToNotion(notionKey, record)
        if (syncResult.ok) pageId = syncResult.pageId
      }
      if (pageId) {
        const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${notionKey}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ properties: { 'EHS Review': { select: { name: 'Pending' } } } }),
        })
        notionOk = res.ok
        if (!res.ok) console.error('[review/submit] Notion PATCH error:', await res.text())
      }
    } catch (e) {
      console.error('[review/submit] Notion error:', e instanceof Error ? e.message : e)
    }
  }

  // ── Store submission for email-based decisions ────────────────
  const sanitize = (s: unknown, max = 200) =>
    (typeof s === 'string' ? s : '').replace(/[\r\n]/g, ' ').slice(0, max)

  const submitterEmail = sanitize(record.createdByEmail || session?.user?.email || '', 200)
  await storeReviewSubmission({
    recordId: record.id,
    recordType: record.type,
    projectName: sanitize(record.projectName),
    location: sanitize(record.location),
    submitterName: sanitize(record.createdBy, 200) || 'Unknown',
    submitterEmail,
  })

  // ── Email notification (primary EHS channel) ─────────────────
  let emailed = false
  if (emailConfigured) {
    const appUrl = process.env.NEXTAUTH_URL || 'https://sage-ehs.mytra.ai'
    const approveToken = createReviewToken(record.id, 'approve')
    const rejectToken = createReviewToken(record.id, 'reject')
    const approveUrl = `${appUrl}/safety/review/action?token=${approveToken}`
    const rejectUrl = `${appUrl}/safety/review/action?token=${rejectToken}`

    const actionBlock = [
      '',
      '────────────────────',
      'QUICK ACTIONS',
      '',
      `  APPROVE: ${approveUrl}`,
      '',
      `  DENY:    ${rejectUrl}`,
      '',
      'Click a link above to approve or deny this record.',
      'The employee will be notified by email automatically.',
      'Links expire after 24 hours.',
      '────────────────────',
    ].join('\n')

    const outcome = await sendEhsNotification({
      subject: `EHS Review Requested — ${buildRecordSubject(record)}`,
      text: buildRecordText(record) + '\n' + actionBlock,
    })
    emailed = outcome === 'sent'
  }

  // ── Slack (best-effort) ──────────────────────────────────────
  let slackOk = false
  if (slackUrl) {
    const label = SAFETY_TYPE_LABELS[record.type] ?? record.type
    try {
      const slackRes = await fetch(slackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `📋 *EHS Review Requested*\n*${escapeSlack(label)}* — ${escapeSlack(record.id)}\n*Project:* ${escapeSlack(record.projectName || '')}\n*Location:* ${escapeSlack(record.location || '')}\n*Submitted by:* ${escapeSlack(record.createdBy || '')}`,
        }),
      })
      slackOk = slackRes.ok
    } catch {
      // Slack is best-effort
    }
  }

  // Succeed if any channel delivered. If every configured channel failed,
  // surface an error so the client can let the user retry.
  if (!notionOk && !emailed && !slackOk) {
    return Response.json({ error: 'Failed to deliver EHS submission' }, { status: 502 })
  }

  return Response.json({ ok: true, notionPageId: pageId, emailed })
}

async function syncToNotion(
  key: string,
  record: SafetyRecord
): Promise<{ ok: true; pageId: string } | { ok: false; error: string }> {
  const dbId = dbForType(record.type)
  if (!dbId) return { ok: false, error: 'No Notion DB configured for this record type' }

  const properties: Record<string, unknown> = {
    ID: { title: [{ text: { content: record.id } }] },
    Type: { select: { name: record.type } },
    Project: { rich_text: [{ text: { content: record.projectName || '' } }] },
    Location: { rich_text: [{ text: { content: record.location || '' } }] },
    'Created By': { rich_text: [{ text: { content: record.createdBy || '' } }] },
    'Created At': { date: { start: record.createdAt } },
    'Sync Source': { select: { name: 'equipment-qr-hub' } },
    'EHS Review': { select: { name: 'Pending' } },
  }

  const fullJson = JSON.stringify(record, null, 2)
  const CHUNK_SIZE = 1900
  const children: { object: 'block'; type: 'code'; code: { language: string; rich_text: { type: 'text'; text: { content: string } }[] } }[] = []
  for (let i = 0; i < fullJson.length; i += CHUNK_SIZE) {
    children.push({
      object: 'block',
      type: 'code',
      code: {
        language: 'json',
        rich_text: [{ type: 'text', text: { content: fullJson.slice(i, i + CHUNK_SIZE) } }],
      },
    })
  }

  try {
    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parent: { database_id: dbId }, properties, children }),
    })

    if (!res.ok) {
      console.error('[review/submit] Notion create error:', await res.text())
      return { ok: false, error: 'Notion API error' }
    }

    const page = (await res.json()) as { id: string }
    return { ok: true, pageId: page.id }
  } catch (e) {
    console.error('[review/submit] sync error:', e instanceof Error ? e.message : e)
    return { ok: false, error: 'Sync failed' }
  }
}
