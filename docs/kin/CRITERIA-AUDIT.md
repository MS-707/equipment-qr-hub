# KIN criteria audit — unsatisfiable and at-risk verify clauses

**Audited:** 2026-08-05 · branch `claude/construction-safety-audits-HC6MA` · repo HEAD `67af49f`
**Target:** all ten criteria in `docs/roadmap/goals.json` → `dimensions.kin.criteria`
**Platform state at audit time:** app `sage-ehs` (`4a1e7a91-b8bb-4415-b05f-d37fe0e91e6b`), preview version 3, migrations `0001_slice` + `0002_seed_equipment` applied, `status: "no_live_yet"`, `live: null`, `roles: []`.

> **This report changes nothing.** `docs/roadmap/goals.json` was **not edited** — rail 3 freezes the rubric, and every amendment below is a *proposal for a human to adjudicate*, not a change that has been made. No file outside this document was written; no deploy, migration, role grant or schedule was created. All MCP calls were read-only (`kin_get_schema`, `kin_list_deployments`, `kin_get_health`, `kin_list_roles`).

---

## 1. Verdict

**Six of the ten KIN criteria contain at least one clause that can never pass, no matter how well the milestone is implemented.** KIN-4, KIN-5, KIN-6, KIN-7, KIN-8 and KIN-10 are **BROKEN** — nine distinct blocker-severity clauses among them. Three more (KIN-2, KIN-3, KIN-9) are **AT_RISK**: every clause is *executable*, but each rests on an assumption that is false somewhere the track will reach before the milestone closes. Exactly one criterion, **KIN-1**, is clean — all six of its clauses were run against live state and all six pass, with five cosmetic notes where the prose demands more than the verify checks. The defects are not evenly distributed by cause: **four of the six BROKEN criteria are broken by the same one-word path disagreement** (`kin/src` in the frozen verify strings vs `kin/spa` in every milestone task that builds the SPA), and **two more repeat the exact bug the owner amended out of KIN-1 and KIN-10** — a `jq` expression written against an imagined bare array when the MCP tool returns an object wrapping it.

### Four decisions, in priority order

1. **Pick one SPA root.** `goals.json` contains 10 task references to `kin/spa` and 6 verify references to `kin/src`, and neither directory exists. This single decision unblocks KIN-4, KIN-5, KIN-7, KIN-8 and KIN-9 (and confirms KIN-10, which already says `kin/spa`). **Complication:** renaming does not fix KIN-8, because the plan says the ported files *do not move at all* (`@/ -> src/` alias) — see §3.8.
2. **Decide whether ported components are copied into the Kin tree or aliased in place.** KIN-8's three path clauses and KIN-7's env-leakage grep both assume *copied*; KIN-M0-T5 / KIN-M2-T3 both say *aliased, not edited, not moved*.
3. **Settle the safety-records data model.** KIN-2 demands "a table per record shape" (10 tables); KIN-M1-T2 designs one `safety_records` table with a type discriminant. Whichever way the implementer goes, the other document refutes them.
4. **Name the sanctioned evidence path for anything behind an app hostname.** Every per-app hostname 302s to `auth.mkin.app`; bearer ingress is off. KIN-8's Playwright-against-preview clause and every `milestoneAcceptance` `curl $KIN_PREVIEW_URL/...` line assume otherwise.

---

## 2. Scoreboard

| Criterion | Verdict | Single worst problem | Severity |
| --- | --- | --- | --- |
| **KIN-1** | CLEAN | Verify checks 6 of the 7 env keys the prose names — `KIN_APP_SLUG` is never asserted | cosmetic |
| **KIN-2** | AT_RISK | `jq -r '.tables[].name'` assumes a shape `kin_get_schema` never returns; `\| sort` masks the exit-5 error into an empty result | risk |
| **KIN-3** | AT_RISK | The named test imports `node:sqlite`; `ci.yml` pins Node 20, where that module does not exist — and it takes all 83 suites down with it | risk |
| **KIN-4** | **BROKEN** | Zero-`next/*` grep is mutually exclusive with KIN-M2's shim design, which requires those specifiers to survive | **blocker** |
| **KIN-5** | **BROKEN** | `kin-assets.mjs --check` prints no path on success, so its output can never "include `/sw.js`" | **blocker** |
| **KIN-6** | **BROKEN** | "401 on every mapped handler" contradicts the criterion's own public-by-design carve-out; two source routes are genuinely unauthenticated | **blocker** |
| **KIN-7** | **BROKEN** | Greps `kin/src`, a directory no task in the plan of record ever creates | **blocker** |
| **KIN-8** | **BROKEN** | Four clauses target `kin/src/**` paths the plan deliberately never creates — files are aliased, not copied | **blocker** |
| **KIN-9** | AT_RISK | Final grep errors (exit 2) on missing `kin/src` rather than returning empty; leaves all SPA source unscanned | risk |
| **KIN-10** | **BROKEN** | `jq -e '[.[]\|select(.env=="live")]'` dies exit 5 — the identical object-wrapping bug the same commit just amended out of the roles clause | **blocker** |

**Blocker findings by criterion:** KIN-8 (4), KIN-4 (1), KIN-5 (1), KIN-6 (1), KIN-7 (1), KIN-10 (1) — nine total.

---

## 3. Findings

> **Pasting into `goals.json`:** the replacement text below is shown **raw**. When pasted into a JSON string value, every `"` must become `\"` and every `\` must become `\\`. Several proposals contain regex backslashes — check those twice.

---

### 3.1 KIN-2 — AT_RISK — evidence file shape does not match the tool it claims to come from

**Offending clause**

```
node kin/scripts/migrate-check.mjs --print-tables | sort must equal
jq -r '.tables[].name' kin/evidence/schema.json | sort
```

**Assumed:** `kin/evidence/schema.json` — which the prose sources as "(from `kin_get_schema`)" — has a top-level `.tables` array of `{name}` objects, i.e. tables pre-split from indexes.

**Actual:** `kin_get_schema` returns a single top-level key `schema` holding a **flat array mixing tables and indexes**, each element `{name, type, sql}`. There is no `.tables` key and no `.indexes` key. The committed file works only because it is a hand-reshaped transcription. The moment KIN-M1 regenerates it from the tool — which is what the criterion says it is — the clause breaks, and `| sort` swallows the error into an empty result rather than surfacing it.

**Evidence (live, this session)**

```
$ mcp__kin__kin_get_schema({slug:"sage-ehs"})
{"schema":[{"name":"equipment","type":"table","sql":"CREATE TABLE equipment (...)"},
           {"name":"idx_inspection_records_created_at","type":"index",...},
           ... 8 elements, 4 tables + 4 indexes, one flat array ...]}

$ jq -r 'keys[]' kin/evidence/schema.json
_recorded
indexes
tables                                    <-- hand-reshaped, not the tool payload

