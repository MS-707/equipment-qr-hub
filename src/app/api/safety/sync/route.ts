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
  const { session, error } = await requireSession()
  if (error) return error

  const key = process.env.NOTION_API_KEY

  const cl = parseInt(req.headers.get('content-length') || '0', 10)
  if (cl > 512_000) {
    return Response.json({ error: 'Request body too large' }, { status: 413 })
  }

  let record: SafetyRecord
  try {
    record = (await req.json()) as SafetyRecord
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!record?.id || typeof record.id !== 'string' || record.id.length > 100) {
    return Response.json({ error: 'Invalid record id' }, { status: 400 })
  }
  if (!record?.type || typeof record.type !== 'string' || !DB_MAP[record.type]) {
    return Response.json({ error: 'Invalid record type' }, { status: 400 })
  }
  if (typeof record.createdAt !== 'string' || record.createdAt.length > 30 || isNaN(new Date(record.createdAt).getTime())) {
    return Response.json({ error: 'Invalid createdAt' }, { status: 400 })
  }

  const sessionEmail = session?.user?.email
  if (sessionEmail) {
    const recordEmail = ('createdByEmail' in record ? (record as { createdByEmail?: string }).createdByEmail : null)
    if (recordEmail && recordEmail !== sessionEmail) {
      return Response.json({ error: 'Record owner mismatch' }, { status: 403 })
    }
    ;(record as { createdByEmail: string }).createdByEmail = sessionEmail
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
    // Dedup: check if this record was already synced (retry-safe)
    const existingCheck = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: { property: 'ID', title: { equals: record.id } },
        page_size: 1,
      }),
    })
    if (existingCheck.ok) {
      const existing = await existingCheck.json()
      const results = Array.isArray(existing?.results) ? existing.results : []
      if (results.length > 0 && typeof results[0]?.id === 'string') {
        return Response.json({ ok: true, notionPageId: results[0].id })
      }
    }

    const safeStr = (v: unknown, max = 500) =>
      typeof v === 'string' ? v.slice(0, max) : ''

    const properties: Record<string, unknown> = {
      ID: { title: [{ text: { content: record.id } }] },
      Type: { select: { name: record.type } },
      Project: { rich_text: [{ text: { content: safeStr(record.projectName, 200) } }] },
      Location: { rich_text: [{ text: { content: safeStr(record.location, 200) } }] },
      'Created By': { rich_text: [{ text: { content: safeStr(record.createdBy, 200) } }] },
      'Created At': { date: { start: record.createdAt } },
      'Sync Source': { select: { name: 'equipment-qr-hub' } },
    }
    if ('status' in record) {
      properties['Status'] = { select: { name: String((record as { status?: string }).status) } }
    }
    if ('severity' in record) {
      properties['Severity'] = { select: { name: String((record as { severity?: string }).severity) } }
    }

    const MAX_CHILDREN = 100
    const fullJson = JSON.stringify(record, null, 2)
    const CHUNK_SIZE = 1900
    const children = []
    for (let i = 0; i < fullJson.length && children.length < MAX_CHILDREN; i += CHUNK_SIZE) {
      children.push({
        object: 'block' as const,
        type: 'code' as const,
        code: {
          language: 'json',
          rich_text: [{ type: 'text' as const, text: { content: fullJson.slice(i, i + CHUNK_SIZE) } }],
        },
      })
    }

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

    const page = await res.json()
    const pageId = typeof page?.id === 'string' ? page.id : null
    return Response.json({ ok: true, notionPageId: pageId })
  } catch (e) {
    console.error('[sync] unexpected error:', e instanceof Error ? e.message : e)
    return Response.json({ error: 'Sync failed' }, { status: 500 })
  }
}
