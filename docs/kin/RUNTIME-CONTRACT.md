# Kin runtime contract — measured, not assumed

**App:** `sage-ehs` · **Recorded:** 2026-08-05, roadmap iteration 22 (KIN-M0)
**Machine-readable copy:** [`kin/evidence/diag-env.json`](../../kin/evidence/diag-env.json)

Everything below was read off a real preview deployment. Where this document and
the Kin skill disagree, this document wins for `sage-ehs` — but re-probe before
trusting it after any platform change (the `/__diag/env` route in
`kin/worker/index.js` is the durable way to do that).

---

## How to read a live Worker from an automated session

This is the finding that unblocks every later Kin milestone, so it goes first.

Every per-app hostname sits behind the Kin auth Worker. An unauthenticated
request never reaches app code:

```
$ curl -sS -o /dev/null -w '%{http_code} -> %{redirect_url}\n' \
    https://preview-sage-ehs.mkin.app/__diag/env
302 -> https://auth.mkin.app/login?return_to=https%3A%2F%2Fpreview-sage-ehs.mkin.app%2F__diag%2Fenv
```

So `curl` cannot be the evidence path for anything behind the app hostname. The
platform's `kin_invoke_mcp_tool` **can** — it dispatches in-namespace with a
system principal, bypassing cookie and bearer auth entirely.

The catch: `createKinMcp()` from `@mytra/kin-sdk` is not resolvable inside a Kin
bundle (see the npm-import finding below). So `kin/worker/index.js` hand-rolls
the three JSON-RPC methods the invoker needs — `initialize`, `tools/list`,
`tools/call` — and exposes one manager-gated `diagEnv` tool.

```
kin_invoke_mcp_tool({slug: 'sage-ehs', tool: 'diagEnv', env: 'preview'})
```

**This is not a public hole.** Bearer ingress is off for this app:

```
kin_get_bearer_paths({slug: 'sage-ehs'})  ->  {"paths": [], "enabled": false}
```

`POST /mcp` from the public internet 302s to login like everything else. The only
callers are the platform system principal and a signed-in manager, and
`tools/call` additionally requires `x-kin-is-manager === '1'`.

---

## The binding surface

`Object.keys(env).sort()` on a live preview Worker — exactly nine bindings, and
nothing else:

| Binding | Present | Shape check |
| --- | --- | --- |
| `DB` | yes | `prepare`, `batch` are functions |
| `STORAGE` | yes | `get`, `put` are functions |
| `KIN_ASSETS` | yes | `get` is a function |
| `KIN` | yes | `getSecret`, `scheduleTask` are functions |
| `KIN_APP_ID` | yes | `4a1e7a91-b8bb-4415-b05f-d37fe0e91e6b` |
| `KIN_APP_SLUG` | yes | `sage-ehs` |
| `KIN_ENV` | yes | `preview` |
| `KIN_ASSET_MANIFEST` | yes | inline JSON (present at 1 asset; will vanish as the SPA grows) |
| `KIN_ASSET_MANIFEST_REF` | yes | R2 key — see below |

The probe checked method *shapes*, not just key presence, so a binding that
existed but arrived inert would have been caught.

**Anything not in that table is not in `env`.** No `process.env`, no
`env.SECRETS`, no identity RPC.

### Asset manifest resolution

`KIN_ASSET_MANIFEST_REF` resolved and was used (`manifest_source: "ref"`):

```
apps/4a1e7a91-b8bb-4415-b05f-d37fe0e91e6b/manifests/ad9c87f9…a0e.json
```

Note the key layout: manifests live under `apps/{APP_ID}/manifests/{hash}.json`,
while the assets themselves live at `apps/{APP_ID}/{hash}` (no subfolder).

Both bindings are populated at this size. The inline one is a plain-text Worker
binding capped around 5 KB and **will go missing** once the SPA exceeds ~50
files, which is why `getManifest()` in `kin/worker/index.js` reads the REF
unconditionally first and treats the inline binding as fallback only.

### Runtime globals

`crypto.subtle.digest`, `AbortSignal.timeout`, and `Response.json` are all
available. That matters for the port: `AbortSignal.timeout` is what
`src/lib/fetch-timeout.ts` relies on (BE-9), so it carries over unchanged.

---

## npm imports are NOT resolved at deploy time

The migration assessment flagged this as needing a probe before we relied on
zod. Settled — a deliberately throwaway deploy of:

```js
import { z } from 'zod';
```

failed the upload:

```
CF API PUT /client/v4/accounts/…/scripts/kin-app-sage-ehs-prod-preview
returned 400: [10021] Uncaught Error: No such module "zod".
  imported from "worker.js"
```

**Consequence, and it is a design constraint not a preference:** the Worker is
authored as a single self-contained ES module with **zero import statements**.
This is also what KIN-4 in the frozen rubric requires.

- **Server-side validation** cannot use zod. The ported handlers hand-roll their
  checks against the same shapes `src/lib/inspection-notify-schema.ts` encodes.
  Divergence between the two is a real risk — KIN-M1 should pin it with a test
  that drives both.
- **Client-side** zod is unaffected: the SPA bundle is built by Vite and served
  as a static asset, so it can import whatever it likes.
- **No bundler is in the dependency tree** for the Worker, because there is
  nothing to bundle. `kin/scripts/kin-build.mjs` only stages assets.

---

## Identity: two orthogonal axes, and a trap

Headers stamped on the in-band call, verbatim:

```json
{
  "x-kin-user-id":     "0f43596b-0406-47cb-bc93-4b2e9a370925",
  "x-kin-user-email":  "mark.starr@mytra.ai",
  "x-kin-app-role":    null,
  "x-kin-is-manager":  "1",
  "x-kin-global-role": null,
  "x-kin-ingress":     "system"
}
```

**`x-kin-app-role` is `null` for the account that created the app.** Creating an
app grants manager status (the platform-access axis); it does **not** grant an
app role (the runtime axis). They are separate tables and a user can hold either,
both, or neither.

The trap this sets for the port: `src/lib/roles.ts` resolves a single
admin/ehs/worker ladder from env allowlists, so a naive translation would map
"app creator" to "admin" and quietly hand in-app admin UI to every manager. When
EN-9's RBAC is ported (KIN-M4), gate:

- deploy/settings/secrets → `isManager`
- in-app admin UI → `appRole === 'admin' || globalRole === 'platform_admin'`
- ordinary use → `appRole !== null`

`x-kin-ingress` distinguishes `system` (in-band MCP), cookie, and bearer traffic
— useful if a handler should refuse one of them.

---

## Deployment facts

- Preview URL: <https://preview-sage-ehs.mkin.app> — answers `302` to login from
  the public internet, i.e. it is served by the Kin edge (not NXDOMAIN/404).
- Live URL: <https://sage-ehs.mkin.app> — resolves, but **nothing is promoted
  yet**; `kin_get_health` reports `status: "no_live_yet"`, `live: null`.
- Preview is on version 2 (`source_archive_status: "archived"`).
- `/` is **not** auto-rewritten to `/index.html` — the Worker does it explicitly.
- Deploy pipeline in this repo: `npm run kin:build` stages `kin/public` into
  `kin/dist` and writes `kin/dist/asset-manifest.json`; `npm run kin:check`
  re-hashes and fails on drift.
