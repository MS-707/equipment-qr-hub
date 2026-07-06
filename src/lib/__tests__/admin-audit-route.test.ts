import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/admin', () => ({ isAdmin: vi.fn() }))
vi.mock('@/lib/audit-log', () => ({ recentAudit: vi.fn() }))
vi.mock('@/lib/report-error', () => ({ reportServerError: vi.fn() }))

import { getServerSession } from 'next-auth/next'
import { isAdmin } from '@/lib/admin'
import { recentAudit } from '@/lib/audit-log'

const makeReq = (qs = '') => new Request(`http://localhost/api/admin/audit${qs}`)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getServerSession).mockResolvedValue({ user: { email: 'admin@mytra.ai' } } as never)
  vi.mocked(isAdmin).mockReturnValue(true)
  vi.mocked(recentAudit).mockResolvedValue([])
})

describe('GET /api/admin/audit', () => {
  it('returns 401 for non-admin sessions', async () => {
    vi.mocked(isAdmin).mockReturnValue(false)
    const { GET } = await import('@/app/api/admin/audit/route')
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { GET } = await import('@/app/api/admin/audit/route')
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
  })

  it('returns recent entries for admins', async () => {
    vi.mocked(recentAudit).mockResolvedValue([
      { actor: 'admin@mytra.ai', action: 'beta-approved', target: 'beta-1', at: '2026-07-06T00:00:00Z' },
    ])
    const { GET } = await import('@/app/api/admin/audit/route')
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.entries).toHaveLength(1)
    expect(data.entries[0]).toMatchObject({ actor: 'admin@mytra.ai', action: 'beta-approved' })
  })

  it('caps the limit parameter at 500', async () => {
    const { GET } = await import('@/app/api/admin/audit/route')
    await GET(makeReq('?limit=99999'))
    expect(recentAudit).toHaveBeenCalledWith(500)
  })

  it('returns 503 when the audit store is unavailable', async () => {
    vi.mocked(recentAudit).mockRejectedValue(new Error('kv down'))
    const { GET } = await import('@/app/api/admin/audit/route')
    const res = await GET(makeReq())
    expect(res.status).toBe(503)
  })
})
