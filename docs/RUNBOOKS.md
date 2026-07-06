# Operations Runbooks

Incident response and backup/restore for Equipment QR Hub. Written for an
operator with Vercel + Upstash + Notion console access. Last updated: July 2026.

## Incident response

1. **Detect.** Alerts arrive via Sentry (server errors are captured from every
   route catch block with a `scope` tag) or a failing
   `GET /api/admin/health` (admin session required — reports KV, email, Slack,
   Notion, AI flag status). The structured logs (single-line JSON, `event` /
   `route` / `outcome` fields) are in Vercel → Deployments → Functions.
2. **Triage.** Identify the blast radius from the Sentry `scope` tag (which
   route/lib) and `GET /api/admin/audit` (recent privileged actions, newest
   first) if the concern is unauthorized activity.
3. **Contain.** In order of severity, all on Vercel → Settings → Environment
   Variables (redeploy applies them):
   - Rotate `NEXTAUTH_SECRET` → invalidates every session (all users signed out).
   - Rotate/revoke the Upstash REST token (`KV_REST_API_TOKEN`) → freezes
     server-side state changes (rate limiting fails open by design).
   - Disable feature flags: unset `ANTHROPIC_API_KEY` (AI), `RESEND_API_KEY`
     (email), `SLACK_WEBHOOK_URL`, `NEXT_PUBLIC_EHS_REVIEW` (review workflow).
   - Rotate `EMAIL_LOGIN_CODE` if the shared worker code leaked (it can only
     mint worker sessions, but rotate anyway).
   - Rotate `REVIEW_TOKEN_SECRET` → voids all outstanding email decision links.
4. **Notify** per [SECURITY.md](../SECURITY.md) (security contact + affected
   users if data was exposed).
5. **Post-mortem.** Capture timeline from Sentry events + audit log + Vercel
   deploy history; file remediation items in the roadmap backlog.

## Backup

### KV (Upstash Redis)

`scripts/backup-kv.mjs` dumps every persistent application key (`beta:*`,
`review:*`, `known-users`, `audit:log`) to a timestamped JSON file:

```bash
KV_REST_API_URL=... KV_REST_API_TOKEN=... node scripts/backup-kv.mjs > kv-backup.json
```

Rate-limit counters (`rl:*`) and `health:probe` are ephemeral and deliberately
skipped. Run before risky migrations and on a weekly cron if beta signups matter.

### Notion (system of record for synced safety records)

1. Notion → Settings & members → Settings → **Export all workspace content**
   (Markdown & CSV) — or per-database: ⋯ menu → Export.
2. Store the export alongside `kv-backup.json`; Notion also keeps page-level
   history (30 days on Free/Plus, 90+ on Business) for point-in-time recovery.

### Devices

Un-synced records exist **only** on the worker's device. A lost/broken phone
loses anything not yet synced — that risk window is why sync runs on every
reconnect and why the dashboard surfaces pending-sync counts. There is no
device backup lever; shorten the window by keeping sync enabled.

## Restore

### KV

The backup JSON maps `key → value` (lists/sets preserved as arrays). Re-apply
with the same script in restore mode:

```bash
KV_REST_API_URL=... KV_REST_API_TOKEN=... node scripts/backup-kv.mjs --restore kv-backup.json
```

TTLs are re-applied per key family (`beta:` 180d, `review:` 30d,
`known-users` 90d) — see the script source.

### Notion

Re-import the exported CSV into a database with the same properties, or restore
individual pages from Notion page history (⋯ → Page history). After a Notion
restore, device pollers resume matching on `notionPageId`; records whose pages
changed IDs will re-create pages on next sync (duplicates are the failure mode
to check for).
