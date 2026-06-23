# SDS Integration Layer -- Design Proposal

**Round 1 -- Integration & AI Expert**
**Date:** 2026-06-23

---

## 0. Design Principles

This proposal follows every established codebase pattern exactly:

- **Feature-flag gated:** New env vars `NEXT_PUBLIC_SDS_MODULE=1` (client UI) and `SLACK_SDS_WEBHOOK_SECRET` (inbound webhook auth). AI features inherit `NEXT_PUBLIC_AI_ASSIST=1` + `ANTHROPIC_API_KEY`.
- **Graceful degradation:** Every integration is a no-op when unconfigured. Missing Notion keys return 503. Missing AI keys return 503. Missing Slack secret rejects webhooks. The SDS library itself works offline with localStorage (same as safety records).
- **Offline-first:** SDS records are stored client-side in localStorage (keyed `eqr-sds-records`), synced to Notion when online. AI features degrade to structured data lookups when offline.
- **Append-only audit trail:** SDS records follow `SafetyRecordBase` conventions: immutable after creation, changes tracked via `AuditEvent[]`.
- **Existing SDK patterns:** All AI routes use `@anthropic-ai/sdk` with `messages.parse()` + `zodOutputFormat()`, model `claude-sonnet-4-6`, persona "Sage".

---

## 1. SDS Data Model

### 1.1 Core Types

File: `src/lib/sds-types.ts`

```typescript
import type { InspectionSyncStatus } from '@/lib/types'
import type { AuditEvent, RiskLevel } from '@/lib/safety-types'

// ── GHS Hazard Classification ──────────────────────────────────

export type GhsHazardCategory =
  | 'flammable'
  | 'oxidizer'
  | 'compressed-gas'
  | 'corrosive'
  | 'toxic'
  | 'irritant'
  | 'health-hazard'
  | 'environmental'
  | 'explosive'

export type GhsSignalWord = 'danger' | 'warning' | 'none'

// ── SDS Record ─────────────────────────────────────────────────

export interface SdsRecord {
  id: string                    // e.g. "SDS-2026-0001"
  type: 'sds'

  // Section 1: Identification
  productName: string
  manufacturer: string
  manufacturerPhone: string
  emergencyPhone: string        // 24-hour emergency number
  casNumber: string             // CAS registry number (primary identifier)
  productCode: string           // Manufacturer's product code
  synonyms: string[]            // Alternative chemical names

  // Section 2: Hazard Identification
  ghsClassification: GhsHazardCategory[]
  signalWord: GhsSignalWord
  hazardStatements: string[]    // H-codes + text (e.g. "H225: Highly flammable liquid")
  precautionaryStatements: string[]  // P-codes + text

  // Section 3: Composition
  components: ChemicalComponent[]

  // Section 4: First Aid
  firstAid: FirstAidMeasures

  // Section 5: Fire Fighting
  fireFighting: FireFightingMeasures

  // Section 6: Accidental Release
  spillResponse: SpillResponse

  // Section 7: Handling and Storage
  handling: HandlingStorage

  // Section 8: Exposure Controls / PPE
  exposureLimits: ExposureLimit[]
  requiredPpe: RequiredPpe

  // Section 9: Physical/Chemical Properties
  physicalProperties: PhysicalProperties

  // Section 10: Stability and Reactivity
  stability: StabilityInfo

  // Section 11-16: Additional sections (stored as structured text)
  toxicologicalInfo: string
  ecologicalInfo: string
  disposalInfo: string
  transportInfo: TransportInfo
  regulatoryInfo: string

  // Metadata
  sdsRevisionDate: string       // Date on the manufacturer's SDS
  sdsSource: 'manual' | 'parsed' | 'webhook'
  parseConfidence: number | null  // 0-1, only set when sdsSource === 'parsed'
  pdfBlobId: string | null      // Reference to stored PDF (IndexedDB or Vercel Blob)

  // Record management (mirrors SafetyRecordBase pattern)
  createdBy: string
  createdByEmail: string | null
  createdAt: string
  location: string              // Primary site/location where chemical is used
  locations: string[]           // All locations where chemical is present
  projectName: string
  syncStatus: InspectionSyncStatus
  notionPageId: string | null
  events: AuditEvent[]
  approvalStatus: SdsApprovalStatus
  approvedBy: string | null
  approvedAt: string | null

  // Cross-references
  linkedPermitIds: string[]     // Hot work, confined space permits referencing this chemical
  linkedPtpIds: string[]        // PTPs listing this chemical
  linkedIncidentIds: string[]   // Incidents involving this chemical
  linkedEquipmentIds: string[]  // Storage containers, spill kits
}

export type SdsApprovalStatus = 'draft' | 'pending-approval' | 'approved' | 'expired' | 'superseded'

export interface ChemicalComponent {
  name: string
  casNumber: string
  concentration: string        // e.g. "30-60%"
  hazardous: boolean
}

export interface FirstAidMeasures {
  inhalation: string
  skinContact: string
  eyeContact: string
  ingestion: string
  notes: string
}

export interface FireFightingMeasures {
  extinguishingMedia: string[]
  unsuitable: string[]
  specialHazards: string
  protectiveEquipment: string
}

export interface SpillResponse {
  smallSpill: string
  largeSpill: string
  personalPrecautions: string
  environmentalPrecautions: string
  containmentMethods: string[]
}

export interface HandlingStorage {
  handlingPrecautions: string
  storageConditions: string
  incompatibleMaterials: string[]   // Key for storage compatibility checks
  storageTemperature: string
  maxStorageTemp: number | null     // Degrees C, for automated alerts
  minStorageTemp: number | null
}

export interface ExposureLimit {
  substance: string
  oelType: string               // "TWA", "STEL", "Ceiling"
  value: string                 // e.g. "50 ppm" or "200 mg/m3"
  source: string                // e.g. "ACGIH TLV", "OSHA PEL", "NIOSH REL"
}

export interface RequiredPpe {
  respiratory: string
  hand: string
  eye: string
  skin: string
  other: string
}

export interface PhysicalProperties {
  appearance: string
  odor: string
  ph: string
  flashPoint: string            // e.g. "23°C (73°F)"
  flashPointC: number | null    // Numeric for comparisons (hot work permit checks)
  boilingPoint: string
  vaporPressure: string
  specificGravity: string
  solubility: string
  autoIgnitionTemp: string
}

export interface TransportInfo {
  unNumber: string              // UN identification number
  properShippingName: string
  hazardClass: string
  packingGroup: string
}

export interface StabilityInfo {
  stable: boolean
  conditionsToAvoid: string[]
  incompatibleMaterials: string[]
  hazardousDecomposition: string[]
}

// ── Type guard ─────────────────────────────────────────────────

export function isSdsRecord(r: unknown): r is SdsRecord {
  return (
    typeof r === 'object' &&
    r !== null &&
    'type' in r &&
    (r as { type: string }).type === 'sds'
  )
}

// ── Display metadata ───────────────────────────────────────────

export const GHS_CATEGORY_LABELS: Record<GhsHazardCategory, string> = {
  flammable: 'Flammable',
  oxidizer: 'Oxidizer',
  'compressed-gas': 'Compressed Gas',
  corrosive: 'Corrosive',
  toxic: 'Acute Toxicity',
  irritant: 'Irritant / Sensitizer',
  'health-hazard': 'Health Hazard',
  environmental: 'Environmental Hazard',
  explosive: 'Explosive',
}

export const GHS_PICTOGRAM_MAP: Record<GhsHazardCategory, string> = {
  flammable: 'GHS02',
  oxidizer: 'GHS03',
  'compressed-gas': 'GHS04',
  corrosive: 'GHS05',
  toxic: 'GHS06',
  irritant: 'GHS07',
  'health-hazard': 'GHS08',
  environmental: 'GHS09',
  explosive: 'GHS01',
}

export const APPROVAL_STATUS_COLORS: Record<SdsApprovalStatus, string> = {
  draft: 'var(--fg-4)',
  'pending-approval': 'var(--warn)',
  approved: 'var(--ok)',
  expired: 'var(--expired)',
  superseded: 'var(--fg-4)',
}
```

### 1.2 Zod Validation Schema

File: `src/lib/sds-schemas.ts` (follows `src/lib/schemas.ts` pattern)

