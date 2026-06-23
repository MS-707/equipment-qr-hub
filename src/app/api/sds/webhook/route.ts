/**
 * POST /api/sds/webhook
 *
 * Receives inbound Slack webhook notifications when a chemical is approved
 * in the procurement/safety workflow. Verifies the Slack request signature,
 * parses the payload, and creates an SDS record stub in the KV queue.
 *
 * Auth: HMAC signature verification (not session-based — machine-to-machine).
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { rateLimit } from '@/lib/rate-limit'
import { kv } from '@/lib/kv'
import type { SdsRecord } from '@/lib/sds-types'
import { escapeSlack } from '@/lib/slack-notify'

const SLACK_VERSION = 'v0'
const MAX_TIMESTAMP_AGE = 5 * 60

function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string
): boolean {
  const secret = process.env.SLACK_SDS_WEBHOOK_SECRET
  if (!secret) return false

  const ts = parseInt(timestamp, 10)
  if (isNaN(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > MAX_TIMESTAMP_AGE) {
    return false
  }

  const sigBasestring = `${SLACK_VERSION}:${timestamp}:${body}`
  const expected = `${SLACK_VERSION}=${createHmac('sha256', secret).update(sigBasestring).digest('hex')}`

  const expectedBuf = Buffer.from(expected)
  const providedBuf = Buffer.from(signature)
  if (expectedBuf.length !== providedBuf.length) return false

  return timingSafeEqual(expectedBuf, providedBuf)
}

interface SlackChemicalApproval {
  chemical_name: string
  cas_number?: string
  manufacturer?: string
  approved_by: string
  approved_at?: string
  project?: string
  location?: string
  sds_pdf_url?: string | null
  notes?: string
  event_id: string
  type?: string
  challenge?: string
}

const processedEvents = new Set<string>()
const MAX_IN_MEMORY_EVENTS = 1000

async function isDuplicate(eventId: string): Promise<boolean> {
  if (!process.env.KV_REST_API_URL) {
    return processedEvents.has(eventId)
  }
  try {
    const existing = await kv.get(`sds-webhook:${eventId}`)
    return existing !== null
  } catch {
    return processedEvents.has(eventId)
  }
}

async function markProcessed(eventId: string): Promise<void> {
  if (processedEvents.size >= MAX_IN_MEMORY_EVENTS) {
    const first = processedEvents.values().next().value
    if (first) processedEvents.delete(first)
  }
  processedEvents.add(eventId)
  if (process.env.KV_REST_API_URL) {
    try {
      await kv.set(`sds-webhook:${eventId}`, '1', { ex: 86400 })
    } catch { /* KV failure non-fatal */ }
  }
}

async function nextServerSdsId(): Promise<string> {
  const year = new Date().getFullYear()
  if (process.env.KV_REST_API_URL) {
    try {
      const count = await kv.incr(`sds-counter:${year}`)
      return `SDS-${year}-${String(count).padStart(4, '0')}`
    } catch { /* fall through to timestamp-based */ }
  }
  const ts = Date.now().toString(36)
  return `SDS-${year}-W${ts}`
}

/** Explicit partial SDS record type for webhook stubs — includes all required
 *  SdsRecord fields so safeParseSdsRecords won't drop it. */
function buildWebhookStub(
  id: string,
  payload: SlackChemicalApproval,
): SdsRecord {
  const now = new Date().toISOString()
  return {
    id,
    productName: (payload.chemical_name || '').slice(0, 500),
    manufacturer: (payload.manufacturer || '').slice(0, 200),
    casNumbers: payload.cas_number ? [payload.cas_number.slice(0, 50)] : [],
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
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
    _searchIndex: [
      (payload.chemical_name || '').slice(0, 500),
      (payload.manufacturer || '').slice(0, 200),
      (payload.cas_number || '').slice(0, 50),
    ].join(' ').toLowerCase(),
  }
}

export async function POST(req: Request) {
  if (!process.env.SLACK_SDS_WEBHOOK_SECRET) {
    return Response.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  const rawBody = await req.text()
  const timestamp = req.headers.get('x-slack-request-timestamp') || ''
  const signature = req.headers.get('x-slack-signature') || ''

  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    console.error('[sds/webhook] signature verification failed')
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'unknown'
  const rl = await rateLimit(`sds-webhook:${ip}`, 30, 60_000)
  if (!rl.ok) {
    return Response.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  let payload: SlackChemicalApproval
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (payload.type === 'url_verification' && payload.challenge) {
    return Response.json({ challenge: payload.challenge })
  }

  if (!payload.chemical_name || !payload.event_id) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (await isDuplicate(payload.event_id)) {
    return Response.json({ ok: true, action: 'already-exists' })
  }

  const sdsId = await nextServerSdsId()
  const sdsStub = buildWebhookStub(sdsId, payload)

  if (!process.env.KV_REST_API_URL) {
    return Response.json({ error: 'KV storage not configured — record not persisted' }, { status: 503 })
  }
  try {
    await kv.lpush('sds-webhook-queue', JSON.stringify(sdsStub))
    await kv.set(`sds:${sdsId}`, JSON.stringify(sdsStub), { ex: 7 * 86400 })
  } catch (e) {
    console.error('[sds/webhook] KV store error:', e instanceof Error ? e.message : e)
    return Response.json({ error: 'Storage temporarily unavailable' }, { status: 502 })
  }

  await markProcessed(payload.event_id)

  if (process.env.SLACK_WEBHOOK_URL) {
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 5000)
    fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abort.signal,
      body: JSON.stringify({
        text: `SDS record created: *${escapeSlack((payload.chemical_name || '').slice(0, 200))}* (${escapeSlack(sdsId)})\nApproved by ${escapeSlack(payload.approved_by || 'unknown')} for ${escapeSlack(payload.project || 'unspecified project')}`,
      }),
    }).catch(() => {}).finally(() => clearTimeout(timer))
  }

  return Response.json({ ok: true, sdsId, action: 'created' })
}
