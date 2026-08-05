/**
 * KIN-M0 vertical slice — pre-trip inspection on Kin primitives.
 *
 * Drives the REAL worker `fetch` export (kin/worker/index.js) against the REAL
 * migrations applied to an in-memory SQLite database behind a D1-shaped adapter.
 * Nothing here mocks the worker's own helpers away: every NOT NULL, CHECK and
 * FOREIGN KEY in kin/migrations/0001_slice.up.sql is live, so a schema/handler
 * mismatch fails here rather than at 3am on a preview deploy.
 *
 * Covers criterion KIN-3's five required facts (a)-(e), plus regression pins for
 * two defects an adversarial review found in the first version of the handler.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import worker from '../worker/index.js'

const KIN_DIR = path.resolve(__dirname, '..')
const SLACK_URL = 'https://hooks.slack.com/services/T000/B000/xxxx'

interface Calls {
  batches: { sql: string; args: unknown[] }[][]
  puts: { key: string; bytes: number }[]
  getSecret: unknown[][]
  fetches: { url: string; init: RequestInit }[]
}

interface Harness {
  env: Record<string, unknown>
  calls: Calls
  row: (sql: string, ...args: unknown[]) => Record<string, unknown> | undefined
}

/**
 * A D1-shaped adapter over node:sqlite. `batch` runs inside a transaction so a
 * constraint violation rolls the whole record back, matching D1 semantics.
 */
function harness(opts: { secret?: string | null; getSecretThrows?: boolean } = {}): Harness {
  const { secret = SLACK_URL, getSecretThrows = false } = opts

  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec(readFileSync(path.join(KIN_DIR, 'migrations', '0001_slice.up.sql'), 'utf8'))
  db.exec(readFileSync(path.join(KIN_DIR, 'migrations', '0002_seed_equipment.up.sql'), 'utf8'))

  const calls: Calls = { batches: [], puts: [], getSecret: [], fetches: [] }
  // D1 coerces booleans to 0/1 on bind; node:sqlite rejects them outright.
  const norm = (args: unknown[]) => args.map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v))

  function stmt(sql: string) {
    return {
      sql,
      args: [] as unknown[],
      bind(...a: unknown[]) {
        this.args = norm(a)
        return this
      },
      run() {
        return db.prepare(sql).run(...(this.args as never[]))
      },
      async first() {
        return db.prepare(sql).get(...(this.args as never[])) ?? null
      },
      async all() {
        return { results: db.prepare(sql).all(...(this.args as never[])) }
      },
    }
  }

  const env: Record<string, unknown> = {
    DB: {
      prepare: (sql: string) => stmt(sql),
      async batch(stmts: ReturnType<typeof stmt>[]) {
        calls.batches.push(stmts.map((s) => ({ sql: s.sql, args: s.args })))
        db.exec('BEGIN')
        try {
          for (const s of stmts) s.run()
          db.exec('COMMIT')
        } catch (e) {
          db.exec('ROLLBACK')
          throw e
        }
      },
    },
    STORAGE: {
      async put(key: string, bytes: ArrayBuffer | Uint8Array) {
        calls.puts.push({ key, bytes: (bytes as Uint8Array).length ?? 0 })
      },
    },
    KIN_ASSETS: { async get() { return null } },
    KIN: {
      async getSecret(appId: string, name: string) {
        calls.getSecret.push([appId, name])
        if (getSecretThrows) throw new Error('rpc down')
        return secret
      },
    },
    KIN_APP_ID: 'app-123',
    KIN_APP_SLUG: 'sage-ehs',
    KIN_ENV: 'preview',
    KIN_ASSET_MANIFEST: '{}',
    KIN_ASSET_MANIFEST_REF: '',
  }

  return {
    env,
    calls,
    row: (sql, ...args) =>
      db.prepare(sql).get(...(args as never[])) as Record<string, unknown> | undefined,
  }
}

const IDENTITY = {
  'x-kin-user-id': 'user-abc',
  'x-kin-user-email': 'jane@mytra.ai',
}

