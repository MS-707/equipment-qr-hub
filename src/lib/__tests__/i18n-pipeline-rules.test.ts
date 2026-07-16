import { describe, it, expect } from 'vitest'

/**
 * ES-M2-T4: the pipeline termination rule is enforceable, not aspirational
 * (docs/i18n/PIPELINE.md). A key that exhausted its 3 review rounds must be
 * an exact-English fallback AND take exactly one documented path: namespace
 * suppression or an allowlisted, justified leakage sentinel.
 */

import en from '@/messages/en.json'
import es from '@/messages/es.json'
import blockedManifest from '../../../docs/i18n/blocked-keys.json'
import leakageAllowlist from '../../../e2e/es-leakage-allowlist.json'

type Tree = { [k: string]: string | Tree }

function resolve(tree: Tree, key: string): string | undefined {
  let node: Tree | string | undefined = tree
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = node[part]
  }
  return typeof node === 'string' ? node : undefined
}

type BlockedEntry = { key: string; namespace: string; reason: string; rounds: number; date: string }
const blocked = blockedManifest.blocked as BlockedEntry[]
const allowed = leakageAllowlist.allowed as { text: string; reason: string }[]

describe('blocked-keys manifest (3-round termination)', () => {
  it('is size-capped at 20 — more means the pipeline itself is broken', () => {
    expect(blocked.length).toBeLessThanOrEqual(20)
  })

  it('every blocked key exists in the en catalog', () => {
    const ghosts = blocked.filter((b) => resolve(en as Tree, b.key) === undefined)
    expect(ghosts).toEqual([])
  })

  it('every blocked key falls back to the EXACT English source (never a failed translation)', () => {
    const drifted = blocked.filter((b) => resolve(es as Tree, b.key) !== resolve(en as Tree, b.key))
    expect(drifted).toEqual([])
  })

  it('every blocked entry documents rounds=3, a reason, and a date', () => {
    const undocumented = blocked.filter((b) => b.rounds !== 3 || !b.reason || !b.date)
    expect(undocumented).toEqual([])
  })

  it('every blocked key takes exactly ONE path: allowlisted leakage XOR namespace suppression', () => {
    // Suppression is a runtime KV state; the committed, testable declaration
    // is the allowlist. A blocked key missing from the allowlist MUST have
    // its namespace listed in the manifest's suppression declaration.
    const manifest = blockedManifest as unknown as { suppressedNamespaces?: string[] }
    const suppressed = new Set(manifest.suppressedNamespaces ?? [])
    const wrong = blocked.filter((b) => {
      const enValue = resolve(en as Tree, b.key) ?? ''
      const isAllowlisted = allowed.some((a) => enValue.includes(a.text) || a.text === b.key)
      const isSuppressed = suppressed.has(b.namespace)
      return isAllowlisted === isSuppressed // both or neither → violation
    })
    expect(wrong).toEqual([])
  })
})

describe('leakage allowlist discipline', () => {
  it('is size-capped at 25 and every entry carries a justification', () => {
    expect(allowed.length).toBeLessThanOrEqual(25)
    expect(allowed.filter((a) => !a.reason || a.reason.length < 5)).toEqual([])
  })
})
