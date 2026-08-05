// Sage EHS — Kin Worker entrypoint.
//
// This file IS the deployable bundle: a single self-contained ES module with no
// import statements at all. The platform resolves no npm packages at deploy
// time, so a bare import here fails the upload with an opaque CF 400. Anything
// this Worker needs, it does against the platform primitives directly:
//
//   env.DB          per-app D1 (this app was created with needs_database: true)
//   env.STORAGE     per-app R2 for app-owned blobs (signature PNGs, photos)
//   env.KIN_ASSETS  platform-wide R2 holding the SPA's static assets
//   env.KIN         control-plane RPC (secrets, schedules) — always called inline
//
// Identity is NOT fetched; it arrives as x-kin-* headers stamped by the Kin auth
// Worker before dispatch. See getCaller() below. This replaces the whole of
// src/lib/api-auth.ts + the NextAuth session layer from the Vercel app.

const CONTENT_TYPES = {
  html: 'text/html;charset=utf-8',
  css: 'text/css;charset=utf-8',
  js: 'application/javascript;charset=utf-8',
  json: 'application/json;charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  txt: 'text/plain;charset=utf-8',
  webmanifest: 'application/manifest+json',
};

// ---------------------------------------------------------------------------
// Asset manifest
// ---------------------------------------------------------------------------

// Module-scope cache: the manifest is immutable for the isolate's lifetime, so
// this costs at most one R2 round trip per cold start.
let _manifest;

async function getManifest(env) {
  if (_manifest) return _manifest;
  // REF first, unconditionally. The inline KIN_ASSET_MANIFEST binding is a
  // plain-text Worker binding capped around 5 KB and simply goes missing once
  // the SPA has more than ~50 files — coding against it alone 404s every asset.
  if (env.KIN_ASSET_MANIFEST_REF) {
    const obj = await env.KIN_ASSETS.get(env.KIN_ASSET_MANIFEST_REF);
    _manifest = obj ? JSON.parse(await obj.text()) : {};
  } else {
    _manifest = JSON.parse(env.KIN_ASSET_MANIFEST || '{}');
  }
  return _manifest;
}

