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
// src/lib/api-auth.ts + next-auth from the Vercel app.

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
];

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
    if (params?.name !== 'diagEnv') {
      return reply({
        isError: true,
        content: [{ type: 'text', text: `Unknown tool: ${params?.name}` }],
      });
    }
    const payload = await diagnostics(request, env);
    return reply({ content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] });
  }

  return Response.json(
    { jsonrpc: '2.0', id: id ?? null, error: { code: -32601, message: `Unknown method: ${method}` } },
    { status: 400 },
  );
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env) {
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
      const caller = getCaller(request);
      if (caller.kind !== 'ok') return jsonError(401, 'no_identity');

      // Handlers land here across KIN-M0-T4 (pre-trip slice) and KIN-M4 (the
      // remaining 19 routes). Until then this is an honest 501, not a stub that
      // pretends to work.
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
  },
};
