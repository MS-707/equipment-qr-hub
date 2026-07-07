#!/usr/bin/env node
/**
 * Backup/restore the persistent application keys in Upstash Redis (Vercel KV).
 *
 *   Backup:  KV_REST_API_URL=... KV_REST_API_TOKEN=... node scripts/backup-kv.mjs > kv-backup.json
 *   Restore: KV_REST_API_URL=... KV_REST_API_TOKEN=... node scripts/backup-kv.mjs --restore kv-backup.json
 *
 * Covers beta:* (strings/JSON), beta:_ids + known-users (sets), review:*
 * (strings/JSON), audit:log (list). Skips ephemeral rl:* and health:probe.
 * See docs/RUNBOOKS.md.
 */
import { Redis } from '@upstash/redis'
import { readFileSync } from 'node:fs'

const url = process.env.KV_REST_API_URL
const token = process.env.KV_REST_API_TOKEN
if (!url || !token) {
  console.error('Set KV_REST_API_URL and KV_REST_API_TOKEN')
  process.exit(1)
}
const redis = new Redis({ url, token, automaticDeserialization: false })

const PREFIXES = ['beta:', 'review:']
const SETS = ['known-users', 'beta:_ids']
const LISTS = ['audit:log']

// TTLs re-applied on restore, seconds (mirrors the writing modules)
const RESTORE_TTL = [
  { match: (k) => k.startsWith('beta:') && k !== 'beta:_ids', ttl: 60 * 60 * 24 * 180 },
  { match: (k) => k.startsWith('review:'), ttl: 60 * 60 * 24 * 30 },
  { match: (k) => k === 'known-users', ttl: 60 * 60 * 24 * 90 },
]

async function scanPrefix(prefix) {
  const keys = []
  let cursor = '0'
  do {
    const [next, batch] = await redis.scan(cursor, { match: `${prefix}*`, count: 200 })
    cursor = String(next)
    keys.push(...batch)
  } while (cursor !== '0')
  return keys
}

async function backup() {
  const dump = { takenAt: new Date().toISOString(), strings: {}, sets: {}, lists: {} }
  for (const prefix of PREFIXES) {
    for (const key of await scanPrefix(prefix)) {
      if (SETS.includes(key)) continue
      const type = await redis.type(key)
      if (type === 'string') dump.strings[key] = await redis.get(key)
    }
  }
  for (const key of SETS) {
    const members = await redis.smembers(key)
    if (members.length) dump.sets[key] = members
  }
  for (const key of LISTS) {
    const items = await redis.lrange(key, 0, -1)
    if (items.length) dump.lists[key] = items
  }
  process.stdout.write(JSON.stringify(dump, null, 1) + '\n')
  console.error(
    `Backed up ${Object.keys(dump.strings).length} strings, ` +
    `${Object.keys(dump.sets).length} sets, ${Object.keys(dump.lists).length} lists`
  )
}

function ttlFor(key) {
  for (const { match, ttl } of RESTORE_TTL) if (match(key)) return ttl
  return null
}

async function restore(file) {
  const dump = JSON.parse(readFileSync(file, 'utf8'))
  for (const [key, value] of Object.entries(dump.strings ?? {})) {
    const ttl = ttlFor(key)
    await redis.set(key, value, ttl ? { ex: ttl } : undefined)
  }
  for (const [key, members] of Object.entries(dump.sets ?? {})) {
    if (members.length) await redis.sadd(key, ...members)
    const ttl = ttlFor(key)
    if (ttl) await redis.expire(key, ttl)
  }
  for (const [key, items] of Object.entries(dump.lists ?? {})) {
    await redis.del(key)
    // lrange returns newest-first for our lpush lists; re-push in reverse
    for (const item of [...items].reverse()) await redis.lpush(key, item)
  }
  console.error('Restore complete')
}

const restoreIdx = process.argv.indexOf('--restore')
if (restoreIdx !== -1) {
  const file = process.argv[restoreIdx + 1]
  if (!file) { console.error('Usage: backup-kv.mjs --restore <file>'); process.exit(1) }
  await restore(file)
} else {
  await backup()
}
