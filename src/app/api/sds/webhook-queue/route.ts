import { requireSession } from '@/lib/api-auth'
import { kv } from '@/lib/kv'

export async function GET() {
  const { error } = await requireSession()
  if (error) return error

  if (!process.env.KV_REST_API_URL) {
    return Response.json({ records: [] })
  }

  try {
    const records = []
    for (let i = 0; i < 10; i++) {
      const raw = await kv.rpop('sds-webhook-queue')
      if (!raw) break
      try {
        records.push(JSON.parse(raw as string))
      } catch { /* drop malformed entries */ }
    }
    return Response.json({ records })
  } catch {
    return Response.json({ records: [] })
  }
}