async function serveAsset(env, pathname) {
  // Kin does not auto-rewrite '/' — do it explicitly.
  const key = pathname === '/' ? '/index.html' : pathname;
  const manifest = await getManifest(env);
  const hash = manifest[key];
  if (!hash) return null;

  const obj = await env.KIN_ASSETS.get(`apps/${env.KIN_APP_ID}/${hash}`);
  if (!obj) return new Response('Asset missing', { status: 500 });

  const ext = (key.split('.').pop() || '').toLowerCase();
  const immutable = key.startsWith('/assets/'); // content-hashed filenames
  return new Response(obj.body, {
    headers: {
      'content-type': CONTENT_TYPES[ext] || 'application/octet-stream',
      'cache-control': immutable
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=0, must-revalidate',
    },
  });
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/**
 * Read the caller from the headers the Kin auth Worker stamps before dispatch.
 * Missing headers mean the request did not come through the platform — reject,
 * never synthesize an anonymous user.
 */
function getCaller(request) {
  const userId = request.headers.get('x-kin-user-id');
  const email = request.headers.get('x-kin-user-email');
  if (!userId || !email) return { kind: 'no_identity' };
  return {
    kind: 'ok',
    user: { id: userId, email },
    appRole: request.headers.get('x-kin-app-role'),
    isManager: request.headers.get('x-kin-is-manager') === '1',
    globalRole:
      request.headers.get('x-kin-global-role') === 'platform_admin' ? 'platform_admin' : 'user',
  };
}

function jsonError(status, error, extra) {
  return Response.json({ error, ...extra }, { status, headers: { 'cache-control': 'no-store' } });
}

// ---------------------------------------------------------------------------
// Inspection body validation
// ---------------------------------------------------------------------------
//
// A hand-rolled mirror of NotifyBodySchema in src/lib/inspection-notify-schema.ts.
// zod cannot live here — the platform resolves no npm imports at deploy time (a
// real deploy of `import { z } from 'zod'` failed with CF 400 [10021]), so the
// shape is reproduced field by field: same names, same max lengths, same enums,
// same nullable-vs-optional split. If the zod schema changes, this must change
// with it — divergence silently drops or admits inspection payloads.
//
// Semantics preserved from zod: `optional` admits undefined but NOT null;
// `nullable` admits null. workOrderId / hourMeterReading / naReasonCode /
// signatureDataUrl are both, because a passing inspection legitimately carries
// null there. Unknown keys are ignored, as z.object() strips them.

const SIGNATURE_DATA_URL_RE = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

function vMissing(v, opts, issues, path) {
  if (v === undefined) {
    if (!opts.optional) issues.push({ path, message: 'required' });
    return true;
  }
  if (v === null) {
    if (!opts.nullable) issues.push({ path, message: 'null not allowed' });
    return true;
  }
  return false;
}

function vStr(issues, path, v, max, opts = {}) {
  if (vMissing(v, opts, issues, path)) return;
  if (typeof v !== 'string') issues.push({ path, message: 'expected string' });
  else if (v.length > max) issues.push({ path, message: `too long (max ${max})` });
}

function vNum(issues, path, v, opts = {}) {
  if (vMissing(v, opts, issues, path)) return;
  // JSON.parse can never yield NaN/Infinity, but the guard keeps parity with
  // z.number() should a caller ever feed this a hand-built object.
  if (typeof v !== 'number' || Number.isNaN(v)) issues.push({ path, message: 'expected number' });
}

function vBool(issues, path, v, opts = {}) {
  if (vMissing(v, opts, issues, path)) return;
  if (typeof v !== 'boolean') issues.push({ path, message: 'expected boolean' });
}

function vEnum(issues, path, v, allowed) {
  if (!allowed.includes(v)) issues.push({ path, message: `expected one of: ${allowed.join(', ')}` });
}

function validateInspectionBody(raw) {
  const issues = [];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, issues: [{ path: '', message: 'expected object' }] };
  }

  const r = raw.record;
  if (typeof r !== 'object' || r === null || Array.isArray(r)) {
    issues.push({ path: 'record', message: 'expected object' });
  } else {
    vStr(issues, 'record.id', r.id, 100);
    vNum(issues, 'record.equipmentId', r.equipmentId);
    vStr(issues, 'record.inspectorName', r.inspectorName, 200);
    // Enum-checked here, not just length-checked. The zod schema this ports is
    // loose (z.string().max(50)) but the shift column CHECKs the three Shift
    // members, so a schema-valid "Morning" would sail past validation and die
    // inside env.DB.batch as an opaque 500. Reject it as a clean 400 instead.
    vEnum(issues, 'record.shift', r.shift, ['Day', 'Swing', 'Night']);
    vNum(issues, 'record.hourMeterReading', r.hourMeterReading, { nullable: true, optional: true });
    vStr(issues, 'record.createdAt', r.createdAt, 50);
    vEnum(issues, 'record.result', r.result, ['pass', 'fail']);
    vBool(issues, 'record.hasCriticalFail', r.hasCriticalFail);
    vNum(issues, 'record.criticalNaCount', r.criticalNaCount, { optional: true });
    vStr(issues, 'record.workOrderId', r.workOrderId, 100, { nullable: true, optional: true });
    vBool(issues, 'record.hasSignature', r.hasSignature, { optional: true });

    if (!Array.isArray(r.items)) {
      issues.push({ path: 'record.items', message: 'expected array' });
    } else {
      if (r.items.length > 200) issues.push({ path: 'record.items', message: 'too many items (max 200)' });
      r.items.forEach((item, i) => {
        const p = `record.items[${i}]`;
        if (typeof item !== 'object' || item === null || Array.isArray(item)) {
          issues.push({ path: p, message: 'expected object' });
          return;
        }
        vStr(issues, `${p}.id`, item.id, 100);
        vStr(issues, `${p}.label`, item.label, 200);
        vEnum(issues, `${p}.result`, item.result, ['pass', 'fail', 'na']);
        vBool(issues, `${p}.critical`, item.critical, { optional: true });
        vStr(issues, `${p}.notes`, item.notes, 2000, { optional: true });
        vStr(issues, `${p}.naReasonCode`, item.naReasonCode, 50, { nullable: true, optional: true });
        vStr(issues, `${p}.naJustification`, item.naJustification, 2000, { optional: true });
      });
    }
  }

  vStr(issues, 'equipmentName', raw.equipmentName, 200, { optional: true });
  vStr(issues, 'equipmentCategory', raw.equipmentCategory, 200, { optional: true });

  const sig = raw.signatureDataUrl;
  if (sig !== undefined && sig !== null) {
    if (typeof sig !== 'string') {
      issues.push({ path: 'signatureDataUrl', message: 'expected string' });
    } else {
      if (sig.length > 300_000) issues.push({ path: 'signatureDataUrl', message: 'too long (max 300000)' });
      if (!SIGNATURE_DATA_URL_RE.test(sig)) {
        issues.push({ path: 'signatureDataUrl', message: 'signature must be a PNG data URL' });
      }
    }
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true };
}

