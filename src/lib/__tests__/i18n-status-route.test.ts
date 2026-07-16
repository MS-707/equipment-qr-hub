import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * ES-4: the runtime kill switch must FAIL OPEN — a KV outage or missing
 * config must never strip a worker's chosen language mid-shift. One KV write
 * (i18n:es-enabled = false) pulls Spanish fleet-wide with no deploy.
 */

vi.mock('@/lib/kv', () => ({ kv: { get: vi.fn() } }))
vi.mock('@/lib/report-error', () => ({ reportServerError: vi.fn() }))

import { kv } from '@/lib/kv'
import { reportServerError } from '@/lib/report-error'
import { GET } from '@/app/api/i18n/status/route'

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('GET /api/i18n/status', () => {
  it('defaults to enabled with no KV configured (KV_REST_API_URL unset)', async () => {
    vi.stubEnv('KV_REST_API_URL', '')
    const res = await GET()
    expect(await res.json()).toEqual({ esEnabled: true, suppressedNamespaces: [] })
    expect(kv.get).not.toHaveBeenCalled()
  })

  it('is never cache-served (Cache-Control: no-store)', async () => {
    vi.stubEnv('KV_REST_API_URL', '')
    const res = await GET()
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('reads the kill switch from KV: false disables Spanish', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://kv.example')
    vi.mocked(kv.get).mockImplementation(async (key: string) =>
      key === 'i18n:es-enabled' ? false : null
    )
    const res = await GET()
    expect(await res.json()).toEqual({ esEnabled: false, suppressedNamespaces: [] })
  })

  it("tolerates string forms from manual KV writes ('false', '0')", async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://kv.example')
    for (const stored of ['false', '0']) {
      vi.mocked(kv.get).mockImplementation(async (key: string) =>
        key === 'i18n:es-enabled' ? stored : null
      )
      const res = await GET()
      expect((await res.json()).esEnabled).toBe(false)
    }
  })

  it('passes namespace suppression through, dropping non-string entries', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://kv.example')
    vi.mocked(kv.get).mockImplementation(async (key: string) =>
      key === 'i18n:suppressed-namespaces' ? ['ptp', 42, 'jha', null] : true
    )
    const res = await GET()
    expect(await res.json()).toEqual({ esEnabled: true, suppressedNamespaces: ['ptp', 'jha'] })
  })

  it('FAILS OPEN on a KV outage and reports the error (never console.*)', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://kv.example')
    vi.mocked(kv.get).mockRejectedValue(new Error('kv down'))
    const res = await GET()
    expect(await res.json()).toEqual({ esEnabled: true, suppressedNamespaces: [] })
    expect(reportServerError).toHaveBeenCalledWith('api/i18n/status', expect.any(Error))
  })
})
