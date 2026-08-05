# EHS notification + audit design (Kin)

**Decision (2026-08-05, owner):** drop Resend. Notify EHS via **Slack**, and
mirror every inspection into a **document-controlled Google Sheet** for
auditability. Rationale: Resend is not a tool Mytra otherwise uses, so it is an
unnecessary third-party surface for a safety-critical path. Slack and Google
Workspace are already in the stack, already governed, already revocable by IT.

---

## The architectural point that matters

The stated worry was "auditable in the event Slack goes down." The fix is not a
second notification channel — it is **decoupling the audit trail from the
notification path entirely**.

```
POST /api/inspections
  └─> D1 write                    ← SOURCE OF TRUTH. Must succeed; 2xx depends on it.
  └─> Slack webhook (inline)      ← best effort. Failure logs + returns notified:false, still 2xx.

handleScheduled('sheet_mirror')   ← every ~5 min, INDEPENDENT of the request
  └─> SELECT … WHERE sheet_synced_at IS NULL
  └─> Sheets values:append (batched)
  └─> UPDATE … SET sheet_synced_at = now
```

Because the mirror reads **D1**, not the notification, Slack being down has no
effect on the audit trail whatsoever. Equally, a Sheets outage doesn't block an
inspection — the rows simply stay unsynced and the next sweep picks them up.
Neither is a single point of failure for the other, and the inspection itself
is never blocked by either.

This is a real improvement over the Vercel design, where the emailed copy was
often the only durable server-side artifact and losing it lost the record.

### Why scheduled, not inline

- Keeps a third-party round trip off the critical path — the worker signs and
  saves fast, which matters on a phone in a dead zone.
- Idempotent by construction: `sheet_synced_at` is the ledger, so an
  at-least-once schedule firing twice cannot double-write.
- Naturally batched — one `values:append` per sweep instead of per inspection.
- A failed sweep needs no retry logic; the next tick re-selects the same rows.

## Schema requirement

`inspection_records` needs a nullable `sheet_synced_at TEXT` column, added in
the **KIN-M0-T3 slice migration** (cheap now; an `ALTER` against a table with
real data later is not). It is the only state the mirror needs.

---

## Google Sheets auth — service account (recommended)

Cloudflare Workers cannot resolve npm, so `googleapis` is unavailable. Sign the
JWT yourself with Web Crypto, which is built in:

1. Build a claim set: `{ iss: <SA email>, scope:
   "https://www.googleapis.com/auth/spreadsheets", aud:
   "https://oauth2.googleapis.com/token", iat, exp }`.
2. Strip the PEM header/footer from the private key, base64-decode to DER, then
   `crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash:
   'SHA-256' }, false, ['sign'])` and sign `header.claims`.
3. Exchange it: `POST https://oauth2.googleapis.com/token` with
   `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=<jwt>`.
4. Cache the access token at module scope (~55 min) so a sweep costs one token
   exchange, not one per row.
5. `POST https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{tab}!A:Z:append?valueInputOption=RAW`.

**Why this shape is well-governed:** the service account can only reach sheets
it has been explicitly shared into. Share *only* the audit sheet with its email
and it cannot see anything else in Drive. Your IT director creates it, and
revocation is one click — the same controls they already apply to any other
service identity. No new vendor relationship, no new billing surface.

**Faster alternative, weaker governance:** an Apps Script web app bound to the
sheet, called with a shared token. Minutes to set up and entirely inside
Workspace — but it is a public endpoint guarded by a secret, which is a weaker
story for a document-controlled record. Use it only if the service-account
route stalls on Google Cloud access.

## Secrets (portal only — never in chat, never in code)

| Name | Purpose |
| --- | --- |
| `SLACK_WEBHOOK_URL` | Incoming webhook for **`#sage-ehs-alerts`**. |
| `GOOGLE_SA_EMAIL` | Service-account address the audit sheet is shared with. |
| `GOOGLE_SA_PRIVATE_KEY` | PEM private key from the service-account JSON. |
| `AUDIT_SHEET_ID` | Spreadsheet id from its URL. |

Every one is read inline: `await env.KIN.getSecret(env.KIN_APP_ID, 'NAME')` —
never a detached RPC method, never `process.env`.

### The destination channel is purpose-built, so test traffic is fine

`#sage-ehs-alerts` was created for this app specifically (owner, 2026-08-05) and
the first live smoke run landed there successfully. It is **not** a shared human
channel, which has a practical consequence worth stating so nobody has to
re-litigate it: driving the real notification path in automated checks is
expected, not noise.

Concretely, the MCP `smokeSlice` tool posts one message per invocation, and
`KIN-M0-T7`'s browser e2e will drive the same path repeatedly. Neither needs a
stub webhook, a redirect to a scratch channel, or an opt-out flag — exercising
the real path is the point, since a mocked webhook would prove nothing about the
inline `getSecret` → `fetch` contract that `KIN-3` and `KIN-7` are built around.

## Degradation contract (unchanged, and still tested)

An unset credential must **never** fail an inspection. A missing
`SLACK_WEBHOOK_URL` yields `{ notified: false, reason: 'not-configured' }` with
a 2xx. A missing Sheets credential leaves rows unsynced and logs — it does not
throw. This is the same contract the Resend path had, and `KIN-3` still tests it.

## What email would still be for

Nothing blocking. If a mailed copy with the signature attachment is ever wanted
for external auditors, it can be added later as a third, equally-decoupled sink
reading the same `sheet_synced_at`-style ledger. There is no rush now that D1
holds the record.