// ---------------------------------------------------------------------------
// Slack notification
// ---------------------------------------------------------------------------
//
// Ported from src/lib/slack-notify.ts + the message builder in
// src/app/api/inspections/notify/route.ts, minus email (owner directive
// 2026-08-05: no Resend — docs/kin/NOTIFICATIONS.md). Best-effort by contract:
// the D1 row is the source of truth and has already committed by the time this
// runs, so every failure mode here degrades to notified:false on a 2xx. The
// Google Sheet audit mirror reads D1 on a schedule (KIN-M4) and never depends
// on this path.

// Escapes Slack's three markup characters AND flattens line breaks. The newline
// strip lives HERE, at the escaping boundary, rather than at each call site: the
// message is a newline-delimited format, so any user-controlled field that can
// smuggle a \n forges the lines beneath it. Doing it per-line means one missed
// lines.push() reopens the hole \u2014 an adversarial review of the first version of
// this file found exactly that, with an inspectorName of
// "Bob\nSubmitted by (verified): ceo@mytra.ai" forging the verified-submitter
// line that EHS relies on to tell claimed identity from actual identity.
// U+2028/U+2029 are included because they are line terminators to some clients.
// (Written as \u escapes \u2014 a literal U+2028 in a regex literal is a JS syntax error.)
function escapeSlack(s) {
  return String(s ?? '')
    .replace(/[\r\n\u2028\u2029]+/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// The sanitizeSubject guard from src/lib/email-notify.ts, kept for the headline:
// escapeSlack already covers every interpolated field, so this only normalizes
// the server-built scaffolding around them and trims the result.
function sanitizeLine(s) {
  return s.replace(/[\r\n\u2028\u2029]+/g, ' ').trim();
}

function buildSlackMessage(body, caller, origin) {
  const r = body.record;
  const equip = body.equipmentName || `Equipment #${r.equipmentId}`;
  const critNaCount = r.criticalNaCount ?? 0;
  const verdict = r.hasCriticalFail ? 'CRITICAL FAIL' : r.result === 'fail' ? 'ISSUES FOUND' : 'PASS';
  const emoji = r.hasCriticalFail ? ':rotating_light:' : r.result === 'fail' ? ':warning:' : ':white_check_mark:';

  const lines = [
    sanitizeLine(
      `${emoji} *Pre-Trip Inspection — ${escapeSlack(equip)} — ${verdict}${critNaCount > 0 ? ` + ${critNaCount} CRITICAL N/A` : ''}*`,
    ),
    `Inspector: ${escapeSlack(r.inspectorName)} · Shift: ${escapeSlack(r.shift)}`,
    // Server-stamped from the identity headers — never client input. Lets EHS
    // distinguish the claimed inspector name from who actually submitted.
    `Submitted by (verified): ${escapeSlack(caller.user.email)}`,
  ];
  if (r.hourMeterReading != null) lines.push(`Hour meter: ${r.hourMeterReading}`);
  if (r.workOrderId) lines.push(`Work order: ${escapeSlack(r.workOrderId)}`);

  const failed = r.items.filter((i) => i.result === 'fail');
  if (failed.length > 0) {
    lines.push(`Failed items (${failed.length}):`);
    for (const i of failed) {
      lines.push(`• ${escapeSlack(i.label)}${i.critical ? ' *[safety-critical]*' : ''}`);
      if (i.notes) lines.push(`    Note: ${escapeSlack(i.notes)}`);
    }
  }

  const naCritical = r.items.filter((i) => i.critical && i.result === 'na');
  if (naCritical.length > 0) {
    lines.push(`N/A on safety-critical items (${naCritical.length}):`);
    for (const i of naCritical) {
      lines.push(`• ${escapeSlack(i.label)} — ${escapeSlack(i.naReasonCode || 'no reason provided')}`);
      if (i.naJustification) lines.push(`    Detail: ${escapeSlack(i.naJustification)}`);
    }
  }

  // The record endpoint is the durable link — SPA deep links for inspections
  // don't exist until KIN-M0-T5. encodeURIComponent keeps a hostile record id
  // from breaking out of Slack's <url|label> syntax ('|' and '>' both encode).
  lines.push(`<${origin}/api/inspections/${encodeURIComponent(r.id)}|View record ${escapeSlack(r.id)}>`);
  return lines.join('\n');
}

async function notifySlack(env, body, caller, origin) {
  // The webhook URL doubles as the credential, so it lives in the platform
  // secret store. getSecret MUST be called inline on env.KIN — assigning the
  // method to a variable or .bind()ing it detaches it from its RPC proxy and
  // the call breaks at runtime. A repo grep enforces this stays inline.
  let webhook = null;
  try {
    webhook = await env.KIN.getSecret(env.KIN_APP_ID, 'SLACK_WEBHOOK_URL');
  } catch {
    // Control-plane failure ≠ unset secret: report it as a delivery failure.
    return { notified: false, reason: 'failed' };
  }
  if (!webhook) return { notified: false, reason: 'not-configured' };

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: buildSlackMessage(body, caller, origin) }),
      // Same 10s deadline as EXTERNAL_FETCH_TIMEOUT_MS in src/lib/fetch-timeout.ts:
      // a wedged webhook must never hold the inspection response hostage.
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? { notified: true, reason: 'sent' } : { notified: false, reason: 'failed' };
  } catch {
    return { notified: false, reason: 'failed' };
  }
}

