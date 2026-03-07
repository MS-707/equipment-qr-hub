import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * POST /api/sync-inspection
 *
 * Syncs an inspection record to a Notion database.
 * Requires NOTION_API_KEY and NOTION_INSPECTIONS_DB_ID env vars.
 *
 * TODO: Implement when Notion API key is available (Monday).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const notionKey = process.env.NOTION_API_KEY
  const dbId = process.env.NOTION_INSPECTIONS_DB_ID

  if (!notionKey || !dbId) {
    return res.status(503).json({
      error: 'Notion integration not configured',
      message: 'Set NOTION_API_KEY and NOTION_INSPECTIONS_DB_ID environment variables',
    })
  }

  try {
    const record = req.body

    // TODO: Implement Notion API call
    // const notion = new Client({ auth: notionKey })
    // const response = await notion.pages.create({
    //   parent: { database_id: dbId },
    //   properties: {
    //     'Inspection ID': { title: [{ text: { content: record.id } }] },
    //     'Equipment ID': { number: record.equipmentId },
    //     'Inspector': { rich_text: [{ text: { content: record.inspectorName } }] },
    //     'Shift': { select: { name: record.shift } },
    //     'Hour Meter': { number: record.hourMeterReading },
    //     'Result': { select: { name: record.result } },
    //     'Critical Fail': { checkbox: record.hasCriticalFail },
    //     'Work Order': { rich_text: [{ text: { content: record.workOrderId || '' } }] },
    //     'Date': { date: { start: record.createdAt } },
    //   },
    // })

    return res.status(200).json({
      success: true,
      message: 'Notion sync stub — not yet implemented',
      recordId: record.id,
    })
  } catch (error) {
    return res.status(500).json({ error: 'Sync failed', details: String(error) })
  }
}
