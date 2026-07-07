#!/usr/bin/env node
/**
 * Backup/restore the Notion databases that hold synced safety records.
 *
 *   Backup:  NOTION_API_KEY=... NOTION_PTP_DB_ID=... [NOTION_JHA_DB_ID=... \
 *            NOTION_INCIDENTS_DB_ID=... NOTION_PERMITS_DB_ID=...] \
 *            node scripts/backup-notion.mjs > notion-backup.json
 *   Restore: NOTION_API_KEY=... node scripts/backup-notion.mjs --restore notion-backup.json
 *
 * Backup pages every configured database (paginated query, full properties).
 * Restore re-creates pages in their original database from the dump (new page
 * ids — device pollers will re-link on next sync; watch for duplicates, see
 * docs/RUNBOOKS.md). Uses plain fetch against the Notion REST API — no SDK.
 */
import { readFileSync } from 'node:fs'

const NOTION_VERSION = '2022-06-28'
const key = process.env.NOTION_API_KEY
if (!key) {
  console.error('Set NOTION_API_KEY (and NOTION_*_DB_ID vars for backup)')
  process.exit(1)
}

const DBS = Object.entries({
  ptp: process.env.NOTION_PTP_DB_ID,
  jha: process.env.NOTION_JHA_DB_ID,
  incidents: process.env.NOTION_INCIDENTS_DB_ID,
  permits: process.env.NOTION_PERMITS_DB_ID,
}).filter(([, id]) => !!id)

async function notion(path, body) {
  const res = await fetch(`https://api.notion.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Notion ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function backup() {
  if (!DBS.length) {
    console.error('No NOTION_*_DB_ID configured — nothing to back up')
    process.exit(1)
  }
  const dump = { takenAt: new Date().toISOString(), databases: {} }
  for (const [name, dbId] of DBS) {
    const pages = []
    let cursor
    do {
      const page = await notion(`databases/${dbId}/query`, cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 })
      pages.push(...page.results)
      cursor = page.has_more ? page.next_cursor : undefined
    } while (cursor)
    dump.databases[name] = { dbId, pages }
    console.error(`${name}: ${pages.length} pages`)
  }
  process.stdout.write(JSON.stringify(dump, null, 1) + '\n')
}

// Strip read-only property values Notion rejects on create
function writableProperties(props) {
  const out = {}
  for (const [k, v] of Object.entries(props)) {
    if (['formula', 'rollup', 'created_time', 'created_by', 'last_edited_time', 'last_edited_by', 'unique_id'].includes(v.type)) continue
    out[k] = v
  }
  return out
}

async function restore(file) {
  const dump = JSON.parse(readFileSync(file, 'utf8'))
  for (const [name, { dbId, pages }] of Object.entries(dump.databases)) {
    let ok = 0
    for (const page of pages) {
      try {
        await notion('pages', {
          parent: { database_id: dbId },
          properties: writableProperties(page.properties),
        })
        ok++
      } catch (e) {
        console.error(`${name}: failed a page — ${e.message}`)
      }
    }
    console.error(`${name}: restored ${ok}/${pages.length} pages into ${dbId}`)
  }
}

const restoreIdx = process.argv.indexOf('--restore')
if (restoreIdx !== -1) {
  const file = process.argv[restoreIdx + 1]
  if (!file) { console.error('Usage: backup-notion.mjs --restore <file>'); process.exit(1) }
  await restore(file)
} else {
  await backup()
}
