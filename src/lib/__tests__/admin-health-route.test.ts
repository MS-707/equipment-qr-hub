import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))
vi.mock('@/lib/admin', () => ({
  isAdmin: vi.fn((email: string) => email === 'admin@x.com'),
}))
vi.mock('@/lib/kv', () => ({
  kv: {
    incr: vi.fn(() => Promise.resolve(1)),
  },
}))

import { getServerSession } from 'next-auth/next'
import { kv } from '@/lib/kv'

beforeEach(() => {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: 'admin@x.com', name: 'Admin', image: null },
    expires: '',
  })
  vi.mocked(kv.incr).mockResolvedValue(1)
  delete process.env.KV_REST_API_URL
  delete process.env.GOOGLE_CLIENT_ID
  delete process.env.GOOGLE_CLIENT_SECRET
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.RESEND_API_KEY
  delete process.env.NOTION_API_KEY
  delete process.env.SLACK_WEBHOOK_URL
})

describe('GET /api/admin/health', () => {
  it('returns 401 for non-admin', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: 'user@x.com', name: 'User', image: null },
      expires: '',
    })
    const { GET } = await import('@/app/api/admin/health/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 401 for unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { GET } = await import('@/app/api/admin/health/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('reports KV as not-configured when env missing', async () => {
    const { GET } = await import('@/app/api/admin/health/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.kv).toBe('not-configured')
  })

  it('reports KV as connected when ping succeeds', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.com'
    vi.resetModules()
    const { GET } = await import('@/app/api/admin/health/route')
    const res = await GET()
    const data = await res.json()
    expect(data.kv).toBe('connected')
  })

  it('reports KV as error when ping fails', async () => {
    process.env.KV_REST_API_URL = 'https://kv.example.com'
    vi.resetModules()
    vi.mocked(kv.incr).mockRejectedValue(new Error('KV down'))
    const { GET } = await import('@/app/api/admin/health/route')
    const res = await GET()
    const data = await res.json()
    expect(data.kv).toBe('error')
  })

  it('reports integration flags correctly', async () => {
    process.env.GOOGLE_CLIENT_ID = 'gid'
    process.env.GOOGLE_CLIENT_SECRET = 'gsec'
    process.env.ANTHROPIC_API_KEY = 'ant-key'
    process.env.RESEND_API_KEY = 'res-key'
    process.env.NOTION_API_KEY = 'ntn-key'
    const { GET } = await import('@/app/api/admin/health/route')
    const res = await GET()
    const data = await res.json()
    expect(data.googleAuth).toBe(true)
    expect(data.anthropic).toBe(true)
    expect(data.resend).toBe(true)
    expect(data.notion).toBe(true)
  })
})
