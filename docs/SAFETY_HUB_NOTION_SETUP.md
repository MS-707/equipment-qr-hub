# Safety Hub — Notion + Vercel Blob Setup

This is the durable, off-device, **auditable record trail** for the Safety Hub. Once
configured, every Pre-Task Plan, permit, and incident report you save syncs to a
Notion database, and every signature/photo is stored in cloud object storage with a
permanent link. Until these are configured, records live only in the browser that
created them.

There are two systems to set up:

1. **Notion** — the structured, human-readable record of every safety document.
2. **Vercel Blob** — durable storage for signature images and incident photos.

---

## Part 1 — Notion

### Step 1 — Create an internal integration (the API key)

1. Go to **https://www.notion.com/my-integrations**
2. Click **New integration** → choose **Internal**.
3. Name it `Equipment QR Hub — Safety Sync`.
4. Associate it with the company workspace.
5. Capabilities: **Insert content** and **Read content** are sufficient (no user info needed).
6. Click **Save**, then copy the **Internal Integration Secret**. It looks like
   `ntn_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`.

> This single secret is the value for the `NOTION_API_KEY` environment variable.

### Step 2 — Create three databases

Create these as **full-page databases** in Notion (New page → Database → Table).
Put them wherever your EHS team keeps records — e.g. a "Safety Records" workspace.

| Database name (your choice)        | Holds                                              |
|------------------------------------|---------------------------------------------------|
| **Safety — Pre-Task Plans**        | PTP / Pre-Build Plans                              |
| **Safety — Permits**               | Work-at-Height, Hot Work, Confined Space (all 3)  |
| **Safety — Incidents**             | Injury / near-miss / property / environmental     |

### Step 3 — Add the exact columns (property names are case- and space-sensitive)

> ⚠️ **Critical:** Notion creates every new database with one default text column
> called **`Name`** (the title column). You must **rename `Name` → `ID`** in each
> database. The property type stays "Title". If `ID` doesn't exist as the title,
> the sync will fail.

> ⚠️ Property names must match **exactly** — including capitalization and the space
> in `Created At`, `Created By`, `Sync Source`. A mismatch causes the write to be
> rejected.

#### Database A — Safety — Pre-Task Plans

| Property name      | Type          | Populated now?            | Notes |
|--------------------|---------------|---------------------------|-------|
| `ID`               | Title         | ✅ yes (rename from Name) | e.g. `PTP-2026-0001` |
| `Type`             | Select        | ✅ yes                    | value: `ptp` |
| `Project`          | Text          | ✅ yes                    | |
| `Location`         | Text          | ✅ yes                    | |
| `Created By`       | Text          | ✅ yes                    | signer's name |
| `Created At`       | Date          | ✅ yes                    | |
| `Sync Source`      | Select        | ✅ yes                    | value: `equipment-qr-hub` |
| `Created By Email` | Email         | ⏳ after code update       | verified sign-in email |
| `Date`             | Date          | ⏳ after code update       | shift date |
| `Shift`            | Select        | ⏳ after code update       | day / swing / night |
| `Crew Count`       | Number        | ⏳ after code update       | # of crew signatures |
| `Signatures`       | Files & media | ⏳ after blob upload       | links to signature PNGs |

#### Database B — Safety — Permits

| Property name      | Type          | Populated now?            | Notes |
|--------------------|---------------|---------------------------|-------|
| `ID`               | Title         | ✅ yes (rename from Name) | e.g. `WAH-2026-0001` |
| `Type`             | Select        | ✅ yes                    | `height-permit` / `hot-work-permit` / `confined-space-permit` |
| `Project`          | Text          | ✅ yes                    | |
| `Location`         | Text          | ✅ yes                    | |
| `Created By`       | Text          | ✅ yes                    | |
| `Created At`       | Date          | ✅ yes                    | |
| `Sync Source`      | Select        | ✅ yes                    | `equipment-qr-hub` |
| `Status`           | Select        | ✅ yes                    | `active` / `closed` / `revoked` |
| `Created By Email` | Email         | ⏳ after code update       | |
| `Valid From`       | Date          | ⏳ after code update       | |
| `Valid Until`      | Date          | ⏳ after code update       | |
| `Worker Count`     | Number        | ⏳ after code update       | workers / entrants |
| `Signatures`       | Files & media | ⏳ after blob upload       | |

#### Database C — Safety — Incidents

