import type { SdsRecord } from '@/lib/sds-types'
import { requireSession } from '@/lib/api-auth'

const NOTION_VERSION = '2022-06-28'

export async function POST(req: Request) {
  const { error } = await requireSession()
  if (error) return error

  const key = process.env.NOTION_API_KEY
  const dbId = process.env.NOTION_SDS_DB_ID

  let record: SdsRecord
  try {
    record = (await req.json()) as SdsRecord
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!record?.id || typeof record.id !== 'string' || record.id.length > 100) {
    return Response.json({ error: 'Invalid record id' }, { status: 400 })
  }
  if (typeof record.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(record.createdAt)) {
    return Response.json({ error: 'Invalid createdAt' }, { status: 400 })
  }

  if (!key || !dbId) {
    return Response.json(
      {
        error: 'Notion integration not configured',
        message: 'Set NOTION_API_KEY and NOTION_SDS_DB_ID.',
      },
      { status: 503 }
    )
  }

  try {
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
      const existing = (await existingCheck.json()) as { results: { id: string }[] }
      if (existing.results.length > 0) {
        return Response.json({ ok: true, notionPageId: existing.results[0].id })
      }
    }

    const properties: Record<string, unknown> = {
      ID: { title: [{ text: { content: record.id } }] },
      'Product Name': { rich_text: [{ text: { content: record.productName || '' } }] },
      Manufacturer: { rich_text: [{ text: { content: record.manufacturer || '' } }] },
      'Signal Word': { select: { name: record.signalWord || 'None' } },
      'Emergency Phone': { rich_text: [{ text: { content: record.emergencyPhone || '' } }] },
      'Sync Source': { select: { name: 'sage-ehs' } },
    }

    const fullJson = JSON.stringify(record, null, 2)
    const CHUNK_SIZE = 1900
    const children = []
    for (let i = 0; i < fullJson.length; i += CHUNK_SIZE) {
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
      console.error('[sds/sync] Notion API error:', await res.text())
      return Response.json({ error: 'Notion sync failed' }, { status: 502 })
    }

    const page = (await res.json()) as { id: string }
    return Response.json({ ok: true, notionPageId: page.id })
  } catch (e) {
    console.error('[sds/sync] unexpected error:', e instanceof Error ? e.message : e)
    return Response.json({ error: 'Sync failed' }, { status: 500 })
  }
}
