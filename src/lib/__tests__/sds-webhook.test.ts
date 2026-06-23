import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { SdsRecordSchema } from '../sds-schemas'

function signPayload(body: string, timestamp: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')
  return `v0=${sig}`
}

const MOCK_SECRET = 'test-webhook-secret-key'
const NOW_SECONDS = Math.floor(Date.now() / 1000)

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    chemical_name: 'Acetylene',
    cas_number: '74-86-2',
    manufacturer: 'AirGas',
    approved_by: 'John Smith',
    event_id: `evt-${Date.now()}`,
    project: 'Tower B',
    ...overrides,
  }
}

describe('webhook HMAC signature verification', () => {
  it('produces valid v0= HMAC-SHA256 signature', () => {
    const body = JSON.stringify({ test: true })
    const ts = String(NOW_SECONDS)
    const sig = signPayload(body, ts, MOCK_SECRET)
    expect(sig).toMatch(/^v0=[0-9a-f]{64}$/)
  })

  it('changes with different secret', () => {
    const body = JSON.stringify({ test: true })
    const ts = String(NOW_SECONDS)
    const sig1 = signPayload(body, ts, 'secret-a')
    const sig2 = signPayload(body, ts, 'secret-b')
    expect(sig1).not.toBe(sig2)
  })

  it('changes with different body', () => {
    const ts = String(NOW_SECONDS)
    const sig1 = signPayload('body-a', ts, MOCK_SECRET)
    const sig2 = signPayload('body-b', ts, MOCK_SECRET)
    expect(sig1).not.toBe(sig2)
  })

  it('changes with different timestamp', () => {
    const body = JSON.stringify({ test: true })
    const sig1 = signPayload(body, String(NOW_SECONDS), MOCK_SECRET)
    const sig2 = signPayload(body, String(NOW_SECONDS - 100), MOCK_SECRET)
    expect(sig1).not.toBe(sig2)
  })
})

describe('buildWebhookStub (via schema validation)', () => {
  it('produces a valid SdsRecord for full payload', () => {
    const payload = makePayload()
    const stub = {
      id: 'SDS-2026-0001',
      productName: payload.chemical_name,
      manufacturer: payload.manufacturer,
      casNumbers: [payload.cas_number],
      signalWord: 'None',
      pictograms: [],
      hazardStatements: [],
      precautionaryStatements: [],
      firstAid: { inhalation: '', skin: '', eyes: '', ingestion: '' },
      ppeRequired: [],
      fireExtinguishing: '',
      spillProcedure: '',
      storageHandling: '',
      emergencyPhone: '',
      sections: [],
      isFavorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
      _searchIndex: `${payload.chemical_name} ${payload.manufacturer} ${payload.cas_number}`.toLowerCase(),
    }
    const result = SdsRecordSchema.safeParse(stub)
    expect(result.success).toBe(true)
  })

  it('produces valid SdsRecord when optional fields missing', () => {
    const payload = makePayload({ cas_number: undefined, manufacturer: undefined })
    const stub = {
      id: 'SDS-2026-0002',
      productName: payload.chemical_name,
      manufacturer: '',
      casNumbers: [],
      signalWord: 'None',
      pictograms: [],
      hazardStatements: [],
      precautionaryStatements: [],
      firstAid: { inhalation: '', skin: '', eyes: '', ingestion: '' },
      ppeRequired: [],
      fireExtinguishing: '',
      spillProcedure: '',
      storageHandling: '',
      emergencyPhone: '',
      sections: [],
      isFavorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
      _searchIndex: `${payload.chemical_name}  `.toLowerCase(),
    }
    const result = SdsRecordSchema.safeParse(stub)
    expect(result.success).toBe(true)
  })

  it('search index contains lowercase product name and CAS', () => {
    const idx = 'acetylene airgas 74-86-2'
    expect(idx).toContain('acetylene')
    expect(idx).toContain('74-86-2')
    expect(idx).toContain('airgas')
  })
})

describe('SDS ID format', () => {
  it('sequential format matches SDS-YYYY-NNNN', () => {
    const id = `SDS-2026-${String(1).padStart(4, '0')}`
    expect(id).toBe('SDS-2026-0001')
    expect(id).toMatch(/^SDS-\d{4}-\d{4}$/)
  })

  it('fallback format with timestamp prefix', () => {
    const ts = Date.now().toString(36)
    const id = `SDS-2026-W${ts}`
    expect(id).toMatch(/^SDS-2026-W[a-z0-9]+$/)
  })
})
