import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/kv', () => ({
  kv: { lpush: vi.fn(), ltrim: vi.fn(), lrange: vi.fn() },
}))
vi.mock('@/lib/report-error', () => ({
  reportServerError: vi.fn(),
}))

import { kv } from '@/lib/kv'
import { reportServerError } from '@/lib/report-error'
import { appendAudit, recentAudit } from '@/lib/audit-log'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('appendAudit', () => {
  it('LPUSHes a JSON entry with actor/action/target/at and trims the list', async () => {
    await appendAudit({ actor: 'admin@mytra.ai', action: 'beta-approved', target: 'beta-1' })
    expect(kv.lpush).toHaveBeenCalledTimes(1)
    const [key, payload] = vi.mocked(kv.lpush).mock.calls[0]
    expect(key).toBe('audit:log')
    const entry = JSON.parse(payload as string)
    expect(entry).toMatchObject({ actor: 'admin@mytra.ai', action: 'beta-approved', target: 'beta-1' })
    expect(typeof entry.at).toBe('string')
    expect(kv.ltrim).toHaveBeenCalledWith('audit:log', 0, 999)
  })

  it('fails open when KV throws — reports but never rejects', async () => {
    vi.mocked(kv.lpush).mockRejectedValue(new Error('kv down'))
    await expect(
      appendAudit({ actor: 'a', action: 'b', target: 'c' })
    ).resolves.toBeUndefined()
    expect(reportServerError).toHaveBeenCalled()
  })
})

describe('recentAudit', () => {
  it('parses string entries and passes through object entries', async () => {
    vi.mocked(kv.lrange).mockResolvedValue([
      JSON.stringify({ actor: 'a', action: 'x', target: 't', at: '2026-07-06T00:00:00Z' }),
      { actor: 'b', action: 'y', target: 'u', at: '2026-07-06T01:00:00Z' },
    ] as never)
    const entries = await recentAudit(2)
    expect(entries).toHaveLength(2)
    expect(entries[0].actor).toBe('a')
    expect(entries[1].actor).toBe('b')
    expect(kv.lrange).toHaveBeenCalledWith('audit:log', 0, 1)
  })

  it('drops malformed entries instead of throwing', async () => {
    vi.mocked(kv.lrange).mockResolvedValue(['not json', JSON.stringify({ actor: 'a', action: 'x', target: 't', at: 'z' })] as never)
    const entries = await recentAudit(10)
    expect(entries).toHaveLength(1)
  })
})
