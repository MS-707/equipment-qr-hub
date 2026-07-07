# Dependency Audit — Risk Acceptance Register

Source: `npm audit --omit=dev` (production dependency tree only).
Audit date: **2026-07-07** · Review-by: **2026-10-01** (or immediately upon the
Next 15/16 upgrade, whichever is first). `package-lock.json` is git-tracked;
`npm audit fix` (non-breaking) is applied — the register below covers only
advisories whose fix requires a **breaking major upgrade** (`next@16`,
`next-auth@5`).

**Why accepted rather than force-upgraded:** every remaining advisory resolves
only via `npm audit fix --force` (Next 14 → 16, next-auth 4 → major), a
breaking change to the framework mid-beta. The platform context removes or
blunts most attack surface: the app deploys exclusively on **Vercel-managed
hosting** (platform WAF, request normalization, managed image optimization —
no self-hosted server), uses the **App Router only** (no Pages Router, no
i18n routing config, no custom rewrites, no WebSocket upgrades, no CSP
nonces), and every state-changing API route sits behind auth + KV-backed rate
limiting.

## High severity (accepted 2026-07-07)

| GHSA | Advisory | Why accepted here |
|---|---|---|
| GHSA-36qx-fr4f-26g5 | Middleware/proxy bypass in **Pages Router i18n** apps | App Router only; no `i18n` key in next.config.mjs; no middleware.ts at all |
| GHSA-8h8q-6873-q5fj | DoS with Server Components | Vercel platform request limits + per-route KV rate limiting; no self-hosted node server to exhaust |
| GHSA-q4gf-8mx6-v5v3 | DoS with Server Components (variant) | Same mitigations as above |
| GHSA-h25m-26qc-wcjf | HTTP request deserialization DoS (insecure RSC) | Vercel edge normalizes requests; all API bodies zod-validated with size caps before use |
| GHSA-c4j6-fc7j-m34r | SSRF via WebSocket upgrades | The app performs no WebSocket upgrades anywhere |

## Moderate / low (accepted 2026-07-07)

| GHSA | Package | Why accepted here |
|---|---|---|
| GHSA-3x4c-7xq6-9pq8 | next | Unbounded image-cache disk growth — Vercel-managed optimizer, no self-hosted disk |
| GHSA-9g9p-9gw9-jx7f | next | Image Optimizer `remotePatterns` DoS — no `remotePatterns` configured |
| GHSA-h64f-5h5j-jqjh | next | Image Optimization API DoS — managed by Vercel, not self-hosted |
| GHSA-ffhc-5mcf-pf4q | next | XSS via CSP nonces — the CSP uses no nonces |
| GHSA-gx5p-jg67-6x7h | next | XSS in `beforeInteractive` scripts — no untrusted input reaches any script tag |
| GHSA-ggv3-7p47-pfv8 | next | Request smuggling in rewrites — no rewrites configured |
| GHSA-wfc6-r584-vfw7 | next | RSC response cache poisoning — Vercel CDN cache keying; app pages are auth-gated |
| GHSA-vfv6-92ff-j949 | next | RSC cache-busting collisions (low) — same as above |
| GHSA-3g8h-86w9-wvmq | next | Middleware redirect cache poisoning (low) — no middleware.ts |
| GHSA-qx2v-qp2m-jg93 | postcss (via next) | Build-time stringifier XSS — processes only our own CSS at build |
| GHSA-w5hq-g745-h8pq | uuid (via next-auth) | v3/v5/v6 `buf` bounds — next-auth does not call uuid with a caller-provided buffer |

(next-auth ≤4.24.14 itself appears in the audit solely for depending on the
uuid version above.)

## Upgrade plan

1. **Next 15 → 16** on the post-beta hardening pass (target: before the
   review-by date). Clears every `next`/`postcss` row.
2. **next-auth v5 (Auth.js)** in the same pass — also unlocks the SSO
   walkthrough in [SSO.md](./SSO.md) on current APIs. Clears `uuid`/`next-auth`.
3. Re-run `npm audit --omit=dev` after each upgrade and prune this register;
   CI runs the audit advisory-free path automatically once rows empty.

## How to re-audit

```bash
npm audit --omit=dev            # production tree, the source of this register
npm audit fix                   # apply any new non-breaking fixes
```

Every high/critical GHSA the command prints MUST have a dated row here or a
fix in the same commit (EN-3, enforced by the roadmap's adversarial verifier).
