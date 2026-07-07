# Compliance & Retention Mapping

> **DRAFT — pending counsel review.** This document maps what the app actually
> does to the OSHA record-keeping provisions most relevant to the record types
> it stores. It was drafted with regulatory citations for review by qualified
> counsel and is not legal advice. Last updated: July 2026.

## How the app retains data (implemented behavior)

| Store | What | Period | Code |
|---|---|---|---|
| Device (localStorage/IndexedDB) | Safety records already synced to Notion | Auto-removed 90 days after creation | `src/lib/safety-records.ts` (`RETENTION_DAYS = 90`) |
| Device | Never-synced safety records | Until manually cleared | same |
| Device | Unsubmitted form drafts | Pruned after 7 days | `src/lib/safety-records.ts` (`DRAFT_MAX_AGE_MS`) |
| Upstash Redis (KV) | Sign-in tracking (name, email) | 90-day TTL | `src/lib/user-tracker.ts` |
| Upstash Redis (KV) | Beta signups | 180-day TTL | `src/lib/beta.ts` |
| Upstash Redis (KV) | EHS review submissions | 7-day TTL; 30 days once decided | `src/lib/review-store.ts` |
| Notion | Synced safety records | Organization's workspace policy | `src/lib/safety-sync.ts` |
| Email (Resend) | Pre-trip inspection notifications incl. signature PNG | App stores no copy; deletion trigger = recipient mailbox deletion (durable copy) + Resend log purge | `src/app/api/inspections/notify/route.ts` |

## OSHA mapping

| Record type in app | OSHA basis | Required retention | App behavior | Compliance path |
|---|---|---|---|---|
| Incident reports | 29 CFR **1904.33** — injury/illness records kept **5 years** following the year they cover | 5 years | Device copy auto-removed 90 days post-sync | **Notion (or exported CSV) must be the system of record.** Device storage alone is not sufficient. |
| Forklift operator training / certification records | 29 CFR **1910.178(l)(6)** — certification (operator name, training/evaluation dates, trainer identity) must exist for current operators | While the operator drives (current certification) | Training tracker stores locally; no automatic durable copy | Export training records (CSV) or maintain the certification in Notion; re-evaluation at least every 3 years per 1910.178(l)(4)(iii). |
| Daily forklift (PIT) pre-trip inspections | 29 CFR **1910.178(q)(7)** — daily/per-shift examination required; **no explicit federal retention period** | Not federally specified; retain at least until superseded (many EHS programs keep 3+ months) | 90-day device retention post-sync; each inspection also emailed to EHS with signed PNG | The EHS email plus Notion sync provide the durable trail; 90-day local window aligns with common practice. |
| Permits (hot work, confined space, work-at-height) | 29 CFR 1910.146(e)(6) — canceled confined-space entry permits retained **1 year** for program review | 1 year (confined space) | Device copy auto-removed 90 days post-sync | Notion sync must be enabled for permit records; annual program review should query Notion, not devices. |

## Gaps counsel should confirm

1. Whether Notion workspace retention is configured to satisfy the 5-year
   1904.33 horizon (the app cannot enforce another system's policy).
2. Whether the signature PNG in EHS email needs an explicit retention statement
   in the org's email policy.
3. State-plan deltas (e.g. Cal/OSHA) where the site operates.