// ---------------------------------------------------------------------------
// Slice route handlers (KIN-M0-T4)
// ---------------------------------------------------------------------------

async function handleGetEquipment(env, rawId) {
  const itemNumber = Number(rawId);
  if (!Number.isInteger(itemNumber)) return jsonError(400, 'invalid_equipment_id');
  const row = await env.DB.prepare('SELECT * FROM equipment WHERE item_number = ?')
    .bind(itemNumber)
    .first();
  if (!row) return jsonError(404, 'not_found');
  return Response.json(row, { headers: { 'cache-control': 'no-store' } });
}

async function handleGetInspection(env, id) {
  const record = await env.DB.prepare('SELECT * FROM inspection_records WHERE id = ?')
    .bind(id)
    .first();
  if (!record) return jsonError(404, 'not_found');
  const items = await env.DB.prepare('SELECT * FROM inspection_items WHERE record_id = ? ORDER BY position')
    .bind(id)
    .all();
  // Signature presence comes from the signatures table (the row that holds the
  // R2 key), not from anything the client claimed at submit time.
  const signature = await env.DB.prepare('SELECT storage_key FROM signatures WHERE record_id = ?')
    .bind(id)
    .first();
  return Response.json(
    {
      record,
      items: items.results ?? [],
      hasSignature: !!signature,
      signatureKey: signature ? signature.storage_key : null,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}

// Port of getChecklistType (src/lib/types.ts). The POST body deliberately has
// no checklistType field — NotifyBodySchema never carried one — but the
// inspection_records column is NOT NULL, so it is derived server-side from the
// equipment row the same way the client derives it.
function checklistTypeFor(equip) {
  if (equip.category === 'Aerial Work Platforms') return 'scissor-lift';
  const name = String(equip.name).toLowerCase();
  if (name.includes('manual') || name.includes('hydraulic pallet jack')) return 'manual-pallet-jack';
  if (name.includes('walkie') || name.includes('pallet jack')) return 'walkie-pallet-jack';
  return 'electric-forklift';
}

// NotifyBodySchema accepts any string ≤50 for naReasonCode, but the D1 column
// carries a CHECK on the four NaReasonCode values. Normalize instead of
// letting a schema-valid payload die on the constraint: an unknown code IS
// "other", and the free-text justification column preserves the detail.
const NA_REASON_CODES = ['not-installed', 'cannot-access', 'maintenance-in-progress', 'other'];

function normalizeNaReason(code) {
  if (code == null) return null;
  return NA_REASON_CODES.includes(code) ? code : 'other';
}

async function handleCreateInspection(request, env, caller) {
  let raw;
  try {
    raw = await request.json();
  } catch {
    return jsonError(400, 'invalid_json');
  }

  const validated = validateInspectionBody(raw);
  if (!validated.ok) return jsonError(400, 'invalid_body', { issues: validated.issues });
  const rec = raw.record;

  // The equipment row is needed anyway (checklist_type derivation, and the FK
  // on equipment_id would reject the insert regardless) — resolving it first
  // turns a would-be 500 on the batch into an honest 400.
  const equip = await env.DB.prepare('SELECT item_number, name, category FROM equipment WHERE item_number = ?')
    .bind(rec.equipmentId)
    .first();
  if (!equip) return jsonError(400, 'unknown_equipment', { equipmentId: rec.equipmentId });

  // Decode the signature BEFORE any write. Decoding is pure, and bad base64 is
  // a client error — it must 400 cleanly, not strand a half-written record.
  // (The regex above constrains the alphabet but not padding placement, which
  // is what atob can still reject.)
  let signatureBytes = null;
  if (raw.signatureDataUrl) {
    try {
      signatureBytes = Uint8Array.from(
        atob(raw.signatureDataUrl.slice('data:image/png;base64,'.length)),
        (c) => c.charCodeAt(0),
      );
    } catch {
      return jsonError(400, 'invalid_body', {
        issues: [{ path: 'signatureDataUrl', message: 'invalid base64 payload' }],
      });
    }
  }

  // Record + items in ONE batch so they commit together — a record without its
  // items is not an inspection. Everything is bound, never interpolated.
  //
  // kin_user_id is the x-kin-user-id header the auth Worker stamped, NEVER a
  // value from the body: the body's inspectorName is a claim, the header is
  // who actually submitted, and a client must not be able to write as someone
  // else. has_signature starts 0 and only flips after the blob really lands in
  // R2 — the client's record.hasSignature is likewise just a claim.
  //
  // sheet_synced_at is deliberately not written: it stays NULL until the
  // KIN-M4 scheduled Google Sheets mirror sweeps this row (docs/kin/NOTIFICATIONS.md).
  try {
    await env.DB.batch([
      // sync_status is 'synced' by definition: this row IS the server copy the
      // client-side InspectionSyncStatus tracks progress toward. category and
      // notes bind '' when absent — the schema's NOT NULL convention treats
      // empty string as the TS "blank" value (kin/migrations/0001_slice.up.sql).
      env.DB.prepare(
        `INSERT INTO inspection_records
           (id, equipment_id, inspector_name, shift, hour_meter_reading, checklist_type,
            result, has_critical_fail, critical_na_count, work_order_id, created_at,
            sync_status, has_signature, kin_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        rec.id,
        rec.equipmentId,
        rec.inspectorName,
        rec.shift,
        rec.hourMeterReading ?? null,
        checklistTypeFor(equip),
        rec.result,
        rec.hasCriticalFail ? 1 : 0,
        rec.criticalNaCount ?? 0,
        rec.workOrderId ?? null,
        rec.createdAt,
        'synced',
        0,
        caller.user.id,
      ),
      ...rec.items.map((item, i) =>
        env.DB.prepare(
          `INSERT INTO inspection_items
             (record_id, item_id, position, label, category, critical, result, notes, na_reason_code, na_justification)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          rec.id,
          item.id,
          i,
          item.label,
          '', // NotifyBodySchema items carry no category; '' is the schema's blank
          item.critical ? 1 : 0,
          item.result,
          item.notes ?? '',
          normalizeNaReason(item.naReasonCode),
          item.naJustification ?? null,
        ),
      ),
    ]);
  } catch (e) {
    // Offline queues re-POST on flaky links; a replayed record id is "already
    // saved", not a server fault. The table name check matters: the items
    // table has its own composite PK, and a payload with duplicate item ids is
    // a client bug, not a replay. Anything else is a genuine 5xx — nothing
    // persisted, the client must retry.
    const msg = String(e && e.message);
    if (msg.includes('UNIQUE') && msg.includes('inspection_records')) {
      return jsonError(409, 'duplicate_record', { id: rec.id });
    }
    if (msg.includes('UNIQUE') && msg.includes('inspection_items')) {
      return jsonError(400, 'invalid_body', {
        issues: [{ path: 'record.items', message: 'duplicate item ids' }],
      });
    }
    return jsonError(500, 'db_write_failed');
  }

  // Signature blob to R2, key only to D1 — never the base64. This runs after
  // the record commit on purpose: losing a signature to an R2 hiccup must not
  // lose the inspection, so a failure here degrades to signatureStored:false.
  let signatureStored = false;
  if (signatureBytes) {
    const key = `signatures/${rec.id}.png`;
    try {
      await env.STORAGE.put(key, signatureBytes, { httpMetadata: { contentType: 'image/png' } });
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO signatures (record_id, storage_key, content_type, byte_size, created_at, kin_user_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).bind(rec.id, key, 'image/png', signatureBytes.length, new Date().toISOString(), caller.user.id),
        env.DB.prepare('UPDATE inspection_records SET has_signature = 1 WHERE id = ?').bind(rec.id),
      ]);
      signatureStored = true;
    } catch {
      // Record survives; the response carries the miss.
    }
  }

  // Notify last, and never let it change the status code: the row above is the
  // safety record, Slack is a courtesy. An unset webhook or a dead Slack still
  // returns 2xx with notified:false (criterion KIN-3(e)). The equipment row's
  // own name backfills a missing client-supplied equipmentName so the channel
  // never has to decode "Equipment #24".
  if (!raw.equipmentName) raw.equipmentName = equip.name;
  const outcome = await notifySlack(env, raw, caller, new URL(request.url).origin);

  return Response.json(
    { id: rec.id, saved: true, signatureStored, notified: outcome.notified, reason: outcome.reason },
    { status: 201, headers: { 'cache-control': 'no-store' } },
  );
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

