import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'

const NOTION_VERSION = '2022-06-28'

function extractTitle(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return ''
  const p = prop as { title?: { plain_text?: string }[] }
  return p.title?.[0]?.plain_text ?? ''
}

function extractRichText(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return ''
  const p = prop as { rich_text?: { plain_text?: string }[] }
  return p.rich_text?.[0]?.plain_text ?? ''
}

function extractSelect(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return ''
  return (prop as { select?: { name?: string } }).select?.name ?? ''
}

export async function GET(req: Request) {
  const { session, error } = await requireSession()
  if (error) return error

  const rl = await rateLimit(`sds-search:${session!.user!.email}`, 20, 60_000)
  if (!rl.ok) {
    return Response.json(
      { results: [], total: 0, error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200)
  const field = url.searchParams.get('field') || 'any'
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50)

  if (!q || q.length < 2) {
    return Response.json(
      { results: [], total: 0, error: 'Query too short (min 2 chars)' },
      { status: 400 }
    )
  }

  const key = process.env.NOTION_API_KEY
  const dbId = process.env.NOTION_SDS_DB_ID
  if (!key || !dbId) {
    return Response.json({ results: [], total: 0 })
  }

  const fieldFilters: Record<string, unknown> = {
    name: { property: 'Product Name', rich_text: { contains: q } },
    manufacturer: { property: 'Manufacturer', rich_text: { contains: q } },
  }

  const filter = field === 'any'
    ? { or: Object.values(fieldFilters) }
    : fieldFilters[field] || fieldFilters['name']

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filter, page_size: limit }),
    })

    if (!res.ok) {
      console.error('[sds/search] Notion query error:', await res.text())
      return Response.json({ results: [], total: 0, error: 'Search failed' }, { status: 502 })
    }

    const data = (await res.json()) as {
      results: { id: string; properties: Record<string, unknown> }[]
    }

    const results = data.results.map((page) => ({
      id: extractTitle(page.properties['ID']),
      productName: extractRichText(page.properties['Product Name']),
      manufacturer: extractRichText(page.properties['Manufacturer']),
      signalWord: extractSelect(page.properties['Signal Word']),
      emergencyPhone: extractRichText(page.properties['Emergency Phone']),
    }))

    return Response.json({ results, total: results.length })
  } catch (e) {
    console.error('[sds/search] unexpected error:', e instanceof Error ? e.message : e)
    return Response.json({ results: [], total: 0, error: 'Search failed' }, { status: 500 })
  }
}
