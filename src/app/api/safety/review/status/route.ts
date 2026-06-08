const NOTION_VERSION = '2022-06-28'

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
  const notionKey = process.env.NOTION_API_KEY
  if (!notionKey) {
    return Response.json({ decisions: {} })
  }

  const url = new URL(req.url)
  const pagesParam = url.searchParams.get('pages')
  if (!pagesParam) {
    return Response.json({ decisions: {} })
  }

  const pageIds = pagesParam.split(',').filter(Boolean).slice(0, 20)
  if (pageIds.length === 0) {
    return Response.json({ decisions: {} })
  }

  const decisions: Record<string, ReviewResult> = {}

  await Promise.all(
    pageIds.map(async (pageId) => {
      try {
        const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
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
      } catch {
        // Skip failed pages — they'll be retried on next poll
      }
    })
  )

  return Response.json({ decisions })
}
