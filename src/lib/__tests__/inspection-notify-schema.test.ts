import { describe, it, expect } from 'vitest'
import { NotifyBodySchema } from '@/lib/inspection-notify-schema'
import type { InspectionRecord } from '@/lib/types'

/**
 * Round-trip regression test: the notify route schema must accept the exact
 * payload PreTripInspection builds from a real submitInspection record.
 * A drift here means EHS emails silently 400 while the UI claims delivery.
 */

// Shaped exactly like submitInspection output (types.ts InspectionRecord)
const record: InspectionRecord = {
  id: 'INS-2026-0042',
  equipmentId: 17, // number — equipment.itemNumber
  inspectorName: 'Dana Ortiz',
  shift: 'Day',
  hourMeterReading: 1543.5,
  checklistType: 'electric-forklift',
  items: [
    { id: 'ef-forks', label: 'Forks, clips, heel — no cracks or bending', category: 'Motor Off Checks', critical: true, result: 'pass', notes: '', photo: null },
    { id: 'ef-horn', label: 'Horn', category: 'Motor On Checks', critical: true, result: 'fail', notes: 'Horn intermittent, cuts out when button held', photo: null },
    { id: 'ef-attach', label: 'Attachment operation', category: 'Motor On Checks', critical: false, result: 'na', notes: '', photo: null, naReasonCode: null, naJustification: '' },
    { id: 'ef-seatbelt', label: 'Seat belt — smooth operation', category: 'Motor Off Checks', critical: true, result: 'na', notes: '', photo: null, naReasonCode: 'maintenance-in-progress', naJustification: 'Belt assembly being replaced today per WO-2026-0009' },
  ],
  result: 'fail',
  hasCriticalFail: false,
  criticalNaCount: 1,
  workOrderId: 'WO-2026-0011',
  createdAt: '2026-07-02T14:31:00.000Z',
  syncStatus: 'pending',
  notionPageId: null,
}

// Mirror the client payload construction in PreTripInspection.handleSubmit
function clientPayload(r: InspectionRecord) {
  return {
    record: { ...r, items: r.items.map((i) => ({ ...i, photo: null })) },
    equipmentName: 'Crown SC 5200 Series',
    equipmentCategory: 'Powered Industrial Trucks',
  }
}

describe('NotifyBodySchema round-trip with real record shapes', () => {
  it('accepts a failing inspection with work order and critical N/A', () => {
    const parsed = NotifyBodySchema.safeParse(clientPayload(record))
    expect(parsed.success).toBe(true)
  })

  it('accepts a passing inspection (workOrderId null — the common case)', () => {
    const passing: InspectionRecord = {
      ...record,
      items: record.items.map((i) => ({ ...i, result: 'pass' as const, naReasonCode: null, naJustification: '' })),
      result: 'pass',
      hasCriticalFail: false,
      criticalNaCount: 0,
      workOrderId: null,
    }
    const parsed = NotifyBodySchema.safeParse(clientPayload(passing))
    expect(parsed.success).toBe(true)
  })

  it('accepts numeric equipmentId (equipment.itemNumber)', () => {
    const parsed = NotifyBodySchema.safeParse(clientPayload({ ...record, equipmentId: 101 }))
    expect(parsed.success).toBe(true)
  })

  it('accepts null hourMeterReading (manual pallet jack)', () => {
    const parsed = NotifyBodySchema.safeParse(clientPayload({ ...record, hourMeterReading: null }))
    expect(parsed.success).toBe(true)
  })

  it('accepts notes at the client textarea limit (2000 chars)', () => {
    const long = {
      ...record,
      items: [{ ...record.items[1], notes: 'x'.repeat(2000) }],
    }
    const parsed = NotifyBodySchema.safeParse(clientPayload(long))
    expect(parsed.success).toBe(true)
  })

  it('rejects a record with a bogus result verdict', () => {
    const bad = clientPayload(record) as { record: { result: string } }
    bad.record.result = 'maybe'
    const parsed = NotifyBodySchema.safeParse(bad)
    expect(parsed.success).toBe(false)
  })

  it('rejects a non-numeric equipmentId', () => {
    const bad = clientPayload(record) as { record: { equipmentId: unknown } }
    bad.record.equipmentId = { $gt: 0 }
    const parsed = NotifyBodySchema.safeParse(bad)
    expect(parsed.success).toBe(false)
  })

  it('strips unknown fields (syncStatus, notionPageId, photo) rather than rejecting', () => {
    const parsed = NotifyBodySchema.safeParse(clientPayload(record))
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect('syncStatus' in parsed.data.record).toBe(false)
      expect('photo' in parsed.data.record.items[0]).toBe(false)
    }
  })

  it('accepts a PNG data-URL touch signature', () => {
    const payload = { ...clientPayload(record), signatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' }
    const parsed = NotifyBodySchema.safeParse(payload)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.signatureDataUrl).toContain('data:image/png')
  })

  it('rejects non-PNG signature payloads (no SVG/script smuggling)', () => {
    for (const bad of [
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      'data:text/html;base64,PGI+aGk8L2I+',
      'https://evil.example/sig.png',
    ]) {
      const parsed = NotifyBodySchema.safeParse({ ...clientPayload(record), signatureDataUrl: bad })
      expect(parsed.success).toBe(false)
    }
  })

  it('accepts null signature (records predating sign-on)', () => {
    const parsed = NotifyBodySchema.safeParse({ ...clientPayload(record), signatureDataUrl: null })
    expect(parsed.success).toBe(true)
  })

  it('preserves critical N/A fields the email builder needs', () => {
    const parsed = NotifyBodySchema.safeParse(clientPayload(record))
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.record.criticalNaCount).toBe(1)
      const seatbelt = parsed.data.record.items.find((i) => i.id === 'ef-seatbelt')
      expect(seatbelt?.naReasonCode).toBe('maintenance-in-progress')
      expect(seatbelt?.naJustification).toContain('WO-2026-0009')
    }
  })
})