/**
 * The runtime binding surface. Shared by the /__diag/env route and the MCP
 * `diagEnv` tool so both can never drift apart.
 */
async function diagnostics(request, env) {
  let manifest = {};
  if (env.KIN_ASSET_MANIFEST_REF) {
    const obj = await env.KIN_ASSETS.get(env.KIN_ASSET_MANIFEST_REF);
    if (obj) manifest = JSON.parse(await obj.text());
  } else if (env.KIN_ASSET_MANIFEST) {
    manifest = JSON.parse(env.KIN_ASSET_MANIFEST);
  }
  return {
    env_keys: Object.keys(env).sort(),
    app_id: env.KIN_APP_ID ?? null,
    app_slug: env.KIN_APP_SLUG ?? null,
    kin_env: env.KIN_ENV ?? null,
    manifest_ref: env.KIN_ASSET_MANIFEST_REF ?? null,
    manifest_entries: Object.keys(manifest).length,
    manifest,
    binding_shapes: {
      DB_prepare: typeof env.DB?.prepare,
      STORAGE_put: typeof env.STORAGE?.put,
      KIN_ASSETS_get: typeof env.KIN_ASSETS?.get,
      KIN_getSecret: typeof env.KIN?.getSecret,
    },
    identity_headers: {
      'x-kin-user-id': request.headers.get('x-kin-user-id'),
      'x-kin-user-email': request.headers.get('x-kin-user-email'),
      'x-kin-app-role': request.headers.get('x-kin-app-role'),
      'x-kin-is-manager': request.headers.get('x-kin-is-manager'),
      'x-kin-global-role': request.headers.get('x-kin-global-role'),
      'x-kin-ingress': request.headers.get('x-kin-ingress'),
    },
  };
}

