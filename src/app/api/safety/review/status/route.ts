import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'
import { getReviewSubmission } from '@/lib/review-store'
import { fetchWithTimeout } from '@/lib/fetch-timeout'
import { reportServerError } from '@/lib/report-error'

const NOTION_VERSION = '2022-06-28'
const NOTION_ID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i
// PTP-2026-0001 / INS-2026-0042-a3f2 style local record ids
const RECORD_ID_RE = /^[A-Z]{2,4}-\d{4}-\d{4}(-[a-z0-9]{4})?$/i

interface NotionProperty {
  type: string
  select?: { name: string } | null
  rich_text?: Array<{ plain_text: string }>
}

interface ReviewResult {
  status: 'pending' | 'approved' | 'rejected'
  reviewerName?: string
  reviewNote?: string
}

export async function GET(req: Request) {
  if (process.env.NEXT_PUBLIC_EHS_REVIEW !== '1') {
    return Response.json({ decisions: {} })
  }

  const { session, error } = await requireSession()
  if (error) return error

  // Each call fans out up to 20 Notion page fetches — cap the amplification.
  const rl = await rateLimit(`review-status:${session?.user?.email || 'unknown'}`, 30, 60_000)
  if (!rl.ok) {
    return Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })
  }

  const url = new URL(req.url)
  const decisions: Record<string, ReviewResult> = {}

  // KV fallback keyed by record id — covers records that never got a Notion
  // page (email/Slack-only deployments), which previously could NEVER see
  // their review decision.
  const recordsParam = url.searchParams.get('records')
  if (recordsParam) {
    const recordIds = recordsParam.split(',').filter(Boolean).slice(0, 20)
      .filter((id) => RECORD_ID_RE.test(id))
    await Promise.all(
      recordIds.map(async (recordId) => {
        try {
          const sub = await getReviewSubmission(recordId)
          if (sub && sub.status !== 'pending') {
            decisions[recordId] = {
              status: sub.status,
              reviewerName: sub.decidedBy,
              reviewNote: sub.note,
            }
          }
        } catch (err) {
          // skip — retried next poll; still report so a wedged Notion shows up
          reportServerError('api/safety/review/status', err)
        }
      })
    )
  }

  const notionKey = process.env.NOTION_API_KEY
  const pagesParam = url.searchParams.get('pages')
  if (!notionKey || !pagesParam) {
    return Response.json({ decisions })
  }

  const pageIds = pagesParam.split(',').filter(Boolean).slice(0, 20)
    .filter((id) => NOTION_ID_RE.test(id))
  if (pageIds.length === 0) {
    return Response.json({ decisions })
  }

  await Promise.all(
    pageIds.map(async (pageId) => {
      try {
        const res = await fetchWithTimeout(`https://api.notion.com/v1/pages/${pageId}`, {
          headers: {
            Authorization: `Bearer ${notionKey}`,
            'Notion-Version': NOTION_VERSION,
          },
        })

        if (!res.ok) return

        const page = (await res.json()) as { properties: Record<string, NotionProperty> }
        const reviewProp = page.properties['EHS Review']
        const noteProp = page.properties['EHS Review Note']

        if (!reviewProp?.select?.name) return

        const raw = reviewProp.select.name.toLowerCase()
        let status: ReviewResult['status'] = 'pending'
        if (raw === 'approved' || raw === 'done') status = 'approved'
        else if (raw === 'rejected' || raw === 'needs changes') status = 'rejected'

        const reviewerName = page.properties['Reviewed By']?.rich_text?.[0]?.plain_text
        const reviewNote = noteProp?.rich_text?.[0]?.plain_text

        decisions[pageId] = { status, reviewerName, reviewNote }
      } catch (err) {
        reportServerError('api/safety/review/status', err)
        // Skip failed pages — they'll be retried on next poll
      }
    })
  )

  return Response.json({ decisions })
}
