import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api-auth', () => ({
  requireSession: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => Promise.resolve({ ok: true, retryAfter: 0 })),
}))
vi.mock('@/lib/email-notify', () => ({
  isEmailConfigured: vi.fn(() => false),
  sendEhsNotification: vi.fn(() => Promise.resolve('not-configured')),
}))

import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'
import { isEmailConfigured, sendEhsNotification } from '@/lib/email-notify'

beforeEach(() => {
  vi.mocked(requireSession).mockResolvedValue({
    session: { user: { email: 'test@x.com', name: 'Test', image: null }, expires: '' },
    error: null,
  })
  vi.mocked(rateLimit).mockResolvedValue({ ok: true, retryAfter: 0 })
  vi.mocked(isEmailConfigured).mockReturnValue(false)
  vi.mocked(sendEhsNotification).mockResolvedValue('not-configured')
})

// Mirrors the real client payload: numeric equipmentId (equipment.itemNumber),
// workOrderId null on passing inspections. Keep in lockstep with
// InspectionRecord in lib/types.ts — see inspection-notify-schema.test.ts for
// the full round-trip suite.
const validBody = {
  record: {
    id: 'INS-2026-0001',
    equipmentId: 17,
    inspectorName: 'Alice',
    shift: 'Day',
    hourMeterReading: 1234,
    createdAt: '2026-06-23T08:00:00Z',
    result: 'pass' as const,
    hasCriticalFail: false,
    criticalNaCount: 0,
    workOrderId: null,
    items: [
      { id: 'item-1', label: 'Brakes', result: 'pass' as const },
      { id: 'item-2', label: 'Lights', result: 'pass' as const },
    ],
  },
  equipmentName: 'Forklift #3',
  equipmentCategory: 'Powered Industrial Truck',
}

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/inspections/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/inspections/notify', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(requireSession).mockResolvedValue({
      session: null,
      error: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    })
    const { POST } = await import('@/app/api/inspections/notify/route')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimit).mockResolvedValue({ ok: false, retryAfter: 5 })
    const { POST } = await import('@/app/api/inspections/notify/route')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(429)
  })

  it('returns emailed:false when email not configured', async () => {
    const { POST } = await import('@/app/api/inspections/notify/route')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.emailed).toBe(false)
    expect(data.reason).toBe('not-configured')
  })

  it('returns 400 for invalid JSON', async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(true)
    const { POST } = await import('@/app/api/inspections/notify/route')
    const res = await POST(new Request('http://localhost/api/inspections/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid inspection record', async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(true)
    const { POST } = await import('@/app/api/inspections/notify/route')
    const res = await POST(makeReq({ record: { id: 'INS-001' } }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Invalid inspection')
  })

  it('sends email and returns emailed:true on success', async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(true)
    vi.mocked(sendEhsNotification).mockResolvedValue('sent')
    const { POST } = await import('@/app/api/inspections/notify/route')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.emailed).toBe(true)
    expect(data.outcome).toBe('sent')
    expect(sendEhsNotification).toHaveBeenCalledWith(expect.objectContaining({
      subject: expect.stringContaining('Forklift #3'),
    }))
  })

  it('stamps the verified submitter from the session, not client input', async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(true)
    vi.mocked(sendEhsNotification).mockResolvedValue('sent')
    const { POST } = await import('@/app/api/inspections/notify/route')
    const forged = {
      ...validBody,
      record: { ...validBody.record, inspectorName: 'Someone Else' },
    }
    await POST(makeReq(forged))
    expect(sendEhsNotification).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining('Submitted by (verified): test@x.com'),
    }))
  })

  it('email subject includes CRITICAL FAIL for critical failures', async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(true)
    vi.mocked(sendEhsNotification).mockResolvedValue('sent')
    const critBody = {
      ...validBody,
      record: {
        ...validBody.record,
        result: 'fail' as const,
        hasCriticalFail: true,
        items: [
          { id: 'item-1', label: 'Brakes', result: 'fail' as const, critical: true, notes: 'No response' },
        ],
      },
    }
    const { POST } = await import('@/app/api/inspections/notify/route')
    const res = await POST(makeReq(critBody))
    expect(res.status).toBe(200)
    expect(sendEhsNotification).toHaveBeenCalledWith(expect.objectContaining({
      subject: expect.stringContaining('CRITICAL FAIL'),
    }))
  })
})