// ---------------------------------------------------------------------------
// MCP surface
// ---------------------------------------------------------------------------
//
// Why this exists: every per-app hostname sits behind the Kin auth Worker, so an
// unauthenticated request to /__diag/env gets a 302 to auth.mkin.app/login and
// never reaches this code. kin_invoke_mcp_tool dispatches in-namespace with a
// system principal (ingress "system", x-kin-is-manager "1"), which is the only
// way an automated session can read this app's live runtime state. That is the
// evidence path the Kin roadmap milestones verify against.
//
// Reachability: bearer ingress is OFF for this app (no paths declared via
// kin_set_bearer_paths), so /mcp is not callable from the public internet. The
// only callers are the platform's system principal and a signed-in manager. The
// tool is additionally manager-gated below.

const MCP_PROTOCOL_VERSION = '2024-11-05';

const MCP_TOOLS = [
  {
    name: 'diagEnv',
    description:
      "Report the Worker's runtime binding surface: env keys, app identity, asset-manifest resolution, binding method shapes, and the identity headers stamped on this request. Manager-only.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'smokeSlice',
    description:
      'Drive POST /api/inspections end to end against the live bindings (D1 batch, R2 signature, Slack degradation) and read the record back, returning the full request/response transcript. Manager-only.',
    inputSchema: {
      type: 'object',
      properties: {
        equipmentId: { type: 'number', description: 'equipment item_number to inspect (default 24)' },
      },
      additionalProperties: false,
    },
  },
];