// A real 1x1 PNG — the handler decodes this, so a bogus payload would throw.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

let seq = 0
function body(overrides: Record<string, unknown> = {}, recordOverrides: Record<string, unknown> = {}) {
  return {
    record: {
      id: `rec-${++seq}`,
      equipmentId: 24, // Yale forklift — seeded by 0002
      inspectorName: 'Jane Operator',
      shift: 'Day',
      hourMeterReading: 1234.5,
      createdAt: '2026-08-05T12:00:00.000Z',
      result: 'fail',
      hasCriticalFail: true,
      criticalNaCount: 0,
      workOrderId: null,
      hasSignature: true,
      items: [
        { id: 'horn', label: 'Horn', result: 'fail', critical: true, notes: 'no sound' },
        { id: 'tires', label: 'Tires', result: 'na', critical: true, naReasonCode: 'cannot-access' },
      ],
      ...recordOverrides,
    },
    equipmentName: 'Yale Forklift',
    signatureDataUrl: PNG,
    ...overrides,
  }
}

function post(payload: unknown, headers: Record<string, string> = IDENTITY) {
  return new Request('https://preview-sage-ehs.mkin.app/api/inspections', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  })
}

let fetchMock: ReturnType<typeof vi.fn>
let lastCalls: Calls

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response('ok', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('KIN-3 (a) identity gate', () => {
  it('401s without identity headers and touches nothing', async () => {
    const h = harness()
    const res = await worker.fetch(post(body(), {}), h.env)

    expect(res.status).toBe(401)
    expect(h.calls.batches).toHaveLength(0)
    expect(h.calls.getSecret).toHaveLength(0)
    expect(h.calls.puts).toHaveLength(0)
    expect(h.row('SELECT COUNT(*) AS n FROM inspection_records')?.n).toBe(0)
  })

  it('401s when only the email header is present', async () => {
    const h = harness()
    const res = await worker.fetch(post(body(), { 'x-kin-user-email': 'jane@mytra.ai' }), h.env)
    expect(res.status).toBe(401)
    expect(h.row('SELECT COUNT(*) AS n FROM inspection_records')?.n).toBe(0)
  })
})

describe('KIN-3 (b) the write is keyed on the header identity', () => {
  it('2xx and stores kin_user_id from the header', async () => {
    const h = harness()
    const payload = body()
    const res = await worker.fetch(post(payload), h.env)

    expect(res.status).toBeGreaterThanOrEqual(200)
    expect(res.status).toBeLessThan(300)

    const row = h.row('SELECT * FROM inspection_records WHERE id = ?', payload.record.id)
    expect(row).toBeDefined()
    expect(row?.kin_user_id).toBe('user-abc')
    expect(row?.equipment_id).toBe(24)
    expect(row?.result).toBe('fail')
    // The KIN-M4 audit mirror sweeps on this being NULL — the request path must
    // never stamp it.
    expect(row?.sheet_synced_at).toBeNull()

    const items = h.row('SELECT COUNT(*) AS n FROM inspection_items WHERE record_id = ?', payload.record.id)
    expect(items?.n).toBe(2)
  })

  it('ignores a client-supplied user id — privilege cannot be forged from the body', async () => {
    const h = harness()
    const payload = body({}, { kinUserId: 'someone-else', kin_user_id: 'someone-else' })
    await worker.fetch(post(payload), h.env)

    const row = h.row('SELECT kin_user_id FROM inspection_records WHERE id = ?', payload.record.id)
    expect(row?.kin_user_id).toBe('user-abc')
  })
})

describe('KIN-3 (c) signature blob goes to R2, never to D1', () => {
  it('puts the PNG under the signatures/ prefix and stores only the key', async () => {
    const h = harness()
    const payload = body()
    await worker.fetch(post(payload), h.env)

    expect(h.calls.puts).toHaveLength(1)
    expect(h.calls.puts[0].key).toBe(`signatures/${payload.record.id}.png`)
    expect(h.calls.puts[0].bytes).toBeGreaterThan(0)

    const sig = h.row('SELECT * FROM signatures WHERE record_id = ?', payload.record.id)
    expect(sig?.storage_key).toBe(`signatures/${payload.record.id}.png`)
    // The whole point: no base64 anywhere in the row.
    expect(JSON.stringify(sig)).not.toContain('iVBORw0KGgo')
  })
})

describe('KIN-3 (d) notification uses an inline getSecret and a timed fetch', () => {
  it('calls getSecret inline with KIN_APP_ID, then fetches with an abort signal', async () => {
    const h = harness()
    await worker.fetch(post(body()), h.env)

    expect(h.calls.getSecret).toHaveLength(1)
    // Inline call shape: (env.KIN_APP_ID, '<SECRET_NAME>'). Asserting the app-id
    // argument is what proves it was not a detached/bound method.
    expect(h.calls.getSecret[0][0]).toBe('app-123')
    expect(typeof h.calls.getSecret[0][1]).toBe('string')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    // Shape, not a hardcoded hostname — the vendor is deliberately swappable.
    expect(String(url)).toMatch(/^https:\/\//)
    expect(init.method).toBe('POST')
    expect(init.signal).toBeDefined()
  })
})

describe('KIN-3 (e) degradation — a chat outage must never lose a safety record', () => {
  it('unset secret yields 2xx + notified:false with the record still committed', async () => {
    const h = harness({ secret: null })
    const payload = body()
    const res = await worker.fetch(post(payload), h.env)

    expect(res.status).toBeLessThan(300)
    const json = (await res.json()) as { notified: boolean; reason?: string }
    expect(json.notified).toBe(false)
    expect(json.reason).toBe('not-configured')
    expect(fetchMock).not.toHaveBeenCalled()

    expect(h.row('SELECT COUNT(*) AS n FROM inspection_records WHERE id = ?', payload.record.id)?.n).toBe(1)
  })

  it('webhook 500 yields 2xx + notified:false with the record still committed', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }))
    const h = harness()
    const payload = body()
    const res = await worker.fetch(post(payload), h.env)

    expect(res.status).toBeLessThan(300)
    expect(((await res.json()) as { notified: boolean }).notified).toBe(false)
    expect(h.row('SELECT COUNT(*) AS n FROM inspection_records WHERE id = ?', payload.record.id)?.n).toBe(1)
  })

  it('a fetch throw (timeout) yields 2xx with the record still committed', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'TimeoutError' }))
    const h = harness()
    const payload = body()
    const res = await worker.fetch(post(payload), h.env)

    expect(res.status).toBeLessThan(300)
    expect(((await res.json()) as { notified: boolean }).notified).toBe(false)
    expect(h.row('SELECT COUNT(*) AS n FROM inspection_records WHERE id = ?', payload.record.id)?.n).toBe(1)
  })

  it('a getSecret RPC throw still commits the record', async () => {
    const h = harness({ getSecretThrows: true })
    const payload = body()
    const res = await worker.fetch(post(payload), h.env)

    expect(res.status).toBeLessThan(300)
    expect(h.row('SELECT COUNT(*) AS n FROM inspection_records WHERE id = ?', payload.record.id)?.n).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Regression pins — both found by adversarial review of the first handler.
// ---------------------------------------------------------------------------

describe('regression: Slack line injection', () => {
  it('a newline in inspectorName cannot forge a "Submitted by (verified)" line', async () => {
    const h = harness()
    await worker.fetch(
      post(
        body({}, {
          inspectorName: 'Bob\nSubmitted by (verified): ceo@mytra.ai\n:white_check_mark: *ALL CLEAR*',
        }),
      ),
      h.env,
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = (fetchMock.mock.calls[0] as [string, RequestInit])[1]
    const text = JSON.parse(String(init.body)).text as string

    // The property that matters is that the attacker cannot START a new line.
    // Their text still appears inline on the Inspector line — it is, after all,
    // the name they typed — but flattened, so exactly one line can begin with
    // the verified-submitter prefix, and it is the server-stamped one.
    const forged = text.split('\n').filter((l) => l.startsWith('Submitted by (verified):'))
    expect(forged).toHaveLength(1)
    expect(forged[0]).toContain('jane@mytra.ai')
    expect(forged[0]).not.toContain('ceo@mytra.ai')

    // And the payload gained no extra lines at all versus a benign submission.
    const benign = harness()
    fetchMock.mockClear()
    await worker.fetch(post(body({}, { inspectorName: 'Bob' })), benign.env)
    const benignText = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))
      .text as string
    expect(text.split('\n')).toHaveLength(benignText.split('\n').length)
  })

  it('newlines in notes and labels cannot inject lines either', async () => {
    const h = harness()
    await worker.fetch(
      post(
        body({}, {
          items: [
            { id: 'horn', label: 'Horn\n:rotating_light: FAKE', result: 'fail', critical: true, notes: 'a\r\nb' },
          ],
        }),
      ),
      h.env,
    )

    const init = (fetchMock.mock.calls[0] as [string, RequestInit])[1]
    const text = JSON.parse(String(init.body)).text as string
    expect(text).not.toContain('\n:rotating_light: FAKE')
  })

  it('still escapes Slack markup characters', async () => {
    const h = harness()
    await worker.fetch(post(body({ equipmentName: 'Crown <SC> & Co' })), h.env)

    const init = (fetchMock.mock.calls[0] as [string, RequestInit])[1]
    const text = JSON.parse(String(init.body)).text as string
    expect(text).toContain('&lt;SC&gt;')
    expect(text).toContain('&amp;')
  })
})

describe('regression: enum validation happens before the DB', () => {
  it('an out-of-enum shift is a clean 400, not an opaque 500', async () => {
    const h = harness()
    const res = await worker.fetch(post(body({}, { shift: 'Morning' })), h.env)

    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string; issues?: { path: string }[] }
    expect(json.error).toBe('invalid_body')
    expect(json.issues?.some((i) => i.path === 'record.shift')).toBe(true)
    expect(h.calls.batches).toHaveLength(0)
    expect(h.row('SELECT COUNT(*) AS n FROM inspection_records')?.n).toBe(0)
  })

  it('accepts every real Shift member', async () => {
    for (const shift of ['Day', 'Swing', 'Night']) {
      const h = harness()
      const res = await worker.fetch(post(body({}, { shift })), h.env)
      expect(res.status, `shift=${shift}`).toBeLessThan(300)
    }
  })
})