```typescript
import { z } from 'zod'

export const GhsHazardCategorySchema = z.enum([
  'flammable', 'oxidizer', 'compressed-gas', 'corrosive',
  'toxic', 'irritant', 'health-hazard', 'environmental', 'explosive',
])

export const SdsApprovalStatusSchema = z.enum([
  'draft', 'pending-approval', 'approved', 'expired', 'superseded',
])

export const ChemicalComponentSchema = z.object({
  name: z.string(),
  casNumber: z.string(),
  concentration: z.string(),
  hazardous: z.boolean(),
}).passthrough()

export const FirstAidSchema = z.object({
  inhalation: z.string(),
  skinContact: z.string(),
  eyeContact: z.string(),
  ingestion: z.string(),
  notes: z.string(),
}).passthrough()

export const ExposureLimitSchema = z.object({
  substance: z.string(),
  oelType: z.string(),
  value: z.string(),
  source: z.string(),
}).passthrough()

export const RequiredPpeSchema = z.object({
  respiratory: z.string(),
  hand: z.string(),
  eye: z.string(),
  skin: z.string(),
  other: z.string(),
}).passthrough()

export const PhysicalPropertiesSchema = z.object({
  appearance: z.string(),
  odor: z.string(),
  ph: z.string(),
  flashPoint: z.string(),
  flashPointC: z.number().nullable(),
  boilingPoint: z.string(),
  vaporPressure: z.string(),
  specificGravity: z.string(),
  solubility: z.string(),
  autoIgnitionTemp: z.string(),
}).passthrough()

export const SdsRecordSchema = z.object({
  id: z.string(),
  type: z.literal('sds'),
  productName: z.string(),
  manufacturer: z.string(),
  casNumber: z.string(),
  ghsClassification: z.array(GhsHazardCategorySchema),
  signalWord: z.enum(['danger', 'warning', 'none']),
  hazardStatements: z.array(z.string()),
  precautionaryStatements: z.array(z.string()),
  components: z.array(ChemicalComponentSchema),
  firstAid: FirstAidSchema,
  exposureLimits: z.array(ExposureLimitSchema),
  requiredPpe: RequiredPpeSchema,
  physicalProperties: PhysicalPropertiesSchema,
  // ... remaining fields follow same pattern
  sdsSource: z.enum(['manual', 'parsed', 'webhook']),
  parseConfidence: z.number().nullable(),
  createdBy: z.string(),
  createdByEmail: z.string().nullable(),
  createdAt: z.string(),
  syncStatus: z.enum(['pending', 'synced', 'failed', 'offline']),
  approvalStatus: SdsApprovalStatusSchema,
}).passthrough()

export function safeParseSdsRecords(raw: string): z.infer<typeof SdsRecordSchema>[] {
  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data.filter((item) => {
      const result = SdsRecordSchema.safeParse(item)
      if (!result.success) {
        console.warn('[sds] invalid record dropped:', result.error.issues[0]?.message)
      }
      return result.success
    })
  } catch {
    return []
  }
}
```

---

## 2. API Routes

### 2.1 `POST /api/sds/sync` -- Sync SDS Records to Notion

File: `src/app/api/sds/sync/route.ts`

Follows the exact pattern of `src/app/api/safety/sync/route.ts`.

