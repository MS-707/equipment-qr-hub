// Kin runtime diagnostic probe — Sage EHS (KIN-M0-T2).
//
// This is NOT the shipped bundle. It is deployed to preview once, its output is
// recorded verbatim in kin/evidence/diag-env.json and docs/kin/RUNTIME-CONTRACT.md,
// and then kin/worker/index.js takes over. The durable copy of the /__diag/env
// route lives in index.js behind an x-kin-is-manager gate.
//
// Why the /mcp endpoint exists: every per-app hostname sits behind the Kin auth
// Worker, so an unauthenticated `curl https://preview-sage-ehs.mkin.app/__diag/env`
// gets a 302 to auth.mkin.app/login and never reaches this code. The platform's
// kin_invoke_mcp_tool reaches an app's own /mcp in-band with a system principal,
// which is the only way an automated session can read a live binding surface
// without a browser. The SDK's createKinMcp() is not resolvable inside a
// self-contained Worker bundle (the platform resolves no npm imports at deploy
// time), so this hand-rolls the three JSON-RPC methods the invoker needs.
//
// Dependency-free by construction: zero import statements.

const PROTOCOL_VERSION = '2024-11-05';

async function collect(request, env) {
  // Resolve the asset manifest the same way the real Worker will, so the probe
  // proves the REF path works rather than only reporting that the binding exists.
  let manifest = {};
  let manifestSource = 'none';
  if (env.KIN_ASSET_MANIFEST_REF) {
    const obj = await env.KIN_ASSETS.get(env.KIN_ASSET_MANIFEST_REF);
    if (obj) {
      manifest = JSON.parse(await obj.text());
      manifestSource = 'ref';
    }
  } else if (env.KIN_ASSET_MANIFEST) {
    manifest = JSON.parse(env.KIN_ASSET_MANIFEST);
    manifestSource = 'inline';
  }

  return {
    env_keys: Object.keys(env).sort(),
    app_id: env.KIN_APP_ID ?? null,
    app_slug: env.KIN_APP_SLUG ?? null,
    kin_env: env.KIN_ENV ?? null,
    manifest_ref: env.KIN_ASSET_MANIFEST_REF ?? null,
    manifest_inline_present: typeof env.KIN_ASSET_MANIFEST === 'string',
    manifest_source: manifestSource,
    manifest,
    // Shape checks, not just key presence — a binding that exists but lacks its
    // methods would otherwise read as a pass.
    binding_shapes: {
      DB_prepare: typeof env.DB?.prepare,
      DB_batch: typeof env.DB?.batch,
      STORAGE_put: typeof env.STORAGE?.put,
      STORAGE_get: typeof env.STORAGE?.get,
      KIN_ASSETS_get: typeof env.KIN_ASSETS?.get,
      KIN_getSecret: typeof env.KIN?.getSecret,
      KIN_scheduleTask: typeof env.KIN?.scheduleTask,
    },
    // What the auth Worker actually stamped on this request.
    identity_headers: {
      'x-kin-user-id': request.headers.get('x-kin-user-id'),
      'x-kin-user-email': request.headers.get('x-kin-user-email'),
      'x-kin-app-role': request.headers.get('x-kin-app-role'),
      'x-kin-is-manager': request.headers.get('x-kin-is-manager'),
      'x-kin-global-role': request.headers.get('x-kin-global-role'),
      'x-kin-app-env': request.headers.get('x-kin-app-env'),
      'x-kin-ingress': request.headers.get('x-kin-ingress'),
    },
    runtime: {
      has_crypto_subtle: typeof crypto?.subtle?.digest === 'function',
      has_abort_signal_timeout: typeof AbortSignal?.timeout === 'function',
      has_response_json: typeof Response.json === 'function',
    },
  };
}

function rpcResult(id, result) {
  return Response.json({ jsonrpc: '2.0', id: id ?? null, result });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/__diag/env') {
      return Response.json(await collect(request, env));
    }

    // Minimal MCP server: initialize / tools/list / tools/call.
    if (url.pathname === '/mcp' && request.method === 'POST') {
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

      if (method === 'initialize') {
        return rpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: 'sage-ehs-diag', version: '0.0.1' },
        });
      }

      if (method === 'notifications/initialized') {
        return new Response(null, { status: 204 });
      }

      if (method === 'tools/list') {
        return rpcResult(id, {
          tools: [
            {
              name: 'diagEnv',
              description:
                'Report the Worker runtime binding surface: env keys, app identity, asset-manifest resolution, binding method shapes, and the identity headers stamped on this request.',
              inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            },
          ],
        });
      }

      if (method === 'tools/call') {
        if (params?.name !== 'diagEnv') {
          return rpcResult(id, {
            isError: true,
            content: [{ type: 'text', text: `Unknown tool: ${params?.name}` }],
          });
        }
        const payload = await collect(request, env);
        return rpcResult(id, {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        });
      }

      return Response.json(
        { jsonrpc: '2.0', id: id ?? null, error: { code: -32601, message: `Unknown method: ${method}` } },
        { status: 400 },
      );
    }

    return new Response('probe', { status: 200 });
  },
};
