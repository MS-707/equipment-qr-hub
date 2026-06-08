/**
 * POST /api/safety/sync
 *
 * Pushes a safety record to the appropriate Notion database. Uses the raw Notion
 * REST API (no SDK dependency). Degrades gracefully: if NOTION_API_KEY or the
 * relevant DB id is unset, returns 503 and the client leaves the record pending.
 */

import type { SafetyRecord } from '@/lib/safety-types'
import { requireSession } from '@/lib/api-auth'

const NOTION_VERSION = '2022-06-28'

const DB_MAP: Record<string, string | undefined> = {
  'ptp': process.env.NOTION_PTP_DB_ID,
  'incident-report': process.env.NOTION_INCIDENTS_DB_ID,
  'height-permit': process.env.NOTION_PERMITS_DB_ID,
  'hot-work-permit': process.env.NOTION_PERMITS_DB_ID,
  'confined-space-permit': process.env.NOTION_PERMITS_DB_ID,
}

function dbForType(type: string): string | undefined {
  return DB_MAP[type]
}

export async function POST(req: Request) {
  const { session, error } = await requireSession()
  if (error) return error

  const key = process.env.NOTION_API_KEY

  let record: SafetyRecord
  try {
    record = (await req.json()) as SafetyRecord
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (record.createdBy && session!.user!.email) {
    const recordEmail = ('createdByEmail' in record ? (record as { createdByEmail?: string }).createdByEmail : null)
    if (recordEmail && recordEmail !== session!.user!.email) {
      return Response.json({ error: 'Record owner mismatch' }, { status: 403 })
    }
  }

  const dbId = dbForType(record.type)
  if (!key || !dbId) {
    return Response.json(
      {
        error: 'Notion integration not configured',
        message: 'Set NOTION_API_KEY and the relevant NOTION_*_DB_ID environment variable.',
      },
      { status: 503 }
    )
  }

  try {
    const properties: Record<string, unknown> = {
      ID: { title: [{ text: { content: record.id } }] },
      Type: { select: { name: record.type } },
      Project: { rich_text: [{ text: { content: record.projectName || '' } }] },
      Location: { rich_text: [{ text: { content: record.location || '' } }] },
      'Created By': { rich_text: [{ text: { content: record.createdBy || '' } }] },
      'Created At': { date: { start: record.createdAt } },
      'Sync Source': { select: { name: 'equipment-qr-hub' } },
    }
    if ('status' in record) {
      properties['Status'] = { select: { name: String((record as { status?: string }).status) } }
    }
    if ('severity' in record) {
      properties['Severity'] = { select: { name: String((record as { severity?: string }).severity) } }
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
      console.error('[sync] Notion API error:', await res.text())
      return Response.json({ error: 'Notion sync failed' }, { status: 502 })
    }

    const page = (await res.json()) as { id: string }
    return Response.json({ ok: true, notionPageId: page.id })
  } catch (e) {
    console.error('[sync] unexpected error:', e instanceof Error ? e.message : e)
    return Response.json({ error: 'Sync failed' }, { status: 500 })
  }
}