```typescript
/**
 * POST /api/sds/sync
 *
 * Pushes an SDS record to the Notion SDS database. Uses the raw Notion
 * REST API (no SDK). Degrades gracefully: if NOTION_API_KEY or
 * NOTION_SDS_DB_ID is unset, returns 503.
 */

import type { SdsRecord } from '@/lib/sds-types'
import { requireSession } from '@/lib/api-auth'

const NOTION_VERSION = '2022-06-28'

// ── Request ────────────────────────────────────────────────────
// Body: SdsRecord (full JSON, same shape as client-side record)

// ── Response ───────────────────────────────────────────────────
interface SyncResponse {
  ok: boolean
  notionPageId?: string
  error?: string
}

export async function POST(req: Request) {
  const { session, error } = await requireSession()
  if (error) return error

  const key = process.env.NOTION_API_KEY
  const dbId = process.env.NOTION_SDS_DB_ID

  let record: SdsRecord
  try {
    record = (await req.json()) as SdsRecord
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Input validation (mirrors safety/sync pattern)
  if (!record?.id || typeof record.id !== 'string' || record.id.length > 100) {
    return Response.json({ error: 'Invalid record id' }, { status: 400 })
  }
  if (record?.type !== 'sds') {
    return Response.json({ error: 'Invalid record type' }, { status: 400 })
  }

  // Owner validation
  if (session!.user!.email) {
    if (record.createdByEmail && record.createdByEmail !== session!.user!.email) {
      return Response.json({ error: 'Record owner mismatch' }, { status: 403 })
    }
  }

  if (!key || !dbId) {
    return Response.json(
      { error: 'Notion integration not configured',
        message: 'Set NOTION_API_KEY and NOTION_SDS_DB_ID.' },
      { status: 503 }
    )
  }

  try {
    // Dedup: check for existing record by SDS ID
    const existingCheck = await fetch(
      `https://api.notion.com/v1/databases/${dbId}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: { property: 'ID', title: { equals: record.id } },
          page_size: 1,
        }),
      }
    )
    if (existingCheck.ok) {
      const existing = (await existingCheck.json()) as { results: { id: string }[] }
      if (existing.results.length > 0) {
        return Response.json({ ok: true, notionPageId: existing.results[0].id })
      }
    }

    // Build Notion properties -- SDS-specific columns
    const properties: Record<string, unknown> = {
      ID: { title: [{ text: { content: record.id } }] },
      'Product Name': { rich_text: [{ text: { content: record.productName } }] },
      Manufacturer: { rich_text: [{ text: { content: record.manufacturer } }] },
      'CAS Number': { rich_text: [{ text: { content: record.casNumber } }] },
      'Signal Word': { select: { name: record.signalWord || 'none' } },
      'GHS Hazards': {
        multi_select: record.ghsClassification.map((c) => ({ name: c })),
      },
      Location: { rich_text: [{ text: { content: record.location || '' } }] },
      'Created By': { rich_text: [{ text: { content: record.createdBy || '' } }] },
      'Created At': { date: { start: record.createdAt } },
      'SDS Revision Date': record.sdsRevisionDate
        ? { date: { start: record.sdsRevisionDate } }
        : undefined,
      'Approval Status': { select: { name: record.approvalStatus } },
      'Sync Source': { select: { name: 'sage-ehs' } },
    }

    // Full record as JSON code blocks in the page body (same chunking as safety/sync)
    const fullJson = JSON.stringify(record, null, 2)
    const CHUNK_SIZE = 1900
    const children = []
    for (let i = 0; i < fullJson.length; i += CHUNK_SIZE) {
      children.push({
        object: 'block' as const,
        type: 'code' as const,
        code: {
          language: 'json',
          rich_text: [{ type: 'text' as const, text: { content: fullJson.slice(i, i + CHUNK_SIZE) } }],
        },
      })
    }

    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parent: { database_id: dbId }, properties, children }),
    })

    if (!res.ok) {
      console.error('[sds/sync] Notion API error:', await res.text())
      return Response.json({ error: 'Notion sync failed' }, { status: 502 })
    }

    const page = (await res.json()) as { id: string }
    return Response.json({ ok: true, notionPageId: page.id })
  } catch (e) {
    console.error('[sds/sync] unexpected error:', e instanceof Error ? e.message : e)
    return Response.json({ error: 'Sync failed' }, { status: 500 })
  }
}
```

**Auth:** `requireSession()` -- same as `safety/sync`.
**Rate limiting:** Not applied (sync is already throttled client-side by `trySyncRecord` with exponential backoff and dedup guards).
**Error handling:** 400 (bad input), 403 (owner mismatch), 502 (Notion error), 503 (not configured), 500 (unexpected).

---

### 2.2 `POST /api/sds/webhook` -- Slack Inbound Webhook

File: `src/app/api/sds/webhook/route.ts`

This is the *inbound* webhook handler -- Slack sends data *to* us. This is architecturally different from the existing `slack-notify.ts` (which sends *outbound* messages). The existing codebase has no inbound webhook handler, so this is a new pattern.

```typescript
/**
 * POST /api/sds/webhook
 *
 * Receives inbound Slack webhook notifications when a chemical is approved
 * in the procurement/safety workflow. Verifies the Slack request signature,
 * parses the payload, and creates/updates an SDS record stub.
 *
 * This is NOT an authenticated user request -- it's a machine-to-machine
 * webhook. Auth is via HMAC signature verification using SLACK_SDS_WEBHOOK_SECRET.
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { rateLimit } from '@/lib/rate-limit'

// ── Slack Signature Verification ──────────────────────────────

const SLACK_VERSION = 'v0'
const MAX_TIMESTAMP_AGE = 5 * 60 // 5 minutes (replay protection)

function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string
): boolean {
  const secret = process.env.SLACK_SDS_WEBHOOK_SECRET
  if (!secret) return false

  // Replay protection
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

// ── Webhook Payload Types ─────────────────────────────────────

interface SlackChemicalApproval {
  chemical_name: string
  cas_number: string
  manufacturer: string
  approved_by: string
  approved_at: string           // ISO 8601
  project: string
  location: string
  sds_pdf_url: string | null    // URL to download the manufacturer SDS PDF
  notes: string
  // Slack's unique event ID -- used for idempotency
  event_id: string
}

interface WebhookResponse {
  ok: boolean
  sdsId?: string
  action?: 'created' | 'already-exists'
  error?: string
}

// ── Idempotency ───────────────────────────────────────────────
// Use Upstash KV to track processed webhook event IDs. The key
// `sds-webhook:{event_id}` is set with a 24-hour TTL. If the key
// already exists, the webhook is a duplicate and we return success
// without reprocessing. Falls back to a Set in memory (per-instance
// only) if KV is unavailable.

import { kv } from '@/lib/kv'

const processedEvents = new Set<string>()

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
  processedEvents.add(eventId)
  if (process.env.KV_REST_API_URL) {
    try {
      await kv.set(`sds-webhook:${eventId}`, '1', { ex: 86400 })
    } catch {
      // KV failure is non-fatal; in-memory set is the fallback
    }
  }
}

export async function POST(req: Request) {
  // Gate: webhook secret must be configured
  if (!process.env.SLACK_SDS_WEBHOOK_SECRET) {
    return Response.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  // Rate limit by IP (machine-to-machine, no user email)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = await rateLimit(`sds-webhook:${ip}`, 30, 60_000)
  if (!rl.ok) {
    return Response.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  // Read raw body for signature verification (must be done before parsing)
  const rawBody = await req.text()
  const timestamp = req.headers.get('x-slack-request-timestamp') || ''
  const signature = req.headers.get('x-slack-signature') || ''

  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    console.error('[sds/webhook] signature verification failed')
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Slack URL verification challenge (standard for Slack Event Subscriptions)
  let payload: SlackChemicalApproval & { type?: string; challenge?: string }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Handle Slack's url_verification challenge
  if (payload.type === 'url_verification' && payload.challenge) {
    return Response.json({ challenge: payload.challenge })
  }

  // Validate required fields
  if (!payload.chemical_name || !payload.event_id) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Idempotency check
  if (await isDuplicate(payload.event_id)) {
    return Response.json({ ok: true, action: 'already-exists' })
  }

  // Create SDS record stub from webhook data.
  // This is a STUB -- it has identification + approval data from the
  // procurement system but NOT full SDS content. Full content comes from
  // either: (a) the AI parser processing the linked PDF, or (b) manual entry.
  const sdsId = generateSdsId()    // Sequential ID: SDS-2026-NNNN
  const sdsStub = {
    id: sdsId,
    type: 'sds' as const,
    productName: payload.chemical_name,
    manufacturer: payload.manufacturer || '',
    casNumber: payload.cas_number || '',
    sdsSource: 'webhook' as const,
    approvalStatus: 'approved' as const,
    approvedBy: payload.approved_by,
    approvedAt: payload.approved_at,
    location: payload.location || '',
    projectName: payload.project || '',
    createdBy: 'Slack Webhook',
    createdByEmail: null,
    createdAt: new Date().toISOString(),
    syncStatus: 'pending' as const,
    notionPageId: null,
    events: [
      {
        action: 'created' as const,
        by: 'Slack Webhook',
        byEmail: null,
        at: new Date().toISOString(),
        note: `Chemical approved by ${payload.approved_by}. Event: ${payload.event_id}`,
      },
    ],
    // If a PDF URL was included, store it for later AI parsing
    _pendingPdfUrl: payload.sds_pdf_url || null,
  }

  // Store stub in KV for client pickup (7-day TTL).
  // Clients poll for new webhook-created records on their next sync cycle.
  if (process.env.KV_REST_API_URL) {
    try {
      // Push to a list of pending SDS records
      await kv.lpush('sds-webhook-queue', JSON.stringify(sdsStub))
      // Also store individually for direct lookup
      await kv.set(`sds:${sdsId}`, JSON.stringify(sdsStub), { ex: 7 * 86400 })
    } catch (e) {
      console.error('[sds/webhook] KV store error:', e instanceof Error ? e.message : e)
      // Non-fatal: the webhook was valid, but storage failed. Return 502 so
      // Slack retries (Slack retries 429/500/502 up to 3 times).
      return Response.json({ error: 'Storage temporarily unavailable' }, { status: 502 })
    }
  }

  await markProcessed(payload.event_id)

  // Optional: sync to Notion immediately
  if (process.env.NOTION_API_KEY && process.env.NOTION_SDS_DB_ID) {
    // Fire-and-forget Notion sync (don't block webhook response)
    syncSdsStubToNotion(sdsStub).catch((e) => {
      console.error('[sds/webhook] Notion sync failed:', e instanceof Error ? e.message : e)
    })
  }

  // Send confirmation to Slack channel (outbound, best-effort)
  if (process.env.SLACK_WEBHOOK_URL) {
    fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `SDS record created: *${payload.chemical_name}* (${sdsId})\nApproved by ${payload.approved_by} for ${payload.project || 'unspecified project'}`,
      }),
    }).catch(() => {})
  }

  return Response.json({ ok: true, sdsId, action: 'created' })
}

// Helper: sequential SDS ID generator (same pattern as safety-records.ts)
function generateSdsId(): string {
  const year = new Date().getFullYear()
  const seq = Math.floor(Math.random() * 9000) + 1000  // Temporary; real impl uses KV counter
  return `SDS-${year}-${String(seq).padStart(4, '0')}`
}

// Helper: fire-and-forget Notion sync for webhook-created stubs
async function syncSdsStubToNotion(stub: Record<string, unknown>): Promise<void> {
  // Same Notion page creation logic as /api/sds/sync
  // Extracted to avoid duplication -- real impl shares with sync route
}
```

**Auth:** HMAC signature verification (`X-Slack-Signature` + `X-Slack-Request-Timestamp`), NOT session-based.
**Rate limiting:** 30 requests/minute per IP (Slack sends from a small set of IPs).
**Idempotency:** KV-backed event ID dedup with 24-hour TTL, in-memory fallback.
**Client notification strategy:** KV queue (`sds-webhook-queue`). Clients check this on their next sync cycle (polling on visibility, same as existing `trySyncRecord` pattern). No SSE/WebSocket needed -- the existing sync-on-reconnect pattern handles this naturally.

---

### 2.3 `POST /api/sds/parse` -- AI-Powered SDS PDF Parsing

File: `src/app/api/sds/parse/route.ts`

Follows the exact pattern of `src/app/api/safety/parse-document/route.ts` (which already handles base64 PDFs sent to Claude).

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'

const SYSTEM_PROMPT = `You are Sage, an EHS chemical safety specialist. A worker has uploaded a manufacturer's Safety Data Sheet (SDS) PDF. Your job is to extract ALL 16 GHS-standard sections into a structured format.

CRITICAL INSTRUCTIONS:
1. Extract data EXACTLY as printed on the SDS. Do not paraphrase or summarize safety-critical fields (first aid measures, exposure limits, PPE requirements). Copy them verbatim where possible.
2. For each field you extract, assign a confidence score from 0.0 to 1.0:
   - 1.0: Clearly printed, unambiguous, standard location in the SDS
   - 0.8-0.9: Readable but in a non-standard location or format
   - 0.5-0.7: Partially legible, inferred from context, or found in an unexpected section
   - Below 0.5: Guessed or not found (use empty string and flag for human review)
3. CAS numbers must match the format XXXXX-XX-X (digits with two dashes). If you cannot confidently read the CAS number, leave it empty -- a wrong CAS number is worse than none.
4. GHS classification: Map the pictograms and hazard codes to the standard categories. Look for the diamond-shaped pictogram descriptions or H-code numbers.
5. Flash point: Extract BOTH the text representation (e.g. "23 C (73 F)") AND a numeric Celsius value for automated hot-work permit checks.
6. Incompatible materials (Section 10): This is critical for storage compatibility checks. Extract ALL listed incompatibilities.
7. If the PDF is not an SDS (e.g., a random document, a TDS, a product brochure), set productName to "" and return empty arrays.

COMMON SDS FORMATS: Manufacturers use varying layouts. The 16-section GHS structure is standard but presentation differs. Section headers may be numbered ("SECTION 8") or named ("Exposure Controls"). Some SDSs combine sections. Always try to locate the data even if the format is non-standard.`

const ParsedSdsSchema = z.object({
  productName: z.string(),
  manufacturer: z.string(),
  manufacturerPhone: z.string(),
  emergencyPhone: z.string(),
  casNumber: z.string(),
  productCode: z.string(),
  synonyms: z.array(z.string()),

  ghsClassification: z.array(z.enum([
    'flammable', 'oxidizer', 'compressed-gas', 'corrosive',
    'toxic', 'irritant', 'health-hazard', 'environmental', 'explosive',
  ])),
  signalWord: z.enum(['danger', 'warning', 'none']),
  hazardStatements: z.array(z.string()),
  precautionaryStatements: z.array(z.string()),

  components: z.array(z.object({
    name: z.string(),
    casNumber: z.string(),
    concentration: z.string(),
    hazardous: z.boolean(),
  })),

  firstAid: z.object({
    inhalation: z.string(),
    skinContact: z.string(),
    eyeContact: z.string(),
    ingestion: z.string(),
    notes: z.string(),
  }),

  fireFighting: z.object({
    extinguishingMedia: z.array(z.string()),
    unsuitable: z.array(z.string()),
    specialHazards: z.string(),
    protectiveEquipment: z.string(),
  }),

  spillResponse: z.object({
    smallSpill: z.string(),
    largeSpill: z.string(),
    personalPrecautions: z.string(),
    environmentalPrecautions: z.string(),
    containmentMethods: z.array(z.string()),
  }),

  handling: z.object({
    handlingPrecautions: z.string(),
    storageConditions: z.string(),
    incompatibleMaterials: z.array(z.string()),
    storageTemperature: z.string(),
  }),

  exposureLimits: z.array(z.object({
    substance: z.string(),
    oelType: z.string(),
    value: z.string(),
    source: z.string(),
  })),

  requiredPpe: z.object({
    respiratory: z.string(),
    hand: z.string(),
    eye: z.string(),
    skin: z.string(),
    other: z.string(),
  }),

  physicalProperties: z.object({
    appearance: z.string(),
    odor: z.string(),
    ph: z.string(),
    flashPoint: z.string(),
    flashPointC: z.number().nullable(),
    boilingPoint: z.string(),
    vaporPressure: z.string(),
    specificGravity: z.string(),
    solubility: z.string(),
    autoIgnitionTemp: z.string(),
  }),

  stability: z.object({
    stable: z.boolean(),
    conditionsToAvoid: z.array(z.string()),
    incompatibleMaterials: z.array(z.string()),
    hazardousDecomposition: z.array(z.string()),
  }),

  transportInfo: z.object({
    unNumber: z.string(),
    properShippingName: z.string(),
    hazardClass: z.string(),
    packingGroup: z.string(),
  }),

  toxicologicalInfo: z.string(),
  ecologicalInfo: z.string(),
  disposalInfo: z.string(),
  regulatoryInfo: z.string(),

  sdsRevisionDate: z.string(),

  // Per-section confidence scores for human review
  confidence: z.object({
    identification: z.number(),
    hazardClassification: z.number(),
    composition: z.number(),
    firstAid: z.number(),
    fireFighting: z.number(),
    spillResponse: z.number(),
    handlingStorage: z.number(),
    exposureControls: z.number(),
    physicalProperties: z.number(),
    stability: z.number(),
    toxicological: z.number(),
    transport: z.number(),
    overall: z.number(),
  }),
})

export type ParsedSds = z.infer<typeof ParsedSdsSchema>

export const maxDuration = 120  // SDS PDFs can be 10+ pages; parsing is slow

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_AI_ASSIST !== '1') {
    return Response.json({ error: 'AI assist is not enabled' }, { status: 404 })
  }

  const { session, error } = await requireSession()
  if (error) return error

  // Tighter rate limit: SDS parsing is expensive (large PDFs, 4096 tokens out)
  const rl = await rateLimit(`sds-parse:${session!.user!.email}`, 3, 60_000)
  if (!rl.ok) {
    return Response.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return Response.json({ error: 'AI assistant not configured' }, { status: 503 })
  }

  let body: { documentBase64?: string; fileName?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const documentBase64 = (body.documentBase64 ?? '').trim()
  if (!documentBase64) {
    return Response.json({ error: 'No PDF provided' }, { status: 400 })
  }
  // ~6.7MB of base64 ~ 5MB PDF (SDSs can be long; slightly higher than the
  // existing 3MB limit for work documents since manufacturer SDSs are dense)
  if (documentBase64.length > 6_700_000) {
    return Response.json({ error: 'PDF too large -- keep it under 5MB' }, { status: 413 })
  }

  const fileName = (body.fileName ?? 'uploaded SDS').slice(0, 200)

  const content: Anthropic.MessageParam['content'] = [
    {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: documentBase64 },
    },
    {
      type: 'text',
      text: `Extract all 16 GHS sections from this Safety Data Sheet ("${fileName}"). Include confidence scores for each section.`,
    },
  ]

  try {
    const client = new Anthropic({ apiKey: key })
    const message = await client.messages.parse({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,  // SDS extraction needs more output tokens
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
      output_config: { format: zodOutputFormat(ParsedSdsSchema) },
    })

    const result = message.parsed_output
    if (!result || !result.productName) {
      return Response.json(
        { error: 'Could not identify this as an SDS. Make sure the uploaded PDF is a manufacturer Safety Data Sheet.' },
        { status: 422 }
      )
    }

    // Flag sections needing human review (confidence < 0.7)
    const lowConfidenceSections = Object.entries(result.confidence)
      .filter(([key, value]) => key !== 'overall' && (value as number) < 0.7)
      .map(([key]) => key)

    return Response.json({
      ...result,
      _reviewRequired: lowConfidenceSections.length > 0,
      _lowConfidenceSections: lowConfidenceSections,
    })
  } catch (err) {
    console.error('[sage] sds-parse failed:', err instanceof Error ? err.message : err)
    return Response.json(
      { error: 'Sage is temporarily unavailable' },
      { status: 502 }
    )
  }
}
```

**Auth:** `requireSession()`.
**Rate limiting:** 3 requests/minute per user (expensive AI operation -- large PDFs, 8192 output tokens).
**Confidence scoring:** Each of the 12 extractable sections gets a 0-1 confidence score. Sections below 0.7 are flagged in `_lowConfidenceSections` for the UI to highlight with a review prompt.
**Human review step:** The response includes `_reviewRequired: boolean` and `_lowConfidenceSections: string[]`. The client displays these as amber-highlighted fields with "Verify this section" prompts. The record is NOT auto-saved -- the user must review and confirm.

---

### 2.4 `GET /api/sds/search` -- Server-Side Chemical Search

File: `src/app/api/sds/search/route.ts`

```typescript
import { requireSession } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'

// ── Request ──────────────────────────────────────────────────
// Query params:
//   q: string (search term, min 2 chars)
//   field: 'name' | 'cas' | 'manufacturer' | 'any' (default: 'any')
//   limit: number (default: 20, max: 50)

// ── Response ─────────────────────────────────────────────────
interface SearchResult {
  id: string
  productName: string
  manufacturer: string
  casNumber: string
  signalWord: string
  ghsClassification: string[]
  location: string
  approvalStatus: string
}

interface SearchResponse {
  results: SearchResult[]
  total: number
  error?: string
}

const NOTION_VERSION = '2022-06-28'

export async function GET(req: Request) {
  const { session, error } = await requireSession()
  if (error) return error

  const rl = await rateLimit(`sds-search:${session!.user!.email}`, 20, 60_000)
  if (!rl.ok) {
    return Response.json(
      { results: [], total: 0, error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200)
  const field = url.searchParams.get('field') || 'any'
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50)

  if (!q || q.length < 2) {
    return Response.json({ results: [], total: 0, error: 'Query too short (min 2 chars)' }, { status: 400 })
  }

  const key = process.env.NOTION_API_KEY
  const dbId = process.env.NOTION_SDS_DB_ID
  if (!key || !dbId) {
    // Notion not configured: return empty set. Client-side search of local
    // records is the primary search path; this server endpoint is supplementary.
    return Response.json({ results: [], total: 0 })
  }

  // Build Notion filter based on search field
  const fieldFilters: Record<string, unknown> = {
    name: { property: 'Product Name', rich_text: { contains: q } },
    cas: { property: 'CAS Number', rich_text: { contains: q } },
    manufacturer: { property: 'Manufacturer', rich_text: { contains: q } },
  }

  const filter = field === 'any'
    ? { or: Object.values(fieldFilters) }
    : fieldFilters[field] || fieldFilters['name']

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filter, page_size: limit }),
    })

    if (!res.ok) {
      console.error('[sds/search] Notion query error:', await res.text())
      return Response.json({ results: [], total: 0, error: 'Search failed' }, { status: 502 })
    }

    const data = (await res.json()) as {
      results: { id: string; properties: Record<string, unknown> }[]
    }

    const results: SearchResult[] = data.results.map((page) => ({
      id: extractTitle(page.properties['ID']),
      productName: extractRichText(page.properties['Product Name']),
      manufacturer: extractRichText(page.properties['Manufacturer']),
      casNumber: extractRichText(page.properties['CAS Number']),
      signalWord: extractSelect(page.properties['Signal Word']),
      ghsClassification: extractMultiSelect(page.properties['GHS Hazards']),
      location: extractRichText(page.properties['Location']),
      approvalStatus: extractSelect(page.properties['Approval Status']),
    }))

    return Response.json({ results, total: results.length })
  } catch (e) {
    console.error('[sds/search] unexpected error:', e instanceof Error ? e.message : e)
    return Response.json({ results: [], total: 0, error: 'Search failed' }, { status: 500 })
  }
}

// Notion property extraction helpers
function extractTitle(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return ''
  const p = prop as { title?: { plain_text?: string }[] }
  return p.title?.[0]?.plain_text ?? ''
}
function extractRichText(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return ''
  const p = prop as { rich_text?: { plain_text?: string }[] }
  return p.rich_text?.[0]?.plain_text ?? ''
}
function extractSelect(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return ''
  return (prop as { select?: { name?: string } }).select?.name ?? ''
}
function extractMultiSelect(prop: unknown): string[] {
  if (!prop || typeof prop !== 'object') return []
  return ((prop as { multi_select?: { name: string }[] }).multi_select ?? []).map((s) => s.name)
}
```

**Auth:** `requireSession()`.
**Rate limiting:** 20 requests/minute per user.
**Note:** Server-side search is *supplementary* to client-side search. The client searches its local localStorage records first (instant, works offline). This endpoint lets the client search the full Notion SDS database when the local dataset is incomplete (e.g., a new device that hasn't synced all records, or searching for chemicals at other project sites).

---

## 3. Slack Webhook Integration -- Full Workflow

### 3.1 End-to-End Flow

```
Procurement System                Sage EHS
(external)                        (this app)
    |                                 |
    |  1. Chemical approved in        |
    |     procurement/safety system   |
    |                                 |
    v                                 |
  Slack ──── POST /api/sds/webhook ──>|
    |    (HMAC-signed payload)        |
    |                                 |  2. Verify Slack signature
    |                                 |  3. Check idempotency (KV)
    |                                 |  4. Create SDS stub record
    |                                 |  5. Push to KV queue
    |                                 |  6. Fire-and-forget Notion sync
    |                                 |  7. Send confirmation to Slack
    |                                 |
    |                                 |  --- Later (async) ---
    |                                 |
    |                     Client <----|  8. Client polls /api/sds/webhook-queue
    |                                 |     on next sync cycle (visibility change,
    |                                 |     online event, or manual refresh)
    |                                 |
    |                                 |  9. If sds_pdf_url was included:
    |                                 |     Client offers "Parse SDS PDF" button
    |                                 |     -> POST /api/sds/parse
    |                                 |     -> AI extracts structured data
    |                                 |     -> Human reviews + confirms
    |                                 |     -> SDS stub upgraded to full record
```

### 3.2 What Data Comes From Where

| Data                    | Source               | Notes                                  |
|------------------------|----------------------|----------------------------------------|
| Chemical name          | Slack webhook        | From procurement system                |
| CAS number             | Slack webhook        | May be empty; filled during SDS parse  |
| Manufacturer           | Slack webhook        | From procurement/PO                    |
| Approval status/by/at  | Slack webhook        | Authoritative source                   |
| Project + location     | Slack webhook        | From procurement context               |
| SDS PDF URL            | Slack webhook        | Optional; if provided, enables AI parse|
| Full SDS content       | AI parse (route 2.3) | Extracted from PDF by Claude           |
| Confidence scores      | AI parse (route 2.3) | For human review step                  |
| Cross-references       | Client-side linking  | PTPs, permits, incidents linked later  |

### 3.3 Client-Side Update Mechanism

No WebSocket or SSE is needed. The existing sync architecture handles this:

1. **`installSyncListeners()`** already runs a sync on `online` events and page visibility changes.
2. A new `checkWebhookQueue()` function (in `src/lib/sds-sync.ts`) calls `GET /api/sds/webhook-queue` to drain the KV queue.
3. New records are merged into localStorage, triggering `onSdsChange()` listeners (same pub/sub pattern as `onSafetyChange()`).
4. The SDS list UI re-renders via the change listener.

```typescript
// src/lib/sds-sync.ts (follows safety-sync.ts pattern)

export async function checkWebhookQueue(): Promise<number> {
  try {
    const res = await fetch('/api/sds/webhook-queue')
    if (!res.ok) return 0
    const { records } = await res.json()
    if (!Array.isArray(records) || records.length === 0) return 0

    // Merge into local storage, deduplicating by ID
    const existing = getAllSdsRecords()
    const existingIds = new Set(existing.map((r) => r.id))
    let added = 0
    for (const stub of records) {
      if (!existingIds.has(stub.id)) {
        saveSdsRecord(stub)
        added++
      }
    }
    return added
  } catch {
    return 0  // Offline or error -- non-fatal
  }
}
```

Supporting endpoint: `GET /api/sds/webhook-queue` (drains the KV queue):

```typescript
// src/app/api/sds/webhook-queue/route.ts

import { requireSession } from '@/lib/api-auth'
import { kv } from '@/lib/kv'

export async function GET(req: Request) {
  const { session, error } = await requireSession()
  if (error) return error

  if (!process.env.KV_REST_API_URL) {
    return Response.json({ records: [] })
  }

  try {
    // Pop up to 10 records from the queue
    const records = []
    for (let i = 0; i < 10; i++) {
      const raw = await kv.rpop('sds-webhook-queue')
      if (!raw) break
      try {
        records.push(JSON.parse(raw as string))
      } catch {
        // Drop malformed entries
      }
    }
    return Response.json({ records })
  } catch {
    return Response.json({ records: [] })
  }
}
```

---

## 4. AI-Powered Features

### 4.1 SDS PDF Parser

Covered in full in section 2.3. Key design decisions:

- **Prompt template:** Instructs Claude to extract verbatim safety-critical text (never paraphrase first-aid measures or exposure limits). This is a regulatory requirement -- SDS data must be copied exactly.
- **Confidence scoring:** 12 per-section confidence scores (0-1) so the UI can highlight unreliable extractions.
- **Human review gate:** The parsed data is returned to the client as a *preview*. The UI shows it in a review form where every field is editable. Sections with confidence < 0.7 are highlighted amber. The user must click "Confirm & Save" to persist the record -- there is no auto-save from AI output.
- **PDF size limit:** 5MB (vs. 3MB for work documents) because manufacturer SDSs are typically 8-16 pages of dense tabular content.
- **Output tokens:** 8192 (vs. 4096 for JHA parse) to accommodate the full 16-section extraction.
- **`maxDuration`:** 120 seconds (vs. 60 for other routes) because multi-page PDF extraction is slower.

### 4.2 Chemical Hazard Q&A (SageTriage Integration)

The existing SageTriage system (`/api/sage/triage`) already accepts a `context` string from the client. The integration is primarily client-side: when the user is on an SDS-related page or asks a chemical question, the client injects SDS data into the context block.

#### 4.2.1 Client-Side Context Injection

File: `src/lib/sage-context.ts` -- extend `buildSageContext()`:

```typescript
// Add to the existing buildSageContext function in sage-context.ts

import { getAllSdsRecords, getSdsRecordById } from './sds-records'

export interface SageContext {
  pageUrl: string
  userName: string | null
  timeOfDay: string
  ptpSummary: string | null
  permitSummary: string | null
  recentIncidentCount: number
  sdsSummary: string | null          // NEW
  activeChemicalContext: string | null // NEW: when viewing a specific SDS
}

function summarizeSdsLibrary(): string | null {
  const records = getAllSdsRecords()
  if (records.length === 0) return null

  const dangerChemicals = records.filter((r) => r.signalWord === 'danger')
  const lines = [
    `SDS LIBRARY: ${records.length} chemicals on site`,
    dangerChemicals.length > 0
      ? `DANGER chemicals: ${dangerChemicals.map((r) => r.productName).join(', ')}`
      : null,
  ]
  return lines.filter(Boolean).join('\n')
}

function summarizeActiveSds(sdsId: string): string | null {
  const sds = getSdsRecordById(sdsId)
  if (!sds) return null

  const lines = [
    `ACTIVE SDS: ${sds.productName} (${sds.manufacturer})`,
    `CAS: ${sds.casNumber || 'not specified'}`,
    `Signal word: ${sds.signalWord}`,
    `GHS hazards: ${sds.ghsClassification.join(', ') || 'none classified'}`,
    `PPE required: respiratory=${sds.requiredPpe.respiratory}, hand=${sds.requiredPpe.hand}, eye=${sds.requiredPpe.eye}, skin=${sds.requiredPpe.skin}`,
    `First aid (inhalation): ${sds.firstAid.inhalation}`,
    `First aid (skin): ${sds.firstAid.skinContact}`,
    `First aid (eye): ${sds.firstAid.eyeContact}`,
    `First aid (ingestion): ${sds.firstAid.ingestion}`,
    sds.handling.incompatibleMaterials.length > 0
      ? `INCOMPATIBLE WITH: ${sds.handling.incompatibleMaterials.join(', ')}`
      : null,
    sds.physicalProperties.flashPointC !== null
      ? `Flash point: ${sds.physicalProperties.flashPoint} (${sds.physicalProperties.flashPointC}C)`
      : null,
    `Spill response (small): ${sds.spillResponse.smallSpill}`,
  ]
  return lines.filter(Boolean).join('\n')
}
```

#### 4.2.2 Triage System Prompt Extension

Add to the existing `SYSTEM_PROMPT` in `/api/sage/triage/route.ts`:

```
CHEMICAL SAFETY / SDS:
When the context includes SDS data and the worker asks about chemicals:
- PPE questions: Answer from the SDS Section 8 data in context. Be specific about the protection level (e.g., "nitrile gloves, not latex" if the SDS specifies it).
- Storage compatibility: Check the incompatibleMaterials list. If two chemicals are both in context and one appears in the other's incompatible list, flag it clearly: "[Chemical A] must not be stored near [Chemical B] — the SDS lists [reason]."
- First aid: Quote the SDS first-aid measures directly. Do not paraphrase or simplify — safety data must be exact. Preface with "According to the SDS for [product name]:"
- Spill response: Use the SDS Section 6 data. Distinguish small vs. large spills.
- Do NOT guess chemical properties not in the context. If the SDS data is not available, say "I don't have the SDS for that chemical loaded. Check the SDS Binder (Safety → SDS Binder) or ask your supervisor."

APP NAVIGATION (add):
- SDS Binder: /safety/sds
- SDS Detail: /safety/sds/[id]
```

#### 4.2.3 Example Q&A Interactions

| Worker Question | Sage Response Source | Online/Offline |
|---|---|---|
| "What PPE do I need for acetone?" | SDS record in context → Section 8 | Both (structured data lookup) |
| "Can I store bleach near ammonia?" | SDS incompatibleMaterials cross-check | Both (structured data lookup) |
| "First aid for acid skin contact?" | SDS record in context → Section 4 | Both (structured data lookup) |
| "Is this chemical okay for hot work?" | Flash point from SDS → compare to hot work permit | Both (numeric comparison) |
| "What are the health effects of long-term exposure to [chemical]?" | AI with SDS Section 11 in context | Online only |

#### 4.2.4 Offline Fallback

When offline (or AI disabled), chemical Q&A falls back to direct structured data lookup without AI. This is implemented client-side:

```typescript
// src/lib/sds-lookup.ts -- Offline chemical Q&A

import type { SdsRecord } from '@/lib/sds-types'

export interface SdsLookupResult {
  found: boolean
  productName: string
  answer: string
  source: 'sds-section-4' | 'sds-section-8' | 'sds-section-6' | 'sds-section-10' | 'sds-section-7'
}

export function lookupPpe(sds: SdsRecord): SdsLookupResult {
  return {
    found: true,
    productName: sds.productName,
    answer: [
      `PPE for ${sds.productName}:`,
      `Respiratory: ${sds.requiredPpe.respiratory || 'Not specified'}`,
      `Gloves: ${sds.requiredPpe.hand || 'Not specified'}`,
      `Eye protection: ${sds.requiredPpe.eye || 'Not specified'}`,
      `Skin protection: ${sds.requiredPpe.skin || 'Not specified'}`,
    ].join('\n'),
    source: 'sds-section-8',
  }
}

export function lookupFirstAid(sds: SdsRecord, route: 'inhalation' | 'skinContact' | 'eyeContact' | 'ingestion'): SdsLookupResult {
  return {
    found: true,
    productName: sds.productName,
    answer: `First aid for ${sds.productName} (${route}):\n${sds.firstAid[route]}`,
    source: 'sds-section-4',
  }
}

export function checkStorageCompatibility(
  chemA: SdsRecord,
  chemB: SdsRecord
): { compatible: boolean; reason: string } {
  const aIncompat = chemA.handling.incompatibleMaterials.map((m) => m.toLowerCase())
  const bIncompat = chemB.handling.incompatibleMaterials.map((m) => m.toLowerCase())

  const aName = chemA.productName.toLowerCase()
  const bName = chemB.productName.toLowerCase()

  // Check if either chemical lists the other (or its GHS categories) as incompatible
  const aListsB = aIncompat.some((m) =>
    bName.includes(m) || chemB.ghsClassification.some((c) => m.includes(c))
  )
  const bListsA = bIncompat.some((m) =>
    aName.includes(m) || chemA.ghsClassification.some((c) => m.includes(c))
  )

  if (aListsB || bListsA) {
    return {
      compatible: false,
      reason: `${chemA.productName} and ${chemB.productName} must not be stored together. ` +
        (aListsB ? `${chemA.productName}'s SDS lists incompatibility.` : '') +
        (bListsA ? `${chemB.productName}'s SDS lists incompatibility.` : ''),
    }
  }

  return { compatible: true, reason: 'No incompatibility found in SDS data.' }
}

export function checkHotWorkSafety(sds: SdsRecord): {
  safe: boolean
  flashPoint: string
  warning: string
} {
  const fp = sds.physicalProperties.flashPointC
  if (fp === null) {
    return {
      safe: false,
      flashPoint: 'Unknown',
      warning: `Flash point for ${sds.productName} is unknown. Assume flammable and obtain a hot work permit.`,
    }
  }
  if (fp < 60) {
    return {
      safe: false,
      flashPoint: sds.physicalProperties.flashPoint,
      warning: `${sds.productName} has a flash point of ${sds.physicalProperties.flashPoint}. ` +
        'Hot work must not be performed within 35 feet of this chemical without a hot work permit and fire watch.',
    }
  }
  return {
    safe: true,
    flashPoint: sds.physicalProperties.flashPoint,
    warning: '',
  }
}
```

### 4.3 Incident Report Integration

When filing a chemical exposure incident, the app auto-populates relevant SDS data.

#### 4.3.1 Client-Side: Chemical Selection in Incident Form

Add to the incident report form (`src/components/safety/IncidentForm.tsx`):

```typescript
// New field in the incident form: chemical involved
// When incidentType includes chemical exposure keywords, show a chemical picker.

interface ChemicalIncidentFields {
  chemicalInvolved: string | null     // SDS record ID
  chemicalName: string                // Display name (survives even if SDS deleted)
  exposureRoute: 'inhalation' | 'skin' | 'eye' | 'ingestion' | 'multiple'
  sdsFirstAidApplied: string          // Auto-populated from SDS Section 4
  sdsLinked: boolean                  // Whether the SDS record was successfully linked
}
```

#### 4.3.2 Auto-Population Logic

```typescript
// src/lib/incident-sds-integration.ts

import type { SdsRecord } from '@/lib/sds-types'
import type { IncidentReport } from '@/lib/safety-types'

export interface SdsIncidentContext {
  firstAidMeasures: string
  requiredPpe: string
  exposureLimits: string
  emergencyPhone: string
  suggestedImmediateActions: string[]
}

export function getSdsContextForIncident(
  sds: SdsRecord,
  exposureRoute: 'inhalation' | 'skin' | 'eye' | 'ingestion' | 'multiple'
): SdsIncidentContext {
  const firstAid = exposureRoute === 'multiple'
    ? [
        `INHALATION: ${sds.firstAid.inhalation}`,
        `SKIN: ${sds.firstAid.skinContact}`,
        `EYE: ${sds.firstAid.eyeContact}`,
        `INGESTION: ${sds.firstAid.ingestion}`,
      ].join('\n')
    : sds.firstAid[exposureRoute === 'skin' ? 'skinContact' : exposureRoute === 'eye' ? 'eyeContact' : exposureRoute]

  const ppeList = [
    sds.requiredPpe.respiratory && `Respiratory: ${sds.requiredPpe.respiratory}`,
    sds.requiredPpe.hand && `Hand: ${sds.requiredPpe.hand}`,
    sds.requiredPpe.eye && `Eye: ${sds.requiredPpe.eye}`,
    sds.requiredPpe.skin && `Skin: ${sds.requiredPpe.skin}`,
  ].filter(Boolean).join('; ')

  return {
    firstAidMeasures: firstAid,
    requiredPpe: ppeList,
    exposureLimits: sds.exposureLimits
      .map((el) => `${el.substance}: ${el.value} (${el.oelType}, ${el.source})`)
      .join('\n'),
    emergencyPhone: sds.emergencyPhone,
    suggestedImmediateActions: [
      `Follow SDS first-aid measures for ${sds.productName}`,
      sds.emergencyPhone ? `Emergency contact: ${sds.emergencyPhone}` : null,
      `Ensure affected worker has access to SDS (${sds.id})`,
      exposureRoute === 'inhalation' ? 'Move to fresh air immediately' : null,
      exposureRoute === 'skin' ? 'Remove contaminated clothing and wash affected area' : null,
      exposureRoute === 'eye' ? 'Flush eyes with water for at least 15 minutes' : null,
    ].filter(Boolean) as string[],
  }
}

// Cross-link: after saving the incident, update both records
export function linkIncidentToSds(
  incidentId: string,
  sdsId: string
): void {
  // Update the SDS record's linkedIncidentIds
  // Update the incident record with a chemical reference event
  // Both use the append-only audit event pattern
}
```

#### 4.3.3 AI-Enhanced Incident Analysis

Extend the existing `analyze-incident` route to include SDS context when a chemical is involved:

```typescript
// In /api/safety/analyze-incident/route.ts, extend the user message builder:

// If the client sends sdsContext (first aid, PPE, exposure limits from the SDS),
// include it so Sage can give chemical-aware root cause analysis.

const sdsContext = (body.sdsContext ?? '').trim().slice(0, 3000)

const userMessage = [
  `Incident type: ${incidentType || 'not specified'}`,
  // ... existing fields ...
  sdsContext ? `\nSafety Data Sheet context for the involved chemical:\n${sdsContext}` : null,
]
  .filter(Boolean)
  .join('\n')
```

---

## 5. Cross-System Connections

### 5.1 SDS Links to Pre-Task Plans

When creating a PTP, if the scope of work involves chemicals:

```
PTP Form
  ├── Scope of work: "Applying epoxy coating in tank T-401"
  ├── [AI suggests hazards] → Sage detects chemical keywords
  │   └── Suggests: "Chemical exposure - epoxy resin" (with SDS-derived PPE requirements)
  ├── PPE Required: auto-populated from SDS Section 8 of matched chemicals
  └── Chemicals on site: [searchable SDS picker]
      └── Links: PTP → SDS.linkedPtpIds[]
```

**Implementation:** In `src/lib/sage-context.ts`, `summarizePtp()` already extracts hazards. Add: if any hazard description matches a chemical name in the SDS library, include the SDS PPE requirements in the context. The `suggest-hazards` route already has a critic/refine loop (`hazard-critic.ts`); extend it to cross-check PPE against SDS data.

### 5.2 SDS Links to Permits

#### Hot Work Permits
When issuing a hot work permit, check flash points of chemicals in the area:

```typescript
// src/lib/sds-permit-checks.ts

export function checkHotWorkChemicalRisks(
  location: string,
  allSds: SdsRecord[]
): { chemical: string; flashPoint: string; flashPointC: number; warning: string }[] {
  return allSds
    .filter((sds) =>
      sds.locations.includes(location) &&
      sds.physicalProperties.flashPointC !== null &&
      sds.physicalProperties.flashPointC < 100  // Flag anything with flash point below 100C
    )
    .map((sds) => ({
      chemical: sds.productName,
      flashPoint: sds.physicalProperties.flashPoint,
      flashPointC: sds.physicalProperties.flashPointC!,
      warning: sds.physicalProperties.flashPointC! < 38
        ? `FLAMMABLE LIQUID (flash point ${sds.physicalProperties.flashPoint}). Remove from hot work area or ensure 35-foot clearance.`
        : `COMBUSTIBLE LIQUID (flash point ${sds.physicalProperties.flashPoint}). Ensure adequate separation from hot work.`,
    }))
    .sort((a, b) => a.flashPointC - b.flashPointC)
}
```

#### Confined Space Permits
Cross-reference confined space atmospheric hazards with SDS exposure limits:

```typescript
export function checkConfinedSpaceChemicalRisks(
  location: string,
  allSds: SdsRecord[]
): { chemical: string; exposureLimits: ExposureLimit[]; ghsHazards: string[] }[] {
  return allSds
    .filter((sds) =>
      sds.locations.includes(location) &&
      (sds.ghsClassification.includes('toxic') ||
       sds.ghsClassification.includes('health-hazard') ||
       sds.ghsClassification.includes('flammable'))
    )
    .map((sds) => ({
      chemical: sds.productName,
      exposureLimits: sds.exposureLimits,
      ghsHazards: sds.ghsClassification,
    }))
}
```

### 5.3 Equipment Linkage

SDS records link to equipment that stores or handles chemicals:

```typescript
// Chemical storage containers, spill kits, eyewash stations
// These are tracked in the existing equipment system (src/lib/equipment.ts)

// The equipment model already has a `notes` field. For SDS linkage,
// add a structured reference:
interface ChemicalEquipmentLink {
  equipmentId: string           // Equipment item ID
  sdsIds: string[]              // SDS records for chemicals in this container
  equipmentRole: 'storage' | 'spill-kit' | 'eyewash' | 'ppe-station' | 'ventilation'
}
```

### 5.4 SageTriage AI -- Learning About the SDS Library

The triage system learns about SDS through the context injection described in section 4.2.1. The key additions:

1. **Navigation knowledge:** Add `/safety/sds` and `/safety/sds/[id]` to the APP NAVIGATION block in the triage system prompt (section 4.2.2).
2. **Chemical count awareness:** `sdsSummary` in `SageContext` tells Sage how many chemicals are on site and which are classified as DANGER.
3. **Active SDS context:** When the user is viewing a specific SDS page (`/safety/sds/SDS-2026-0001`), the full SDS data is injected into context so Sage can answer questions about that specific chemical.
4. **Chemical keyword detection:** When a user message contains chemical-related keywords (name, CAS number), the client-side code searches the local SDS library and injects matching SDS data into the context before sending to the triage API.

---

## 6. Notion Backend Integration

### 6.1 Notion SDS Database Schema

Create a new database: **Safety -- SDS / Chemical Inventory**

| Property Name     | Type         | Notes                                    |
|-------------------|-------------|------------------------------------------|
| ID                | Title       | Required. `SDS-2026-NNNN` format.        |
| Product Name      | Rich Text   |                                          |
| Manufacturer      | Rich Text   |                                          |
| CAS Number        | Rich Text   | Primary chemical identifier              |
| Signal Word       | Select      | Options: `danger`, `warning`, `none`     |
| GHS Hazards       | Multi-Select| Options: all 9 GhsHazardCategory values  |
| Location          | Rich Text   | Primary storage location                 |
| Created By        | Rich Text   |                                          |
| Created At        | Date        |                                          |
| SDS Revision Date | Date        | Date on the manufacturer's SDS           |
| Approval Status   | Select      | `draft`, `pending-approval`, `approved`, `expired`, `superseded` |
| Sync Source       | Select      | `sage-ehs` or `webhook`                  |
| SDS Source        | Select      | `manual`, `parsed`, `webhook`            |

Full SDS JSON is stored in code blocks in the page body (same pattern as safety records -- 1900-char chunks).

### 6.2 Environment Variable

Add to `.env.example`:

```
# SDS / Chemical Safety (optional, graceful no-op when unconfigured)
NOTION_SDS_DB_ID=                # Notion database ID for SDS records
NEXT_PUBLIC_SDS_MODULE=1         # Enable the SDS module UI
SLACK_SDS_WEBHOOK_SECRET=        # Slack signing secret for inbound SDS webhooks
```

### 6.3 Sync Conflict Resolution

Follows the existing safety sync pattern (write-once, dedup by ID):

1. **Client creates locally** with `syncStatus: 'pending'`.
2. **Client POSTs to `/api/sds/sync`** with exponential backoff (same `trySyncRecord` pattern from `safety-sync.ts`).
3. **Server checks for existing page** by querying Notion for the SDS ID. If found, returns the existing `notionPageId` (idempotent).
4. **If not found, creates a new page.** Returns the new `notionPageId`.
5. **Client marks `syncStatus: 'synced'`** and stores the `notionPageId`.

**Update conflicts:** SDS records are updated more frequently than safety records (e.g., new revision from manufacturer). When a record is updated:
- A new `AuditEvent` is appended with action `'amended'`.
- The sync endpoint checks if the Notion page exists and *patches* the properties + replaces the code blocks with the updated JSON.
- Last-write-wins is acceptable because SDS updates are infrequent and manual.

---

## 7. Feature Flag Strategy

| Flag | Type | Controls |
|------|------|----------|
| `NEXT_PUBLIC_SDS_MODULE` | Client (public) | SDS Binder nav link, SDS-related UI, SDS context in Sage |
| `NEXT_PUBLIC_AI_ASSIST` | Client (public) | AI parse, AI-powered Q&A (existing flag, reused) |
| `ANTHROPIC_API_KEY` | Server (secret) | AI features backend (existing, reused) |
| `NOTION_SDS_DB_ID` | Server (secret) | Notion sync for SDS records |
| `SLACK_SDS_WEBHOOK_SECRET` | Server (secret) | Inbound webhook authentication |
| `KV_REST_API_URL` | Server (secret) | Webhook idempotency + queue (existing, reused) |

**Progressive enablement:**

1. **SDS module only** (`NEXT_PUBLIC_SDS_MODULE=1`): Manual SDS entry, local storage, offline search. No AI, no Notion, no webhooks.
2. **+ AI** (`NEXT_PUBLIC_AI_ASSIST=1` + `ANTHROPIC_API_KEY`): PDF parsing, chemical Q&A via Sage, AI-enhanced incident analysis.
3. **+ Notion** (`NOTION_SDS_DB_ID`): Cloud sync, server-side search across all project sites.
4. **+ Slack webhook** (`SLACK_SDS_WEBHOOK_SECRET`): Automated chemical approval intake from procurement system.

---

## 8. Security Considerations

### 8.1 Webhook Security

- **HMAC verification:** Every inbound webhook is verified using `X-Slack-Signature` and `X-Slack-Request-Timestamp` with `timingSafeEqual` (constant-time comparison to prevent timing attacks). This follows Slack's [Verifying requests from Slack](https://api.slack.com/authentication/verifying-requests-from-slack) spec exactly.
- **Replay protection:** Timestamps older than 5 minutes are rejected.
- **Rate limiting:** 30 requests/minute per source IP.
- **Idempotency:** KV-backed event ID dedup prevents double-processing.

### 8.2 API Authentication

All user-facing endpoints use `requireSession()` (same as every existing safety API route). The webhook endpoint uses HMAC signature verification instead (no user session -- machine-to-machine).

### 8.3 Input Sanitization

All string inputs are `.trim()`-ed and `.slice()`-ed to hard character limits (same pattern as every existing route). PDF base64 input is capped at 6.7MB (~5MB decoded). CAS numbers are validated against the `XXXXX-XX-X` format before storage.

### 8.4 SDS Data Sensitivity

SDS data is not proprietary (manufacturers are legally required to provide SDSs freely). However:
- **PDF storage:** SDS PDFs stored in IndexedDB (client-side) or Vercel Blob (cloud) are accessible only to authenticated users.
- **Notion sync:** SDS records in Notion follow the same access control as safety records (controlled by Notion integration permissions).

### 8.5 AI Prompt Injection

The SDS parse route sends *untrusted PDFs* to Claude. The system prompt explicitly instructs the model to extract data and nothing else. The Zod schema enforces the output structure. Adversarial PDFs that contain prompt injection text in the SDS content would need to break past both the system prompt framing and the structured output schema -- the same defense-in-depth as the existing `parse-document` route.

For the triage route, SDS context is injected inside the `[UNTRUSTED CLIENT CONTEXT]` block (same pattern as existing context injection in the triage route, line 128-129 of the existing code).

---

## 9. Offline Fallback Behavior

| Feature | Online | Offline |
|---------|--------|---------|
| SDS record browsing | Full library from localStorage + Notion search | localStorage only |
| Chemical search | Local search + server-side Notion query | Local search only |
| SDS PDF parsing | AI-powered extraction via `/api/sds/parse` | Not available (show "Requires internet" message) |
| Chemical Q&A | AI-powered via SageTriage with SDS context | Structured lookup from `sds-lookup.ts` (PPE, first aid, storage compatibility) |
| Incident + SDS linking | Full linking + AI analysis | Structured SDS data auto-population (no AI analysis) |
| Storage compatibility check | AI-enhanced cross-check | Keyword matching against `incompatibleMaterials` arrays |
| Hot work chemical check | AI reasoning about thermal hazards | Numeric flash point comparison only |
| Webhook-created records | Received and queued | Queued in KV; client picks up on reconnect |
| Notion sync | Push on save | Queued as `syncStatus: 'pending'`; synced on reconnect |

---

## 10. New Files Summary

| File Path | Purpose |
|-----------|---------|
| `src/lib/sds-types.ts` | SDS data model + type guards + display metadata |
| `src/lib/sds-schemas.ts` | Zod validation schemas |
| `src/lib/sds-records.ts` | Client-side data access layer (localStorage, CRUD, pub/sub) |
| `src/lib/sds-sync.ts` | Client-side sync orchestration (follows `safety-sync.ts`) |
| `src/lib/sds-lookup.ts` | Offline chemical Q&A (structured data lookups) |
| `src/lib/sds-permit-checks.ts` | Cross-system safety checks (hot work, confined space) |
| `src/lib/incident-sds-integration.ts` | Incident report + SDS auto-population |
| `src/app/api/sds/sync/route.ts` | Notion sync API route |
| `src/app/api/sds/webhook/route.ts` | Slack inbound webhook handler |
| `src/app/api/sds/webhook-queue/route.ts` | Client queue drain endpoint |
| `src/app/api/sds/parse/route.ts` | AI-powered SDS PDF parsing |
| `src/app/api/sds/search/route.ts` | Server-side Notion search |

## 11. Modified Files

| File Path | Change |
|-----------|--------|
| `src/lib/sage-context.ts` | Add `sdsSummary` and `activeChemicalContext` to `SageContext` |
| `src/app/api/sage/triage/route.ts` | Extend `SYSTEM_PROMPT` with chemical safety section + SDS navigation |
| `src/app/api/safety/analyze-incident/route.ts` | Accept optional `sdsContext` field for chemical incident analysis |
| `src/components/safety/SafetyDashboard.tsx` | Replace external SDS link with internal `/safety/sds` route |
| `src/lib/incident-patterns.ts` | Add SDS cross-reference to the chemical exposure pattern |
| `.env.example` | Add `NOTION_SDS_DB_ID`, `NEXT_PUBLIC_SDS_MODULE`, `SLACK_SDS_WEBHOOK_SECRET` |

---

## 12. Integration Points with Existing Code

| Existing Module | Integration Point | How SDS Connects |
|---|---|---|
| `src/lib/safety-sync.ts` | `trySyncRecord()`, `syncAllPending()` | New `sds-sync.ts` follows the same fire-and-forget + exponential backoff pattern |
| `src/lib/safety-records.ts` | `getAllSafetyRecords()`, `onSafetyChange()` | New `sds-records.ts` mirrors the same localStorage + pub/sub + audit event architecture |
| `src/lib/identity.ts` | `getCurrentIdentity()` | SDS records are attributed using the same offline identity cache |
| `src/lib/api-auth.ts` | `requireSession()` | All SDS user-facing API routes use the same auth helper |
| `src/lib/rate-limit.ts` | `rateLimit()` | All SDS API routes use the same dual-mode rate limiter with SDS-specific keys |
| `src/lib/kv.ts` | `kv` (Upstash Redis) | Webhook idempotency, queue storage, sequential ID generation |
| `src/lib/slack-notify.ts` | `sendSlackMessage()` | Webhook confirmation sent via existing outbound Slack helper |
| `src/lib/sage-context.ts` | `buildSageContext()`, `contextToPrompt()` | Extended with SDS library summary and active chemical context |
| `src/lib/schemas.ts` | `safeParseSafetyRecords()` | New `safeParseSdsRecords()` follows identical pattern |
| `src/lib/atmo-check.ts` | `analyzeAtmosphere()` | SDS exposure limits feed into confined space atmospheric analysis |
| `src/lib/hazard-critic.ts` | `critique()`, `hintDescriptions()` | Extended to flag missing chemical PPE based on SDS cross-reference |
| `src/lib/incident-patterns.ts` | Chemical exposure pattern | Enhanced with SDS-derived first-aid measures and root cause data |