| Property name        | Type          | Populated now?            | Notes |
|----------------------|---------------|---------------------------|-------|
| `ID`                 | Title         | ✅ yes (rename from Name) | e.g. `INC-2026-0001` |
| `Type`               | Select        | ✅ yes                    | value: `incident-report` |
| `Project`            | Text          | ✅ yes                    | |
| `Location`           | Text          | ✅ yes                    | |
| `Created By`         | Text          | ✅ yes                    | reporter name |
| `Created At`         | Date          | ✅ yes                    | when filed |
| `Sync Source`        | Select        | ✅ yes                    | `equipment-qr-hub` |
| `Severity`           | Select        | ✅ yes                    | `minor` / `moderate` / `serious` / `critical` |
| `Created By Email`   | Email         | ⏳ after code update       | |
| `Incident Type`      | Select        | ⏳ after code update       | injury / near-miss / property-damage / environmental |
| `Occurred At`        | Date          | ⏳ after code update       | when the incident happened |
| `Reported to CalOSHA`| Checkbox      | ⏳ after code update       | |
| `Photos`             | Files & media | ⏳ after blob upload       | incident photos |

> **You can create all columns now** (including the ⏳ ones). Notice the app will
> simply leave the ⏳ columns empty until the corresponding code update ships; the
> sync still succeeds. Creating them now means IT only does this once.
>
> Select option values (like `active`, `minor`) are created automatically the first
> time a record with that value syncs — you do **not** need to pre-add them.
>
> The **complete record** (every field, the full audit-event log, signature
> metadata) is also written into the body of each Notion page as a JSON code block,
> so nothing is ever lost even if a column is missing.

### Step 4 — Connect the integration to each database

The integration can only write to databases it's explicitly connected to:

1. Open each of the three databases.
2. Click the **`•••`** menu (top-right) → **Connections** → **Connect to** →
   select `Equipment QR Hub — Safety Sync`.
3. Repeat for all three databases.

### Step 5 — Get each database ID

Open a database as a full page and copy its URL. The **32-character hex string**
before the `?` is the database ID:

```
https://www.notion.so/yourworkspace/213fb1c4e5f6478abc1234567890abcd?v=...
                                     └──────────── this part ────────────┘
```

You'll have three IDs — one per database.

---

## Part 2 — Vercel Blob (signature & photo storage)

Whoever administers the Vercel project does this (≈2 minutes):

1. In the Vercel dashboard, open the **equipment-qr-hub** project.
2. Go to the **Storage** tab → **Create Database** → choose **Blob**.
3. Name it `safety-media` → **Create**.
4. Connect it to the project (Vercel prompts this automatically).

That's it. Vercel automatically adds a `BLOB_READ_WRITE_TOKEN` environment variable
to the project — no copying needed. (If you'd rather use AWS S3, that's also fine;
tell me and I'll target S3 instead.)

---

## Part 3 — The exact list to give IT

Have IT add the following **environment variables** to the Vercel project
(**Settings → Environment Variables**, set for Production + Preview), then redeploy:

| Variable                 | Where it comes from                              |
|--------------------------|--------------------------------------------------|
| `NOTION_API_KEY`         | Part 1, Step 1 — the Internal Integration Secret |
| `NOTION_PTP_DB_ID`       | Part 1, Step 5 — "Pre-Task Plans" database ID    |
| `NOTION_PERMITS_DB_ID`   | Part 1, Step 5 — "Permits" database ID           |
| `NOTION_INCIDENTS_DB_ID` | Part 1, Step 5 — "Incidents" database ID         |
| `BLOB_READ_WRITE_TOKEN`  | Part 2 — auto-added when the Blob store is created |

After these are set and the project is redeployed, saved records sync to Notion
automatically (with retry on reconnect). Existing records already on a device will
sync the next time that device opens the app online.

---

## What's already built vs. what I wire next

**Already working** (ships the moment the env vars above are set):
- Record sync to the correct Notion database by type.
- Full record + audit-event log written to each Notion page body as JSON.
- The ✅ columns above populated automatically.
- Graceful retry: records stay `pending` and re-sync on reconnect; nothing is lost.

**My follow-up code changes** (once the schema exists):
1. Expand the sync mapper to populate the ⏳ columns (email, dates, counts, etc.).
2. Upload signature/photo blobs to Vercel Blob on save and attach the URLs to the
   Notion `Signatures` / `Photos` columns — so the signed artifact lives off-device.

---

## Audit-integrity notes (for the legal/inspection question)

- Records are **append-only** in the app: no field is ever silently edited.
  Corrections are new records or appended `amended` audit events.
- Every record carries `Created By` + verified sign-in email and an ISO timestamp.
- The Notion page body preserves the **complete** record JSON and the full event
  history, independent of the structured columns.
- Recommended hardening beyond this setup (happy to implement): server-authoritative
  write-once storage (e.g. S3 Object Lock) and per-record hash chaining so any later
  tampering is cryptographically detectable.