// A real 1x1 transparent PNG, so the smoke run exercises the actual decode →
// R2 put → signatures-row path rather than skipping it.
const SMOKE_SIGNATURE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/**
 * Exercise the pre-trip slice through the REAL route. curl cannot produce this
 * transcript — the app hostname sits behind the Kin auth Worker, so even a
 * self-addressed outbound fetch would 302 to login. Instead we construct a
 * Request carrying the SAME identity headers this MCP call arrived with and
 * dispatch it through this module's own fetch handler in-process. Nothing is
 * bypassed: the synthetic request hits the identical 401 gate, validator, D1
 * batch, R2 put, and Slack degradation contract a browser submission would.
 */
async function smokeSlice(request, env, args) {
  const origin = new URL(request.url).origin;
  const recordId = `smoke-${crypto.randomUUID()}`;
  const equipmentId = typeof args?.equipmentId === 'number' ? args.equipmentId : 24;

  const body = {
    record: {
      id: recordId,
      equipmentId,
      inspectorName: 'smokeSlice (automated)',
      shift: 'Day',
      hourMeterReading: null,
      createdAt: new Date().toISOString(),
      result: 'pass',
      hasCriticalFail: false,
      criticalNaCount: 0,
      workOrderId: null,
      hasSignature: true,
      items: [
        { id: 'smoke-horn', label: 'Horn operational', result: 'pass', critical: true },
        { id: 'smoke-tires', label: 'Tires and wheels', result: 'pass', critical: false },
      ],
    },
    equipmentName: `Smoke test rig #${equipmentId}`,
    equipmentCategory: 'Powered Industrial Trucks',
    signatureDataUrl: SMOKE_SIGNATURE_PNG,
  };

  // Forward the identity verbatim — the smoke record is written AS the caller,
  // under the caller's authorization, exactly like a browser submission.
  const headers = new Headers({ 'content-type': 'application/json' });
  for (const h of [
    'x-kin-user-id',
    'x-kin-user-email',
    'x-kin-app-role',
    'x-kin-is-manager',
    'x-kin-global-role',
    'x-kin-ingress',
  ]) {
    const v = request.headers.get(h);
    if (v !== null) headers.set(h, v);
  }

  const postRes = await handleRequest(
    new Request(`${origin}/api/inspections`, { method: 'POST', headers, body: JSON.stringify(body) }),
    env,
  );
  const postBody = await postRes.json().catch(() => null);

  // The read-back proves the batch actually committed — a 2xx POST alone would
  // also be satisfied by a handler that never touched D1.
  const getPath = `/api/inspections/${encodeURIComponent(recordId)}`;
  const getRes = await handleRequest(new Request(`${origin}${getPath}`, { headers }), env);
  const getBody = await getRes.json().catch(() => null);

  return {
    recordId,
    identity: {
      userId: request.headers.get('x-kin-user-id'),
      email: request.headers.get('x-kin-user-email'),
      ingress: request.headers.get('x-kin-ingress'),
    },
    post: {
      method: 'POST',
      path: '/api/inspections',
      // Elide the base64 so the transcript stays readable in evidence files.
      requestBody: { ...body, signatureDataUrl: `data:image/png;base64,<${SMOKE_SIGNATURE_PNG.length} chars elided>` },
      status: postRes.status,
      responseBody: postBody,
    },
    get: {
      method: 'GET',
      path: getPath,
      status: getRes.status,
      responseBody: getBody,
    },
  };
}

