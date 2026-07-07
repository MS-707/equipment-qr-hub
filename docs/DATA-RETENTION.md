# Data Retention Schedule — store by store

Every place this application persists data, with the retention period or
deletion trigger each implements. Regulatory mapping (OSHA/Cal-OSHA horizons
per record type) lives in [COMPLIANCE-RETENTION.md](./COMPLIANCE-RETENTION.md);
this document is the operational schedule an IT reviewer audits. Last updated:
July 2026.

## Device stores (per phone/tablet)

| Store | What | Retention / trigger | Code |
|---|---|---|---|
| localStorage | Safety records (PTPs, permits, JHAs, incidents, toolbox talks) already synced to Notion | Auto-removed **90 days** after creation by the archiver that runs at app load | `src/lib/safety-records.ts` (`RETENTION_DAYS`) |
| localStorage | Never-synced safety records | Until the user clears them (device is system of record until sync) | same |
| localStorage | Unsubmitted form drafts (`draft:*`) | Pruned after **7 days** | `src/lib/safety-records.ts` (`DRAFT_MAX_AGE_MS`) |
| localStorage | Inspections, work orders, PM records, training data | Until user clears (localStorage-only domains; see backlog for server sync plans) | `src/lib/inspections.ts`, `work-orders.ts`, `shop-management.ts` |
| IndexedDB | Inspection photos | With their parent inspection record | `src/lib/inspections.ts` (`PHOTO_DB`) |
| IndexedDB | Safety-record photo/signature blobs | With their parent record (90-day archiver removes both) | `src/lib/safety-records.ts` |

## Server stores (Upstash Redis / Vercel KV), by key prefix

| Key(s) | What | Retention | Code |
|---|---|---|---|
| `beta:*` (+ `beta:_ids` set) | Beta signups | **180-day** TTL, refreshed on decision | `src/lib/beta.ts` |
| `review:*` | EHS review submissions | **7-day** TTL pending; **30 days** once decided | `src/lib/review-store.ts` |
| `known-users` | Set of sign-in emails (first-login detection) | **90-day** TTL, refreshed on activity | `src/lib/user-tracker.ts` |
| `rl:*` | Rate-limit counters | Window length + 1s (self-expiring) | `src/lib/rate-limit.ts` |
| `audit:log` | Privileged-action audit trail | Capped list, newest **1000** entries | `src/lib/audit-log.ts` |
| `health:probe` | Health-check counter | Overwritten on each admin health check | `src/app/api/admin/health/route.ts` |
| `i18n:*` | Feature flags (planned, ES rollout) | Until changed by an operator | `docs/i18n/DESIGN.md` |

## Third-party stores

| Store | What | Retention / trigger |
|---|---|---|
| Notion | Synced safety records (system of record post-sync) | Organization's Notion workspace policy — **must satisfy the 5-year 1904.33 horizon for incidents** (see COMPLIANCE-RETENTION.md) |
| Resend / recipient mailboxes | EHS notification emails incl. signed pre-trip PNG attachments | App stores no copy — the payload exists only in the send call. Deletion triggers: Resend dashboard log purge (Resend retains send logs per its published schedule), and recipient mailbox deletion for the durable copy |
| Slack | Record-submitted and first-sign-in notifications | App stores no copy. Deletion trigger: deleting the message in Slack (or the workspace retention job, if the org has configured one) removes the only copy |
| Sentry | Error events (stack traces, device info) | Sentry plan default (90 days) |
| Vercel | Serverless request logs (incl. structured JSON app logs) | Vercel plan log retention |

## Deletion levers

- Device: Settings → clear app data, or the in-app record deletion where offered.
- KV: TTLs are automatic; manual purge via `redis-cli`/Upstash console by prefix.
- Notion/Slack/email: governed by those systems — deleting there does not
  resurrect on devices (sync is one-way up).
- Worker offboarding has **no single-button erasure yet** — tracked in the
  roadmap backlog (data-subject deletion). Manual sweep: KV `known-users`
  member removal, Notion page author filter, mailbox search.