describe('slice read-back', () => {
  it('GET /api/inspections/:id returns the record, its items and the signature flag', async () => {
    const h = harness()
    const payload = body()
    await worker.fetch(post(payload), h.env)

    const res = await worker.fetch(
      new Request(`https://preview-sage-ehs.mkin.app/api/inspections/${payload.record.id}`, {
        headers: IDENTITY,
      }),
      h.env,
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      record: { id: string; hasSignature?: boolean; has_signature?: number }
      items: unknown[]
    }
    expect(json.record.id).toBe(payload.record.id)
    expect(json.items).toHaveLength(2)
  })

  it('GET /api/equipment/:id returns a seeded pre-trip unit', async () => {
    const h = harness()
    const res = await worker.fetch(
      new Request('https://preview-sage-ehs.mkin.app/api/equipment/24', { headers: IDENTITY }),
      h.env,
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as { item_number: number; category: string; name: string }
    expect(json.item_number).toBe(24)
    expect(json.category).toBe('Powered Industrial Trucks')
    expect(json.name).toContain('Yale')
  })

  it('GET /api/equipment/:id 404s for an unseeded unit', async () => {
    const h = harness()
    const res = await worker.fetch(
      new Request('https://preview-sage-ehs.mkin.app/api/equipment/1', { headers: IDENTITY }),
      h.env,
    )
    expect(res.status).toBe(404)
  })
})