async function handleMcp(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
      { status: 400 },
    );
  }
  const { id, method, params } = body || {};
  const reply = (result) => Response.json({ jsonrpc: '2.0', id: id ?? null, result });

  if (method === 'initialize') {
    return reply({
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: 'sage-ehs', version: '0.1.0' },
    });
  }
  if (method === 'notifications/initialized') return new Response(null, { status: 204 });
  if (method === 'tools/list') return reply({ tools: MCP_TOOLS });

  if (method === 'tools/call') {
    if (request.headers.get('x-kin-is-manager') !== '1') {
      return reply({
        isError: true,
        content: [{ type: 'text', text: 'manager_only: this tool requires app-manager status.' }],
      });
    }
    if (params?.name === 'diagEnv') {
      const payload = await diagnostics(request, env);
      return reply({ content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] });
    }
    if (params?.name === 'smokeSlice') {
      const payload = await smokeSlice(request, env, params?.arguments);
      return reply({ content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] });
    }
    return reply({
      isError: true,
      content: [{ type: 'text', text: `Unknown tool: ${params?.name}` }],
    });
  }

  return Response.json(
    { jsonrpc: '2.0', id: id ?? null, error: { code: -32601, message: `Unknown method: ${method}` } },
    { status: 400 },
  );
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function handleRequest(request, env) {
  const url = new URL(request.url);

  // Manager-gated runtime diagnostic. The throwaway probe in kin/worker/diag.js
  // recorded the binding surface once at KIN-M0; this durable copy is how we
  // re-check it after any platform change without redeploying a probe.
  if (url.pathname === '/__diag/env') {
    if (request.headers.get('x-kin-is-manager') !== '1') {
      return jsonError(403, 'manager_only');
    }
    return Response.json(await diagnostics(request, env));
  }

  if (url.pathname === '/mcp' && request.method === 'POST') {
    return handleMcp(request, env);
  }

  // API routes are matched BEFORE any asset lookup so an app route always wins
  // over a same-named static file.
  if (url.pathname.startsWith('/api/')) {
    // Every /api/* route requires platform-stamped identity — missing headers
    // mean the request bypassed the auth Worker, and no handler below runs (so
    // an unauthenticated POST cannot touch the DB).
    const caller = getCaller(request);
    if (caller.kind !== 'ok') return jsonError(401, 'no_identity');

    const equipment = url.pathname.match(/^\/api\/equipment\/([^/]+)$/);
    if (equipment) {
      if (request.method !== 'GET') return jsonError(405, 'method_not_allowed');
      return handleGetEquipment(env, equipment[1]);
    }

    if (url.pathname === '/api/inspections') {
      if (request.method !== 'POST') return jsonError(405, 'method_not_allowed');
      return handleCreateInspection(request, env, caller);
    }

    const inspection = url.pathname.match(/^\/api\/inspections\/([^/]+)$/);
    if (inspection) {
      if (request.method !== 'GET') return jsonError(405, 'method_not_allowed');
      return handleGetInspection(env, decodeURIComponent(inspection[1]));
    }

    // The remaining routes land in KIN-M4. Until then this is an honest 501,
    // not a stub that pretends to work.
    return jsonError(501, 'not_implemented', { path: url.pathname });
  }

  const asset = await serveAsset(env, url.pathname);
  if (asset) return asset;

  // SPA deep links (/inspect/24, /safety/ptp) have no file of their own — fall
  // back to the app shell so the client router can take over. Anything under
  // /assets/ is a real file request, so a miss there stays a 404.
  if (request.method === 'GET' && !url.pathname.startsWith('/assets/')) {
    const shell = await serveAsset(env, '/index.html');
    if (shell) return shell;
  }

  return new Response('Not found', { status: 404 });
}

export default {
  // A named router rather than an inline method so the MCP smokeSlice tool can
  // dispatch a synthetic Request through the exact same code path in-process.
  fetch: handleRequest,
};
