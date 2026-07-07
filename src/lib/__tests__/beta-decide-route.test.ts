import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))
vi.mock('@/lib/admin', () => ({
  isAdmin: vi.fn(() => true),
}))
vi.mock('@/lib/audit-log', () => ({
  appendAudit: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/lib/beta', () => ({
  updateSignupStatus: vi.fn(),
  getAllSignups: vi.fn(() => []),
}))
vi.mock('@/app/api/beta/decide/email', () => ({
  sendBetaEmail: vi.fn(),
}))

import { getServerSession } from 'next-auth/next'
import { isAdmin } from '@/lib/admin'
import { updateSignupStatus, getAllSignups } from '@/lib/beta'
import { appendAudit } from '@/lib/audit-log'

beforeEach(() => {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: 'admin@mytra.ai', name: 'Admin', image: null },
    expires: '',
  })
  vi.mocked(isAdmin).mockReturnValue(true)
  vi.mocked(updateSignupStatus).mockResolvedValue(undefined)
  vi.mocked(getAllSignups).mockResolvedValue([])
})

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/beta/decide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/beta/decide', () => {
  it('returns 401 when not admin', async () => {
    vi.mocked(isAdmin).mockReturnValue(false)
    const { POST } = await import('@/app/api/beta/decide/route')
    const res = await POST(makeReq({ id: 'beta-1', status: 'approved' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { POST } = await import('@/app/api/beta/decide/route')
    const res = await POST(makeReq({ id: 'beta-1', status: 'approved' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid JSON', async () => {
    const { POST } = await import('@/app/api/beta/decide/route')
    const res = await POST(new Request('http://localhost/api/beta/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing id or invalid status', async () => {
    const { POST } = await import('@/app/api/beta/decide/route')
    const res = await POST(makeReq({ id: 'beta-1', status: 'invalid' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when signup not found', async () => {
    vi.mocked(updateSignupStatus).mockResolvedValue(undefined)
    const { POST } = await import('@/app/api/beta/decide/route')
    const res = await POST(makeReq({ id: 'beta-nonexistent', status: 'approved' }))
    expect(res.status).toBe(404)
  })

  it('approves a signup and returns ok', async () => {
    vi.mocked(updateSignupStatus).mockResolvedValue({
      id: 'beta-1',
      name: 'Alice',
      email: 'alice@example.com',
      company: 'ACME',
      role: 'Safety',
      crewSize: '10',
      reason: '',
      status: 'approved',
      createdAt: '2026-06-23T00:00:00Z',
    })
    const { POST } = await import('@/app/api/beta/decide/route')
    const res = await POST(makeReq({ id: 'beta-1', status: 'approved' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.signup.status).toBe('approved')
  })
})

describe('GET /api/beta/decide', () => {
  it('returns 401 when not admin', async () => {
    vi.mocked(isAdmin).mockReturnValue(false)
    const { GET } = await import('@/app/api/beta/decide/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns signups list for admin', async () => {
    vi.mocked(getAllSignups).mockResolvedValue([
      { id: 'beta-1', name: 'Alice', email: 'a@x.com', company: 'ACME', role: 'Safety', crewSize: '', reason: '', status: 'pending', createdAt: '2026-06-23T00:00:00Z' },
    ])
    const { GET } = await import('@/app/api/beta/decide/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.signups).toHaveLength(1)
  })
})

describe('KV outage (BE-9)', () => {
  it('POST returns 503 when updateSignupStatus throws (KV down)', async () => {
    vi.mocked(updateSignupStatus).mockRejectedValue(new Error('kv down'))
    const { POST } = await import('@/app/api/beta/decide/route')
    const res = await POST(makeReq({ id: 'beta-1', status: 'approved' }))
    expect(res.status).toBe(503)
  })

  it('GET returns 503 when getAllSignups throws (KV down)', async () => {
    vi.mocked(getAllSignups).mockRejectedValue(new Error('kv down'))
    const { GET } = await import('@/app/api/beta/decide/route')
    const res = await GET()
    expect(res.status).toBe(503)
  })
})

describe('audit trail (EN-8)', () => {
  it('appends an audit entry when a signup is decided', async () => {
    vi.mocked(updateSignupStatus).mockResolvedValue({ id: 'beta-1', status: 'approved' } as never)
    const { POST } = await import('@/app/api/beta/decide/route')
    const res = await POST(makeReq({ id: 'beta-1', status: 'approved' }))
    expect(res.status).toBe(200)
    expect(appendAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'beta-approved', target: 'beta-1' })
    )
  })
})
