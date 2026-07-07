import { kv } from '@/lib/kv'
import { reportServerError } from '@/lib/report-error'

export const dynamic = 'force-dynamic'

/**
 * Runtime i18n kill switch (ES-4). One KV write pulls Spanish fleet-wide in
 * minutes (or suppresses a single namespace) with no deploy and no service
 * worker dependency — the SW routes this path NetworkOnly and the provider
 * refetches on every foreground. Fails open to enabled: a KV outage must
 * never strip a worker's chosen language.
 */
export async function GET() {
  let esEnabled = true
  let suppressedNamespaces: string[] = []
  if (process.env.KV_REST_API_URL) {
    try {
      const [enabled, suppressed] = await Promise.all([
        kv.get<boolean | string>('i18n:es-enabled'),
        kv.get<string[]>('i18n:suppressed-namespaces'),
      ])
      if (enabled === false || enabled === 'false' || enabled === '0') esEnabled = false
      if (Array.isArray(suppressed)) suppressedNamespaces = suppressed.filter((s) => typeof s === 'string')
    } catch (err) {
      reportServerError('api/i18n/status', err)
    }
  }
  return Response.json(
    { esEnabled, suppressedNamespaces },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
