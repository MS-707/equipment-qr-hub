import type { SafetyRecord } from '@/lib/safety-types'
import { SAFETY_TYPE_LABELS } from '@/lib/safety-types'

const NOTION_VERSION = '2022-06-28'
const NOTION_ID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

function escapeSlack(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function POST(req: Request) {
  const notionKey = process.env.NOTION_API_KEY
  if (!notionKey) {
    return Response.json(
      { error: 'Notion integration not configured' },
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

  let pageId = notionPageId
  if (!pageId) {
    const syncResult = await syncToNotion(notionKey, record)
    if (!syncResult.ok) {
      return Response.json(
        { error: 'Notion sync failed', detail: syncResult.error },
        { status: 502 }
      )
    }
    pageId = syncResult.pageId
  }

  try {
    const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${notionKey}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          'EHS Review': { select: { name: 'Pending' } },
        },
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      return Response.json({ error: 'Failed to set review property', detail }, { status: 502 })
    }
  } catch (e) {
    return Response.json({ error: 'Notion API error', detail: String(e) }, { status: 500 })
  }

  const slackUrl = process.env.SLACK_EHS_WEBHOOK_URL
  if (slackUrl) {
    const label = SAFETY_TYPE_LABELS[record.type] ?? record.type
    try {
      await fetch(slackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `📋 *EHS Review Requested*\n*${escapeSlack(label)}* — ${escapeSlack(record.id)}\n*Project:* ${escapeSlack(record.projectName || '')}\n*Location:* ${escapeSlack(record.location || '')}\n*Submitted by:* ${escapeSlack(record.createdBy || '')}`,
        }),
      })
    } catch {
      // Slack is best-effort; don't fail the submission
    }
  }

  return Response.json({ ok: true, notionPageId: pageId })
}

function dbForType(type: string): string | undefined {
  if (type === 'ptp') return process.env.NOTION_PTP_DB_ID
  if (type === 'incident-report') return process.env.NOTION_INCIDENTS_DB_ID
  if (type.endsWith('-permit')) return process.env.NOTION_PERMITS_DB_ID
  return undefined
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

  const fullJson = JSON.stringify(record, null, 2).slice(0, 1900)
  const children = [
    {
      object: 'block',
      type: 'code',
      code: {
        language: 'json',
        rich_text: [{ type: 'text', text: { content: fullJson } }],
      },
    },
  ]

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
      const detail = await res.text()
      return { ok: false, error: detail }
    }

    const page = (await res.json()) as { id: string }
    return { ok: true, pageId: page.id }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