$ jq -r '.tables[].name' <raw-tool-payload>
jq: error: Cannot iterate over null (null)          exit=5
$ jq -r '.tables[].name' <raw-tool-payload> | sort
jq: error: Cannot iterate over null (null)          PIPELINE exit=0, output EMPTY
```

**Proposed replacement** (verified against both the raw tool payload and the current committed file — both return the four table names, exit 0):

```
node kin/scripts/migrate-check.mjs --print-tables | sort must equal jq -r '(.schema // .tables)[] | select(.type=="table") | .name' kin/evidence/schema.json | sort, run under `set -o pipefail` so a jq shape error (exit 5) surfaces instead of being masked by the pipe into sort; kin/evidence/schema.json must store the kin_get_schema payload VERBATIM (top-level key "schema", a flat array of {name,type,sql} mixing tables and indexes)
```

**Also in KIN-2, needing adjudication rather than rewording:**

- *"asserts a table per record shape"* is contradicted by **KIN-M1-T2**, which collapses the six `SafetyRecordType` variants (`src/lib/safety-types.ts:15-21`) into **one** `safety_records` table with a JSON payload column. Following the plan yields 1 table where the verify demands 6. **This needs decision 3 above, not a wording tweak.** Proposed text if the union design wins:
  ```
  asserts every one of the ten record shapes is durably represented — either by its own table, or, for the six SafetyRecordType variants, by rows in safety_records whose `type` column is CHECK-constrained to exactly the six members of SafetyRecordType (src/lib/safety-types.ts:15-21) with a per-variant payload-key assertion; the test must enumerate all ten shapes by name and fail if any is unrepresented (a test that only counts files or tables does not satisfy this)
  ```
- *"every record table carries a `kin_user_id` column"* — `equipment` has none and structurally should not (seeded reference catalog, no submitter); `inspection_items` has none (child rows). Both shipped in `0001` and are locked in by the already-verified KIN-1 and KIN-3. **This was already logged as a carry-forward at iteration 23 and has sat unadjudicated since.** Proposed text:
  ```
  every table storing user-SUBMITTED records — inspection_records, safety_records, crew_signatures, audit_events, signatures, work_orders — carries a kin_user_id column holding the x-kin-user-id of the submitter; seeded reference catalogs (equipment, training_programs) and child tables keyed by a parent record id (inspection_items) are exempt, and kin/__tests__/migrations.test.ts must pin that exemption list explicitly by name so the exemption cannot silently widen
  ```
- *`grep -L 'IRREVERSIBLE' on any empty .down.sql must return nothing`* — "on any empty .down.sql" is prose, not a glob. The only executable reading prints **both** shipped down files today, because they are correct reversible SQL and therefore contain no marker. Run naively this **refutes correct work**. Verified:
  ```
  $ grep -L 'IRREVERSIBLE' kin/migrations/*.down.sql
  kin/migrations/0001_slice.down.sql
  kin/migrations/0002_seed_equipment.down.sql        exit=0  -- clause FAILS today
  ```
  Proposed replacement:
  ```
  for f in kin/migrations/*.down.sql; do grep -qvE '^[[:space:]]*(--.*)?$' "$f" || grep -q '^-- IRREVERSIBLE:' "$f" || echo "$f"; done must print nothing — every down file either contains at least one non-comment SQL line, or begins with the literal marker `-- IRREVERSIBLE:`
  ```

**Task-side drift (no rubric change needed):** KIN-M1-T1/T2/T3 name `0002_core_records.sql (+ down)` etc. — no `.up.sql`/`.down.sql` pair — and KIN-M1's `milestoneAcceptance` names a *different* checker at a *different* path (`node scripts/kin-migrate-check.mjs`) asserting against the `kin_create_migration` `sql_down` API field rather than files on disk. The KIN-2 clause is correct and matches what shipped; **the tasks are what must move.**

---

### 3.2 KIN-3 — AT_RISK — the named test cannot run on the Node the repo pins

**Offending clause**

```
npm test -- kin/__tests__/slice-pretrip.test.ts green
```

**Assumed:** the runtime executing `npm test` can load `node:sqlite` — the test's first import, and what backs the whole D1 harness. The clause names no runtime floor.

**Actual:** green on an interactive box (Node v25.8.2), but **impossible** on the runtime `.github/workflows/ci.yml` pins. And because `vitest.config.ts` sets only `exclude` (never `include`), this file is in the **default** suite — so CI does not skip it, it dies on it and takes the other 82 files with it.

**Evidence**

```
$ npm test -- kin/__tests__/slice-pretrip.test.ts
 Test Files  1 passed (1) / Tests  18 passed (18)          [Node v25.8.2]

$ npx -y node@20.19.0 -e "require('node:sqlite')"
ERR_UNKNOWN_BUILTIN_MODULE | No such built-in module: node:sqlite

$ grep -n 'node-version' .github/workflows/ci.yml
17:          node-version: 20
43:          node-version: 20

$ npx vitest list --filesOnly | wc -l          -> 83   (kin/... is file 1 of 83)
```

The repo's own type shim admits the floor (`kin/__tests__/node-sqlite.d.ts`: "the module landed in Node 22") — nothing propagated it to `ci.yml`. **No CI run has executed since 2026-07-07**, a month before this test landed, so the breakage is real but unobserved.

**Proposed replacement**

```
npm test -- kin/__tests__/slice-pretrip.test.ts green ON NODE >= 22 (the suite drives the real migrations through node:sqlite, which does not exist before v22.5 — ERR_UNKNOWN_BUILTIN_MODULE); since vitest.config.ts sets only `exclude`, this file is in the default suite, so ALSO confirm .github/workflows/ci.yml no longer pins node-version 20 for the Test job (bump it to 22+) or the clause is unverifiable in CI
```

**Second finding — a guard that is disarmed on any non-ugrep runner:**

```
grep -nE '(const|let|var)\s+\w+\s*=\s*env\.KIN\.|env\.KIN\.[A-Za-z]+\.(bind|call|apply)' kin/worker returns nothing
```

There is no `-r`, and the operand is a **directory**. Under POSIX grep this is an error — stdout empty, exit 2 — so "returns nothing" is satisfied **vacuously**, no file is read, and the clause can never fail even if someone lands `const gs = env.KIN.getSecret`. It works on this machine only because Claude Code shims `grep` to ugrep, which recurses into directory operands.

```
$ /usr/bin/grep -nE '<pattern>' kin/worker
grep: kin/worker: Is a directory              exit=2, zero matches
$ grep --version | head -1
ugrep 7.5.0 aarch64-apple-macosx              <-- what the harness actually resolves
```

The regex itself is sound on both flavors (a positive control matched all four detached forms and correctly ignored the inline `await` form). Proposed replacement:

```
grep -rnE '(const|let|var)\s+\w+\s*=\s*env\.KIN\.|env\.KIN\.[A-Za-z]+\.(bind|call|apply)' kin/worker/ returns nothing AND exits 1 (no detached RPC) — the -r is load-bearing: without it a POSIX grep errors 'Is a directory' (exit 2, empty stdout) and the check passes vacuously
```

Two cosmetic notes worth folding into the same amendment: the prose says the signature blob is stored "under a per-app key prefix" but the implemented key is `signatures/${rec.id}.png` with no app id (the *binding* is per-app, not the key); and sub-fact (d)'s "not a hardcoded hostname" reads as a prohibition on the string, which a skimming re-verifier will trip on — the test's `SLACK_URL` constant is the correct shape, and the assertion is on **provenance** (`url === the value stubbed getSecret returned`), not hostname.

---

### 3.3 KIN-4 — BROKEN — the zero-`next/*` grep contradicts the milestone that flips it

**Offending clause**

```
grep -rn "from 'next\|from \"next" kin/src kin/worker returns nothing
```

**Assumed:** zero `from 'next...'` specifiers exist anywhere in the SPA tree once the SPA lands.

**Actual:** the milestone that flips KIN-4 is **designed to keep them**. KIN-M2-T2, verbatim: *"kin/spa/shims/next-link.tsx + kin/spa/shims/next-navigation.ts … aliased in the vite config so the 63 components' existing next/link and next/navigation imports resolve untouched."* KIN-M2-T3: *"Components themselves are not edited."* KIN-M2's own `milestoneAcceptance`: *"0 next/\* specifiers **outside kin/spa/shims/**"* — the plan explicitly permits what KIN-4 permits zero of.

The clause is mutually exclusive with the plan in both directions: honor KIN-M2 and the grep can never return nothing (if the components land under the SPA tree); don't, and it passes **vacuously** (if the 63 components stay in `src/` behind the `@/ -> src/` alias, the SPA bundle is still full of `next/*` and the grep proves nothing).

**Evidence**

```
$ grep -rl "from 'next/" src/components | wc -l      -> 19
$ find src/components -name '*.tsx' | wc -l          -> 63
$ ls kin/src                                          -> No such file or directory
```

**Proposed replacement**

```
grep -rn "from 'next/\|from \"next/" $SPA_ROOT kin/worker --include='*.ts' --include='*.tsx' --include='*.js' | grep -v '/shims/' returns nothing (next/link and next/navigation are permitted ONLY inside $SPA_ROOT/shims/, where the vite alias maps them to local implementations — see KIN-M2-T2); test -f $SPA_ROOT/shims/next-link.tsx && test -f $SPA_ROOT/shims/next-navigation.ts && grep -n 'next/link' $SPA_ROOT/vite.config.* hits the alias entry; and node scripts/kin-check-imports.mjs --spa reports 0 unresolved externals in the built bundle
```

**Three more clauses in KIN-4 fail against correct code:**

- **`and an unknown path returns 404`** — it does not, by design. The shipped worker already falls back to the SPA shell for any unknown non-`/assets` GET, and KIN-M2-T6 **requires** that (`/inspect/42` must survive a cold reload); KIN-M2's acceptance asserts `curl -sI $KIN_PREVIEW_URL/inspect/1` shows 200. Driving the real `fetch` export in-process: `GET /totally-unknown-path -> 200 text/html`, `GET /inspect/42 -> 200`, `GET /assets/missing.js -> 404`, `POST /totally-unknown-path -> 404`. An implementer making this clause pass would have to **delete the deep-link fallback**. Proposed:
  ```
  an unknown path under /assets/ returns 404 and an unknown non-GET request returns 404, while an unknown non-/api, non-/assets GET returns 200 with the /index.html shell (the SPA deep-link fallback KIN-M2-T6 requires), and an unknown /api/* path returns a JSON error rather than the shell
  ```
- **`grep -n 'KIN_ASSET_MANIFEST_REF' … hits before any KIN_ASSET_MANIFEST use`** — `KIN_ASSET_MANIFEST` is a strict **prefix** of `KIN_ASSET_MANIFEST_REF`, so the two hit sets can never be disjoint. Against today's already-correct implementation the ordering is inverted: first-REF-hit is line **48**, first-plain-hit is line **45** — a comment. Verified this session. Proposed:
  ```
  grep -n 'env\.KIN_ASSET_MANIFEST_REF' kin/worker/index.js and grep -n 'env\.KIN_ASSET_MANIFEST[^_]' kin/worker/index.js each hit at least once, and the first REF line number is LOWER than the first inline line number (anchor on 'env.' and exclude the trailing '_' — the plain binding name is a prefix of the REF name, so unanchored patterns overlap and cannot be ordered); and the inline read sits in the else branch of the REF check, not before it
  ```
- **`no SPA source or worker file imports next/* or any bare npm package`** — a React SPA cannot satisfy that; it imports `react`, `react-dom`, and per the plan client-side `zod`. `RUNTIME-CONTRACT.md:123-124` records the opposite as a *decision*. KIN-4's verify already scopes the bare-package grep to the worker only, so the narrow reading was intended — but the prose is what a literal lens reads. Proposed:
  ```
  ; kin/worker/index.js contains zero import statements of any kind (the platform resolves no npm packages at deploy time — docs/kin/RUNTIME-CONTRACT.md); and no SPA source file outside the vite-aliased shims directory imports next/*. Bare npm imports in the SPA are expected and fine — the SPA is a Vite bundle served as a static asset
  ```

**Implementation traps for KIN-M2 (not rubric defects, but they will bite):** `kin-build.mjs` does `rm -rf kin/dist` → `mkdir` → `cp kin/public/*`, which would delete Vite's output and clobber Vite's hashed `index.html`; `vite` is **not** a declared dependency (present only transitively via vitest); `src/components/EquipmentProfile.tsx:11` imports `next/dynamic`, a third shim KIN-M2-T2 does not plan; and KIN-M2's acceptance expects `404` from `/api/does-not-exist` while the shipped worker returns `501 not_implemented`.

---

### 3.4 KIN-5 — BROKEN — a command whose success output can never contain the required string

**Offending clause**

```
node kin/scripts/kin-assets.mjs --check includes /sw.js at root scope
```

**Assumed:** `--check` prints the manifest's path list, so `/sw.js` can be read out of its stdout.

**Actual:** `--check` prints **only a one-line summary** on success and never names a path. Paths appear exclusively inside its failure branch, which calls `process.exit(1)`. **The only invocation of `--check` that can mention `/sw.js` is a failing one** — a passing run and the required output are mutually exclusive. `--print` is the mode that lists paths.

**Evidence (run this session)**

```
$ node kin/scripts/kin-assets.mjs --check
kin-assets --check: OK (1 assets match)               exit=0
$ node kin/scripts/kin-assets.mjs --check | grep -c 'sw\.js'
0                                                      grep exit=1

$ node kin/scripts/kin-assets.mjs --print
/index.html 948c4eedaa0b7620ed8428c5fad5d2a2ab9b38a0ca36ceadc590dcc9d65c1527   exit=0

kin/scripts/kin-assets.mjs — the only place a path is ever printed:
  if (problems.length) { console.error('kin-assets --check FAILED:');
    for (const p of problems) console.error(`  - ${p}`); process.exit(1); }
  console.log(`kin-assets --check: OK (${Object.keys(stored).length} assets match)`);
```

**Proposed replacement**

```
node kin/scripts/kin-assets.mjs --check exits 0, and node kin/scripts/kin-assets.mjs --print | grep -qE '^/sw\.js [0-9a-f]{64}$' (the service worker is emitted at root scope, not under /assets/)
```

**Three further KIN-5 clauses fail against correct work:**

- **`grep -n 'serwist' package.json shows it is not a dependency of the kin:build script path`** — returns **two positive hits** and always will. `serwist` and `@serwist/next` cannot be removed: **DM-7 (met=true, frozen)** requires the Serwist SW to build to `public/sw.js`, and **ES-4 (met=true)** requires a NetworkOnly matcher in `src/app/sw.ts`. A literal lens sees output reading as the opposite of the assertion, forever. Reachability from `kin:build` is also a property of `kin/scripts/*.mjs`, not of `package.json`. Proposed:
  ```
  grep -rn 'serwist' kin/src kin/worker kin/scripts kin/__tests__ returns nothing (exclude kin/dist — gitignored build output), and the kin:build script chain (kin/scripts/kin-build.mjs, kin/scripts/kin-assets.mjs) imports only node: builtins — serwist stays a Next-app-only dependency, which DM-7 still requires in package.json
  ```
  (This also fixes the separate scoping problem in `grep -rn 'serwist' kin/` — `kin/dist` is gitignored build output that will hold minified third-party bundles after KIN-4, so a stray string there would fail a correct port. KIN-9's equivalent check is already correctly scoped.)
- **`grep -n 'PRECACHE|precache' kin/src/sw.ts hits a manifest generated by kin/scripts/kin-assets.mjs`** — `kin-assets.mjs` emits `kin/dist/asset-manifest.json`, whose sole documented consumer is `kin_deploy`'s `asset_manifest` argument, and it **explicitly excludes itself from the asset set**. Since the worker serves assets only by manifest lookup, a runtime `fetch('/asset-manifest.json')` from the SW misses `serveAsset`, falls into the SPA deep-link fallback, and returns **`index.html` with HTTP 200 and `text/html`** — the SW would silently precache the app shell as if it were the manifest. Proposed:
  ```
  grep -nE 'PRECACHE|precache' $SPA_ROOT/sw.ts hits a precache list that kin/scripts/kin-assets.mjs emits INTO kin/dist as a deployed asset (a new --emit-precache mode writing e.g. kin/dist/precache-manifest.js, which the SW imports or embeds) — asset-manifest.json itself is excluded from the asset set by design and is NOT fetchable at runtime
  ```
- **`npx playwright test e2e/kin-offline.spec.ts green against a locally served kin/dist`** — there is exactly one Playwright config and it boots the Vercel Next app (`testDir './e2e'`, `baseURL 'http://localhost:3020'`, `webServer: npx next start -p 3020`). Nothing in the repo serves `kin/dist` statically — no `serve`/`http-server`/`sirv` dependency exists — and `kin/dist` is gitignored while the verify contains no `npm run kin:build` step. Proposed:
  ```
  npm run kin:build && npx playwright test --config=kin/playwright.kin.config.ts e2e/kin-offline.spec.ts green — that config must serve kin/dist as static files (its own webServer + baseURL), NOT reuse the root config's `npx next start -p 3020` Next.js server
  ```

**Also worth adding:** the criterion prose requires "a NetworkOnly strategy for `/api/`" and **no clause in the verify checks it**. This is load-bearing, not stylistic — the worker matches `/api/*` before assets and returns `501 not_implemented` for every unported route, so an SW that cached `/api/` responses would poison the port mid-flight. ES-4 sets the precedent of checking exactly this on the Next `sw.ts`.

---

### 3.5 KIN-6 — BROKEN — the 401 loop contradicts the criterion's own carve-out

**Offending clause**

```
npm test -- kin/__tests__/worker-authz.test.ts green — read it and confirm it loops
over every mapped handler asserting 401 without identity headers
```

**Assumed:** every one of the 20 mapped routes has a handler that must 401 without identity headers — i.e. the public set is empty.

**Actual:** the criterion's **own prose** reserves a public set ("the only unauthenticated handlers are the ones the map documents as public by design"), and **two of the 20 source routes are genuinely unauthenticated**. The two clauses are mutually exclusive: map either route public and the 401 loop fails; make them 401 and the port no longer "re-implements its original authorization gate" — the original gate is *none*.

**Evidence (verified this session)**

```
$ find src/app/api -name route.ts | wc -l        -> 20
$ grep -c 'getServerSession\|requireSession' src/app/api/i18n/status/route.ts
0
$ grep -c 'getServerSession\|requireSession' src/app/api/beta/signup/route.ts
0
```

`src/app/api/i18n/status/route.ts` has no auth of any kind — its doc comment says it must *"fail open: a KV outage must never strip a worker's chosen language."* `src/app/api/beta/signup/route.ts` is rate-limited only.

**Proposed replacement**

```
npm test -- kin/__tests__/worker-authz.test.ts green — read it and confirm that for every map row whose auth column is `required` it asserts 401 with no identity headers, and that for every row whose auth column is `public: <reason>` it asserts the handler does NOT 401 without identity headers (today exactly two: src/app/api/i18n/status/route.ts and src/app/api/beta/signup/route.ts); rows marked `dropped:` are exempt from both
```

This requires a matching prose change, because the map schema the criterion specifies has no auth column for a verifier to read:

```
docs/kin/ROUTE-MAP.md maps every one of the 20 src/app/api/**/route.ts files to a Kin worker handler path plus an auth marker (`admin` | `required` | `public: <reason>`), or to an explicit 'dropped: <reason>' line
```

**Second finding — a counting clause a correct port cannot satisfy:**

```
grep -c 'x-kin-app-role' kin/worker/index.js is >= 1 per admin route in the map
```

The worker reads the header **once**, in `getCaller()` at line 95, and hands every handler a resolved `appRole`. A correct port of all four admin routes adds **zero** new occurrences. Count today is 3, all non-authorization code (identity extraction plus the `/__diag/env` header echo); there are 4 admin-gated source routes, so the clause demands ≥4 while the idiomatic implementation yields 3. Separately `grep -c` counts **lines** (3), not occurrences (4) — the metric is already off by one.

```
$ grep -c 'x-kin-app-role' kin/worker/index.js       -> 3
$ grep -o 'x-kin-app-role' kin/worker/index.js | wc -l -> 4
```

Proposed: delete the grep clause and let the test carry it —

```
and confirm worker-authz.test.ts asserts 403 for a non-admin app role on each of the 4 admin-gated handlers the map marks `admin` (ports of src/app/api/admin/audit, src/app/api/admin/health, src/app/api/beta/decide, src/app/api/safety/review/decide) — do not count occurrences of a header literal, the worker resolves identity once in getCaller() by design
```

**Two vocabulary errors in the same criterion:**

- **`403 for x-kin-app-role=viewer`** — Kin's app-role vocabulary is `manager | admin | member`. There is **no `viewer`** (`kin_add_role` schema enum, confirmed). A unit test can set any string, so the assertion is executable, but it exercises a value the platform will never send and leaves the actual non-admin population (`member`, and `null`) unasserted. `null` is the important one: it is what every real principal has today.
- **`admin routes require x-kin-app-role=admin or platform_admin`** — `platform_admin` is a value of a **different header**, `x-kin-global-role`. Read literally the clause asks for a gate on `x-kin-app-role === 'platform_admin'`, which can never be true.

Combined proposed text:

```
admin routes require `x-kin-app-role: admin` OR `x-kin-global-role: platform_admin` (two different headers — see docs/kin/RUNTIME-CONTRACT.md 'Identity: two orthogonal axes'), asserted with 403 for x-kin-app-role=member AND for a request with no x-kin-app-role at all (the platform's app-role enum is manager|admin|member — there is no `viewer`); the admin gate is asserted at unit level only, since no principal holds an app role on sage-ehs yet (kin_list_roles roles: []), so live exercise of the admin path depends on an admin grant landing first
```

---

### 3.6 KIN-7 — BROKEN — greps a directory the plan of record never creates

**Offending clause**

```
grep -rnE 'process\.env|@anthropic-ai/sdk|@upstash/redis|next-auth|googleapis' kin/worker kin/src returns nothing
```

**Assumed:** the ported SPA source lives at `kin/src`.

**Actual:** `kin/src` does not exist and **no task in `goals.json` ever creates it.** The SPA tree is `kin/spa` in all ten task references (KIN-M0-T5, KIN-M2-T1/T2/T3/T5/T8, KIN-M3-T1, KIN-M5-T1), and KIN-10's own iteration-23 amendment greps `kin/spa/routes/`. The only six occurrences of `kin/src` in the whole repo are frozen verify strings.

Both outcomes are wrong: a strict verifier sees the missing-path error and reads the clause as a FAIL; a lenient one reads empty stdout as "returns nothing" and passes it **vacuously**. Either way the clause never inspects the SPA tree.

**Evidence**

```
$ ls kin/
__tests__  app.json  dist  evidence  kin.toml  migrations  public  scripts  worker
$ ls kin/src                                  -> No such file or directory

$ grep -rnE '<pattern>' kin/worker kin/src
ugrep: warning: kin/src: No such file or directory       exit=2, nothing on stdout

$ grep -c 'kin/spa' docs/roadmap/goals.json   -> 10   (all in task descriptions)
$ grep -c 'kin/src' docs/roadmap/goals.json   -> 6    (all in frozen verify strings)
```

**Proposed replacement**

```
test -d kin/spa && grep -rnE 'process\.env|@anthropic-ai/sdk|@upstash/redis|next-auth|googleapis' kin/worker kin/spa returns nothing (exit 1 with no output; exit 2 / 'No such file or directory' is a FAIL, not a pass); and after npm run kin:build, grep -rn 'process\.env' kin/dist/assets/*.js returns nothing — the SPA compiles src/components through the @/ alias, so a kin/-scoped source grep alone does not prove no leakage
```

The built-artifact half matters: the port deliberately does not move the components, and **at least 8 of them read `process.env.NEXT_PUBLIC_*`** (`SageTriage.tsx`, `IncidentReportForm.tsx`, `PreTaskPlanForm.tsx`, `SageAssist.tsx`, `ReviewStatusSection.tsx`, `JhaForm.tsx`, `ConfinedSpaceForm.tsx`, `AuthGate.tsx`). The grep can be perfectly clean over `kin/worker` + `kin/spa` while the bundle still ships `process.env` references — the leakage the criterion is *named after* goes unchecked.

**Ordering inversion, cheap to fix now:**

```
kin_list_schedules({slug:'sage-ehs'}) shows the mirror schedule registered with a recorded last-run status
```

`kin_list_schedules` **defaults to `env:'live'`**, and `sage-ehs` has no live deployment (`status: "no_live_yet"`, `live: null`, confirmed live this session). KIN-7 is owned by KIN-M4; promotion is KIN-M5/KIN-10. So the clause **cannot pass during its own milestone**. Proposed:

```
kin_list_schedules({slug:'sage-ehs', env:'preview'}) lists the mirror schedule registered by KIN-M4-T3 with a non-null last-run status (force one firing with kin_run_schedule_now if the cadence has not ticked); the payload is an object {"schedules":[...]}, so any jq must start at .schedules[] — never .[]. Re-check on env:'live' only after KIN-M5 promotes.
```

**Three more clauses that fail against correct or documented work:**

- **`grep -n 'AbortSignal.timeout|AbortController' kin/worker hits every outbound call`** — grep prints matching lines; nothing correlates them with the set of `fetch()` call sites, so **one** hit satisfies the clause no matter how many unprotected calls exist. Today the ratio is 1:1 by luck (one fetch, one signal); after KIN-M4 the worker gains 12+ outbound calls. `goals.json`'s own `verificationRule` anticipates exactly this. Proposed:
  ```
  test "$(grep -c 'fetch(' kin/worker/index.js)" = "$(grep -c 'AbortSignal.timeout' kin/worker/index.js)" (every outbound call site carries its own timeout), and npm test -- kin/__tests__/outbound-timeouts.test.ts asserts each integration helper passes an AbortSignal by driving it with a never-resolving fetch stub
  ```
- **`an unset secret returns a structured 503 JSON body, and an upstream failure returns 502 — all covered by tests`** — contradicts three recorded decisions. `NOTIFICATIONS.md` states a missing `SLACK_WEBHOOK_URL` yields `{notified:false, reason:'not-configured'}` with a **2xx**; the shipped worker does exactly that (`index.js:326`); **KIN-3 (met=true) tests it as a hard requirement ("NOT a 500")**; and the mirror is a scheduled task with no HTTP response at all. A literal implementation would **regress an already-verified criterion**. The verify checks 503/502 nowhere. Proposed:
  ```
  an unset secret on a REQUEST-PATH integration (the Anthropic AI routes, the Notion sync route) returns a structured 503 JSON body and an upstream failure returns 502; the Slack notification and the scheduled Sheets mirror are explicitly exempt — an unset SLACK_WEBHOOK_URL still returns 2xx with notified:false (KIN-3), and an unset GOOGLE_SA_* leaves rows unsynced and logs
  ```
- **`grep -n 'crypto.subtle.importKey' kin/worker shows the RS256 JWT is signed with Web Crypto`** — `NOTIFICATIONS.md` explicitly sanctions a second implementation with **no JWT and no importKey** (an Apps Script web app with a shared token) "if the service-account route stalls on Google Cloud access." If the owner takes that documented path this clause can never match. See §5 for the open question about whether `importKey` was ever measured.

**Task-vs-contract collision worth settling before KIN-M4 starts:** KIN-M4-T1/T2/T3 plan `kin/worker/handlers/ai.ts`, `handlers/review.ts`, `handlers/notify.ts`, `sheets.ts` — `.ts` sources that cannot ship without the bundler `RUNTIME-CONTRACT.md` says does not exist ("the Worker is authored as a single self-contained ES module with zero import statements"; "No bundler is in the dependency tree"). A directory-wide grep over `kin/worker` is therefore satisfied by files that never deploy.

---

### 3.7 KIN-8 — BROKEN — four clauses target a tree the plan deliberately never creates

This is the worst-affected criterion: **four blocker findings**, and — critically — **renaming `kin/src` to `kin/spa` fixes none of them**, because the plan says the ported files do not move at all.

**Offending clause 1**

```
grep -n "es" kin/src/i18n-core.ts shows the es bundle bound to an empty object literal
(not an import of es.json)
```

**Actual:** no `kin/src` tree, and KIN-M5-T1 says *"bundle `src/lib/i18n-core.ts`, `src/lib/i18n.tsx`, the generated `src/lib/i18n-keys.d.ts` … as static imports"* — consumed **in place** through the `@/ -> src/` alias. Second, unmodifiable-in-place problem: `src/lib/i18n-core.ts` is **shared with the still-live Next app**, and `src/lib/__tests__/i18n.test.ts:106-110` asserts real Spanish output from it (`expect(t('sync.recordsSynced', {count:1})).toBe('1 registro sincronizado')`), so binding `es={}` there turns the full `npm test` run red — which **KIN-9 requires green**. Only two mechanisms work: a Kin-local fork, or a build-time alias. The clause admits only the first, at a path the plan never produces.

Proposed replacement:

```
the Kin SPA build resolves the `es` message bundle to an empty object — either a Kin-local i18n core (grep it for `es: {}` / `const es = {}` and confirm no `from '@/messages/es.json'`) or an explicit Vite alias in the Kin build config mapping `@/messages/es.json` to an empty-object stub; show the resolved binding, and confirm the shared src/lib/i18n-core.ts is left untouched so the Next-side i18n tests stay green
```

**Offending clause 2**

```
grep -c "undefined, '" across kin/src/components returns >0 (defaultEn pins survived the port)
```

**Actual:** `kin/src/components` does not exist and the plan says it never will — KIN-M0-T5, *"so components port without moving"*; KIN-M2-T3, *"Components themselves are not edited."* The pins live at `src/components` (**814 occurrences**, verified this session). Two secondary defects even if the path were right: `grep -c` prints a **per-file** count including `TabNav.tsx:0` lines, so ">0" is undecidable; and a threshold of `>0` is satisfied by **one** surviving call site when the prose says "all" and `MIGRATION-ASSESSMENT.md` sizes them at 816 — the prose and the check are two orders of magnitude apart.

Proposed replacement:

```
grep -ro "undefined, '" src/components | wc -l returns at least 800 (baseline 814 at port time; a drop is a fail) AND the Kin SPA build actually consumes those files (the Vite alias/entry resolves @/components to src/components), so the defaultEn pins ship in the Kin bundle rather than merely existing on disk
```

**Offending clause 3**

```
and that the en catalog leaf-key set still matches the generated i18n-keys.d.ts
```

**Actual:** they are **deliberately unequal**, and a committed test pins the inequality. The generator emits plural **parents** and stops descending into plural groups, so the 58 `.one`/`.other` leaves are absent from the union while their 29 parents are present but are not leaves.

```
$ node -e '<walk en.json leaves vs quoted members of i18n-keys.d.ts>'
en leaves 1096   dts members 1067

src/lib/__tests__/i18n-catalog.test.ts:174
  it('plural parents (not leaf variants) are the typed keys', () => {
    expect(actual).toContain("| 'sync.recordsSynced'")
    expect(actual).not.toContain("| 'sync.recordsSynced.one'")
```

A test written to this clause **fails on the correct catalog** — and the failure is caused by the plural keys the same sentence demands be covered ("INCLUDING plural keys"). The clause contradicts itself.

Proposed replacement:

```
the en catalog's GENERATED key set — leaves plus plural parents, descending no further into a plural group, i.e. the exact algorithm in scripts/gen-i18n-keys.mjs mirrored by src/lib/__tests__/i18n-catalog.test.ts — still matches src/lib/i18n-keys.d.ts byte for byte
```

**Offending clause 4**

```
npx playwright test e2e/kin-en-pin.spec.ts green against the preview URL
(seed sage-locale-v2='es' in an init script and assert English copy still renders)
```

**Actual:** a headless browser cannot load the preview — the exact failure mode already recorded in `RUNTIME-CONTRACT.md`. The app is private, every per-app hostname sits behind the Kin auth Worker, bearer ingress is **off** (`{"paths":[],"enabled":false}`), and the only bypass is `kin_invoke_mcp_tool`, which dispatches server-side JSON-RPC and returns tool JSON — not rendered DOM. There is no committed `storageState`, no `mkin.app` login helper, and no e2e spec that has ever targeted an `mkin.app` origin. The invocation as written would not even aim at the preview: `playwright.config.ts` pins `baseURL: 'http://localhost:3020'` and boots `npx next start`, and unlike every `milestoneAcceptance` line in the same file this clause passes **no base-URL env var**.

```
$ curl -sS -o /dev/null -w '%{http_code} -> %{redirect_url}\n' https://preview-sage-ehs.mkin.app/
302 -> https://auth.mkin.app/login?return_to=https%3A%2F%2Fpreview-sage-ehs.mkin.app%2F
```

Proposed replacement (mirrors KIN-5's working shape):

```
npx playwright test e2e/kin-en-pin.spec.ts green against a locally served kin/dist (same harness as KIN-5): serve the built SPA on localhost, seed sage-locale-v2='es' via page.addInitScript, and assert the canonical English copy still renders and html[lang] stays 'en'. Preview-URL coverage, if wanted, is a separate manually-authenticated run recorded as evidence, not an automated gate — the preview hostname 302s to auth.mkin.app for any unauthenticated browser and bearer ingress is disabled.
```

**A fifth clause is a guaranteed pass that is blind to the outcome it exists to prevent:**

```
test ! -f kin/src/messages/es.json && test ! -d kin/src/messages/data
```

Both pass **right now** on an empty `kin` tree and will keep passing forever, because the Spanish content stays at `src/messages/es.json` (62 KB) and `src/messages/data/*.es.json` and is pulled in through the alias. Worse, **KIN-M5-T1 says to ship it**: *"bundle … `src/messages/en.json`, `src/messages/es.json` and `src/messages/data/*.es.json` as static imports."* KIN-M5-T3 runs `e2e/es-leakage.spec.ts` against the Kin preview *expecting Spanish to render*; KIN-M2-T5 keeps UserMenu's locale toggle slot. **None of these were updated when commit `a79ccb0` scoped the port to English-only.** KIN-8 and KIN-M5-T1 cannot both be satisfied.

Proposed replacement:

```
the built SPA carries no Spanish payload — grep -rilE 'inspecci|registro sincronizado|Español' kin/dist/assets returns nothing, and no Kin build input imports es.json (grep -rn "messages/es.json\|\.es\.json" over the Kin build config, the SPA tree and kin/worker returns nothing except an alias mapping it to an empty stub)
```

**Cosmetic:** `grep -n "es" <file>` matches "m**es**sages", "r**es**olve", "typ**es**", "Rul**es**" — roughly a third of `i18n-core.ts`. It produces a wall of output with nothing anchored to fail on, which is largely how the real defect hid behind a plausible-looking command. Anchor it: `grep -nE "\bes\s*:\s*\{\s*\}|const es\s*=\s*\{\s*\}"`.

---

### 3.8 KIN-9 — AT_RISK — a guard grep that errors instead of failing, over a tree it cannot see

**Offending clause**

```
grep -rnE "from '(next|next-auth|@serwist)" kin/src kin/worker kin/__tests__ returns nothing
```

**Actual:** `kin/src` does not exist, so grep aborts on the missing operand with **exit 2** and a stderr warning — "returns nothing" is true only if the adjudicator reads stdout and ignores the exit code. This is the same shape as the KIN-10 defect. And if the SPA lands at `kin/spa`, this clause errors forever **while leaving the entire client source unscanned**, even though the criterion prose claims "no Kin source imports next, next-auth, or @serwist."

```
$ grep -rnE "from '(next|next-auth|@serwist)" kin/src kin/worker kin/__tests__
ugrep: warning: kin/src: No such file or directory       EXIT=2
$ grep -rnE "from '(next|next-auth|@serwist)" kin/worker kin/__tests__
EXIT=1                                                    (the intended shape)
```

Two further gaps in the same clause: the path set **omits `kin/scripts`**, which exists and is Kin source (three `.mjs` build scripts); and the pattern only catches single-quoted `from '`, missing `from "next"`, `require('next-auth')`, `await import('next/navigation')`, and `vi.mock('next-auth')` — the last being exactly how a hastily ported route test stays coupled to next-auth *inside `kin/__tests__`* while passing this check.

**Proposed replacement**

```
grep -rnE "(from|require\(|import\(|vi\.mock\()[[:space:]]*['\"](next$|next/|next'|next\"|next-auth|@serwist|serwist)" over every Kin source root that exists (the SPA tree, plus kin/worker, kin/scripts, kin/__tests__ — excluding kin/dist) prints nothing AND exits 1 (not 2); at least one SPA source root must exist, and the clause fails if none does
```

**Three more findings in KIN-9:**

- **`comm -23 <(ls src/lib/__tests__ | sort) <(grep -oE '...\.test\.tsx?' ...)`** — the two sides are filtered **asymmetrically**: column 1 is raw `ls`, column 2 is filtered to `*.test.ts(x)` tokens. Any entry that is not a test file — a `__snapshots__/` dir, a shared `fixtures.ts`, a `setup.ts`, a `.spec.ts` — appears in column 1 and can **never** appear in column 2 no matter how complete the doc is. True today (81/81 match, verified), unsatisfiable by construction the day any such file lands. Proposed:
  ```
  comm -23 <(ls src/lib/__tests__ | grep -E '\.test\.tsx?$' | sort) <(grep -oE '[A-Za-z0-9._-]+\.test\.tsx?' docs/kin/TEST-CARRYOVER.md | sort -u) prints nothing (no unlisted suite); separately, ls src/lib/__tests__ | grep -vE '\.test\.tsx?$' must print nothing or each such entry must be named in the doc's 'not a suite' section
  ```
- **"81 at the time the rubric was written"** — `src/lib/__tests__` is an actively-growing artifact of a **different dimension**. The Spanish track added 4 suites in ES-M1 and 2 more in ES-M3, and ES-M4 is mid-flight. The count is exactly 81 today (verified), but any suite landing after the doc is authored makes the `comm` clause fail on a later `/goal review` re-score **through no Kin change** — KIN-9 would flip back to `met=false` because another dimension shipped a test. Proposed: pin the doc to the sha that last touched the directory, and treat an unlisted later suite as doc staleness to be repaired by regenerating the doc, not as evidence the port is incomplete.
- **The baseline is self-chosen.** `docs/kin/TEST-CARRYOVER.md` does not exist and is authored by the very milestone this criterion grades, so the implementer picks its own yardstick — any baseline at or below the run's own totals passes, and the check cannot detect the regression it exists to detect. The pre-port numbers are measurable **right now**: `npm test` → **83 files / 893 tests**, exit 0; `npx tsc --noEmit` → exit 0. Proposed: `npm test (full run) exits 0 and reports >= 83 test files and >= 893 tests — the pre-port totals measured on claude/construction-safety-audits-HC6MA on 2026-08-05 — and docs/kin/TEST-CARRYOVER.md must state those same two numbers as its recorded baseline`.

Also note: the criterion prose requires that every `ported`/`rewritten` entry "**runs**" and every `obsolete` entry names a next-auth/Next-specific suite. Neither has a counterpart in the verify — it only `ls`es targets (present on disk ≠ in the vitest run) and never inspects obsolete entries at all. That is the escape hatch that lets the port drop coverage while turning the criterion green. **And no ROADMAP task under KIN-M1..KIN-M5 produces `docs/kin/TEST-CARRYOVER.md` at all** — the deliverable this criterion is built around has no milestone that creates it.

---

### 3.9 KIN-10 — BROKEN — the same object-wrapping jq bug the same commit just amended out

> **Revision warning.** The rubric changed mid-audit. Commit `67af49f` ("drop KIN-10's two-owner gate for an in-app admin access page") replaced the old text while the audit was running. Everything below is against the **post-`67af49f`** text, which I re-read from `goals.json` at report time and confirmed matches. Confirm you are adjudicating the same revision.

**Offending clause**

```
jq -e '[.[]|select(.env=="live")]|length >= 1' kin/evidence/deployments.json
```

**Assumed:** the evidence file is a JSON **array** of flat deployment records each carrying `.env`.

**Actual:** `kin_list_deployments` returns an **object** with a single `deployments` key wrapping the array. `.[]` therefore walks the object's values and hands jq the array itself, which has no `.env`. **This is the identical failure mode as the roles clause `67af49f` just removed — the amendment fixed one jq and left its twin untouched.**

**Evidence (live payload + literal clause, this session)**

```
$ mcp__kin__kin_list_deployments({slug:"sage-ehs"})
{"deployments":[{"id":"004a183a-...","version":3,"env":"preview","status":"active",...},
                {...v2...},{...v1...}]}

$ jq -e '[.[]|select(.env=="live")]|length >= 1' dep.json
jq: error (at dep.json:0): Cannot index array with string "env"      exit=5

$ jq -e '[(if type=="array" then . else .deployments end)[] | select(.env=="live")] | length >= 1' dep.json
true                                                                  exit=0
   ... same expression, preview-only fixture  -> false, exit=1  (a clean false, not an error)
   ... same expression, bare-array fixture    -> true,  exit=0
```

**Proposed replacement**

```
jq -e '[(if type=="array" then . else .deployments end)[] | select(.env=="live")] | length >= 1' kin/evidence/deployments.json
```

**Second finding — two required docs that no task produces:**

The criterion demands `docs/kin/DEPLOY-LOG.md` and `docs/kin/RUNBOOK.md`. Scanning every `tasks[].description` and every `milestoneAcceptance` in `goals.json`: **`DEPLOY-LOG.md` is mentioned by nothing; `RUNBOOK.md` is mentioned by nothing.** KIN-M5 instead produces two differently-named docs covering exactly this content — KIN-M5-T5 writes `docs/kin/CUTOVER.md` ("Record every version number, ai_summary and observed behavior"), KIN-M5-T7 writes `docs/kin/OPERATIONS.md` ("the cutover runbook … the rollback ladder"). KIN-M5's own acceptance names `CUTOVER.md`. The criterion demands two filenames the plan never produces while the plan produces two the criterion never reads.

Proposed:

```
docs/kin/CUTOVER.md records the promoted live version with its ai_summary, and docs/kin/OPERATIONS.md documents the rollback path
```
```
grep -nE 'kin_rollback|restore' docs/kin/OPERATIONS.md must cite a real live version number that appears in kin/evidence/deployments.json, and the doc must reference kin/migrations/*.down.sql for schema reversal
```
(Alternative, if the `DEPLOY-LOG.md`/`RUNBOOK.md` names are wanted: add explicit produce-this-file obligations to KIN-M5-T5 and KIN-M5-T7 in the same amendment.)

**Third finding — nothing can ever write the first `app_roles` row:**

The app-role axis is empty and the platform leaves the creator with no app role — `x-kin-app-role` measured `null` for `mark.starr@mytra.ai`, and `kin_list_roles` returns `roles: []` (re-confirmed live this session). KIN-M1-T8 resolves the effective role by reading `app_roles` first and falling back to `x-kin-app-role`; the table is empty and the fallback is null, so **every caller resolves to non-admin**. Sub-clause (a) forbids the obvious escape hatch (an `isManager`-only caller must get 403) and (d) forbids self-grant. The KIN-M1-T8 migration spec defines `app_roles` with **no seed row**, and a full-text search of `goals.json` for seed/bootstrap language near `admin` or `app_roles` returns zero hits. `env.KIN` exposes only `getSecret` and `scheduleTask`, so the Worker cannot mint the first admin from the platform side either.

**Compliance hazard:** `admin-access.test.ts` can fabricate a seeded admin row, so the verify goes **green** while the deployed admin page is permanently unreachable by every human. Proposed:

```
and (e) the app_roles migration seeds exactly one bootstrap admin (mark.starr@mytra.ai) with granted_by='migration', so the first admin exists without a self-grant; the test must assert the seeded row is present in the migrated schema, not only in a fixture
```
(Add the same seed requirement to KIN-M1-T8's migration spec in the same amendment.)

**Fourth finding — a clause that is already true with nothing promoted:**

```
curl ... "$(jq -r .liveUrl kin/app.json)/" returns 200/302/401, not 000 or 404
```

`live=302 -> https://auth.mkin.app/login?...` **today**, while `kin_get_health` reports `status: "no_live_yet"`, `live: null` and `kin_list_deployments({env:"live"})` returns `{"deployments":[]}`. Every hostname 302s to login whether or not a bundle is promoted, so the clause cannot distinguish a promoted app from an unpromoted one. It is honest about what it says, but a scorer may read the green as proof of liveness. Proposed: append `— an edge/DNS sanity check only; a 302 to auth.mkin.app is expected for every hostname whether or not a bundle is promoted, so promotion itself is proved solely by kin_get_health reporting a non-null .live.version`.

**Also note:** `67af49f` changed the curl format string from `\\n` to `\n` — a **real newline is now embedded in the JSON verify string**. Harmless for curl, but a verifier that splits clauses on newlines will mis-chunk it.

**And a caveat on the down-path that was deliberately not filed as a finding:** no MCP tool executes a down migration. `kin_run_migration` applies pending migrations **forward only**, and `kin_rollback` restores the code bundle from the archive, **not the schema**. The verify only requires the doc to *reference* the `.down.sql` files, which is satisfiable — but a RUNBOOK implying an executable down-path would be inaccurate.

---

### 3.10 KIN-1 — CLEAN, with five cosmetic notes

All six clauses were executed against live state and all six pass. `met: true` is not in question, and the original defect is confirmed gone (`9c1e786` replaced the `kin_get_app` "must show a database" clause with a `kin_get_schema` clause). The five notes, in one line each, are all "the prose demands more than the verify checks" — none can produce a false BLOCK:

1. The prose names **seven** env keys; the jq chain asserts **six**. `KIN_APP_SLUG` is never checked, though the criterion's own stored evidence leans on it. It is present live at index 3, so adding it costs nothing: append `and index("KIN_APP_SLUG")`.
2. `jq -e 'has("manifest_ref")'` is true for an explicit `null` value. Not hypothetical — the probe writes `manifest_ref: env.KIN_ASSET_MANIFEST_REF ?? null` (`kin/worker/index.js:574`). Use `jq -e '.manifest_ref != null'`.
3. `grep -n "__diag/env" ... and confirm the enclosing block checks request.headers.get('x-kin-is-manager')` is a **shell syntax error**, not a failing command — unquoted parens abort bash with exit 2, indistinguishable from a genuinely missing manager gate. The underlying fact is true (`index.js:785-787`). Low blast radius because `HARNESS.md` describes verification as agent-mediated.
4. *"live result overrides the committed JSON on any disagreement"* names only `kin/app.json` and `kin/evidence/diag-env.json`, neither of which contains table names — so `kin_get_schema` can never disagree with either. The file it *can* contradict, `kin/evidence/schema.json`, is never named in KIN-1.
5. *"survives in the shipped bundle"* is measured by grepping the **repo** copy. Substance holds (the deployed preview-v3 source contains the identical gated block), but repo and platform copies do not report identical digests (`ce1683cc…` / 36086 bytes vs `7d586264…` / 36062 bytes). **The auditor could not attribute the delta** — every marker probed is present in both — so platform-side normalization is at least as likely as real drift. Flagged only so a human decides whether "shipped" should be measured live.

**Adjacent staleness, not a KIN-1 clause:** `RUNTIME-CONTRACT.md` still says "Preview is on version 2"; live `kin_get_health` now reports version **3**. `kin/evidence/diag-env.json` records `_recorded.deploymentVersion 1`. Neither is referenced by any KIN-1 clause, so neither can block it — but if a later criterion pins a version number, re-measure first.

---

## 4. Pattern

Every defect in this audit is one of six shapes. All six are cheap to check at authoring time and expensive to discover at milestone time.

**1. A tool payload assumed to be a bare array when it is an object wrapping one.** This is the family that produced the two known defects and two more found here. `kin_get_schema` → `{"schema":[…]}`; `kin_list_deployments` → `{"deployments":[…]}`; `kin_list_roles` → `{"slug":…,"managers":[…],"roles":[]}`; `kin_list_schedules` → `{"schedules":[…]}`. A `jq '.[]'` against any of them walks the object's **values**, hits a string or the wrong array, and **dies with exit 5** — it does not return false. Two consequences: a verifier cannot distinguish "the criterion is unmet" from "the criterion is unrunnable," and if the expression is piped (`| sort`, `| wc -l`) the pipeline **exits 0 with empty output**, so the failure presents as a wrong answer rather than an error. *Check: run every jq against the literal tool output, not against a hand-written fixture, and confirm the false case returns a clean `false`/exit 1 rather than an error.*

**2. A path the rubric names that the plan of record never creates.** `kin/src` appears in six frozen verify strings and **zero** tasks; `kin/spa` appears in ten tasks and one verify string. `docs/kin/DEPLOY-LOG.md` and `docs/kin/RUNBOOK.md` appear in KIN-10 and in **no** task; KIN-M5 produces `CUTOVER.md` and `OPERATIONS.md`, which **no** criterion reads. `docs/kin/TEST-CARRYOVER.md` is required by KIN-9 and produced by nothing. Missing paths do not fail cleanly — `grep`/`ls` exit **2**, which reads as "returned nothing" on stdout while being a hard error. *Check: for every path a criterion names, grep the milestone tasks for the same literal string. If no task produces it, the criterion is unsatisfiable or the plan is incomplete — decide which before freezing.*

**3. A criterion that contradicts the milestone designed to satisfy it.** KIN-4 forbids `next/*` specifiers that KIN-M2-T2 exists to preserve. KIN-2 demands a table per record shape where KIN-M1-T2 designs one union table. KIN-8 forbids Spanish payloads that KIN-M5-T1 says to bundle. KIN-4 demands 404 on unknown paths where KIN-M2-T6 requires a 200 shell. KIN-7's 503-on-unset-secret would regress the already-verified KIN-3, which requires 2xx. In each case *both documents are internally coherent and mutually exclusive*, so no amount of good work resolves it. *Check: read the criterion and its owning milestone's tasks side by side, and ask "does the plan, executed exactly, make this clause true?"*

**4. A command that cannot produce the output the clause demands.** `kin-assets.mjs --check` prints a path only on **failure**, so its success output can never "include `/sw.js`." `grep -c 'x-kin-app-role'` can never reach 4 when the worker reads the header once by design. `grep 'IRREVERSIBLE'` can never match a 0-byte file. `grep KIN_ASSET_MANIFEST_REF` vs `grep KIN_ASSET_MANIFEST` can never yield disjoint, orderable hit sets because one pattern is a prefix of the other. *Check: run the command against the current tree and read its actual stdout before writing the assertion — not what you expect it to print.*

**5. A check that passes vacuously and can never fail.** `grep <pattern> <directory>` without `-r` errors under POSIX grep, so "returns nothing" is satisfied without reading a single file — this disarms **two** guards protecting runtime-fatal invariants (KIN-3's detached-RPC check, KIN-7's env-leakage check). `test ! -f kin/src/messages/es.json` is true forever on a tree that will never contain it. `kin-assets --check` re-hashes bytes the immediately preceding `kin:build` just wrote. `grep -c "undefined, '" ... >0` is satisfied by 1 of 814. Note this class is **environment-dependent**: `grep` on the audited machine is a ugrep shim that *does* recurse into directory operands, so several of these pass here and would fail (or pass vacuously) in CI. *Check: prove the negative — construct the violating input and confirm the check fails on it. A check never seen to fail has never been tested.*

**6. A live-platform fact assumed rather than measured.** Every per-app hostname 302s to `auth.mkin.app`; bearer ingress is off; a browser cannot reach the app. The app-role enum is `manager|admin|member` — there is no `owner` (which killed the original KIN-10) and no `viewer` (which KIN-6 still asserts). `platform_admin` lives on a *different header* than `x-kin-app-role`. `kin_list_schedules` defaults to `env:'live'` on an app with no live deployment. `x-kin-app-role` is `null` for the account that created the app, so no principal can satisfy an admin gate. `node:sqlite` does not exist on the Node CI pins. *Check: for every platform value a criterion names — a role string, a header, a default parameter, an env key — call the tool or read the header dump and confirm the value exists. `RUNTIME-CONTRACT.md` exists precisely to make this cheap; the criteria that predate it are the ones that got it wrong.*

**The meta-pattern:** all ten criteria were authored **before anything was deployed**. Nine of them contain at least one assumption that a single live call would have refuted. The one criterion with no such defect — KIN-1 — is the one that was *written to be a measurement* and then amended once against what it measured. The cheapest structural fix is a rule: **no criterion referencing a platform payload, a platform vocabulary, or a path that does not yet exist may be frozen until each of those has been read once from the live system and the reading recorded in `docs/kin/`.**

---

## 5. What this audit could not establish

Recorded rather than smoothed over.

- **`crypto.subtle.importKey` was never measured.** The live probe recorded only `has_crypto_subtle: true`, and `RUNTIME-CONTRACT.md` names `digest` specifically. Whether `importKey('pkcs8', RSASSA-PKCS1-v1_5)` works on this runtime is an **assumption inside a document whose premise is "measured, not assumed."** KIN-7 depends on it. Probe before KIN-M4-T3 relies on it.
- **Whether a schedule can be registered on an env with no live deployment is untested.** The KIN-7 auditor fetched the `kin_schedule_task` / `kin_run_schedule_now` schemas but deliberately did not invoke them (read-only discipline). `kin_list_schedules` returns `{"schedules":[]}` on **both** `live` and `preview` today.
- **The repo/platform digest delta on `kin/worker/index.js` is unexplained.** 36086 bytes / `ce1683cc…` locally vs 36062 / `7d586264…` via `kin_read_file`. Every content marker probed is present in both copies, so platform-side normalization is at least as likely as real drift — but it was not proven either way.
- **Three auditors reported `docs/roadmap/goals.json.log` missing** and fell back to other sources. That file does not exist; the decision log is the **`.log` array inside `goals.json`**. Their cross-checks against recorded decisions were therefore partially done against `ROADMAP.md` / `RUNTIME-CONTRACT.md` / `MIGRATION-ASSESSMENT.md` instead. Nothing in this report depends on a log entry that could not be located, but a re-audit should read `jq '.log' docs/roadmap/goals.json` directly.
- **Environment mismatch.** The audit brief named the repo as `/home/user/equipment-qr-hub`, which does not exist on this host. All work was done at `/Users/markstarr/equipment-qr-hub`, branch `claude/construction-safety-audits-HC6MA`, git status clean.
- **Tooling caveat that affects several verdicts.** `grep` on this machine resolves to a **ugrep shim** (`ugrep 7.5.0`) that recurses into directory operands; `jq` is `jq-1.7.1-apple`; `node` is `v25.8.2`. Clauses graded "passes here" may behave differently under GNU grep or the Node 20 that `ci.yml` pins — that difference is itself two of the findings (KIN-3, KIN-7).
- **KIN-6's blocker rests on one reading.** A lenient adjudicator who reads "every mapped handler" as "every mapped *authenticated* handler" would downgrade KIN-6 to AT_RISK. The `grep -c 'x-kin-app-role'` finding would still stand as a clause that fails a correct implementation.
- **KIN-10 was audited against a rubric that changed mid-session.** See the warning in §3.9.
