import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * ES-3: catalog CI gates. These make the en/es catalogs structurally unable
 * to reproduce the June failures: key drift, placeholder text in production,
 * interpolation-var drift, missing plural variants, and a stale generated
 * key union. Every violation fails `npm test`, which blocks every milestone.
 */

import en from '@/messages/en.json'
import es from '@/messages/es.json'
import pendingManifest from '../../../docs/i18n/pending-translation.json'
import identicalManifest from '../../../docs/i18n/intentionally-identical.json'
import blockedManifest from '../../../docs/i18n/blocked-keys.json'

type Tree = { [k: string]: string | Tree }

const PLURAL_CATEGORIES = new Set(['zero', 'one', 'two', 'few', 'many', 'other'])

// es values that legitimately equal English: pipeline-declared cognates/brand
// labels, plus blocked keys whose termination fallback IS the English source
// (docs/i18n/PIPELINE.md — enforced separately by i18n-pipeline-rules).
const INTENTIONALLY_IDENTICAL: string[] = identicalManifest.keys
const BLOCKED_KEYS: string[] = blockedManifest.blocked.map((b: { key: string }) => b.key)

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null) Object.assign(out, flatten(v, key))
    else out[key] = v
  }
  return out
}

function isPluralGroup(node: string | Tree): node is Tree {
  if (typeof node !== 'object' || node === null) return false
  const keys = Object.keys(node)
  return (
    keys.length > 0 &&
    keys.includes('other') &&
    keys.every((k) => PLURAL_CATEGORIES.has(k) && typeof (node as Tree)[k] === 'string')
  )
}

function varsOf(template: string): string[] {
  return Array.from(template.matchAll(/\{([a-zA-Z0-9_]+)\}/g), (m) => m[1]).sort()
}

const flatEn = flatten(en as Tree)
const flatEs = flatten(es as Tree)

describe('en/es key parity', () => {
  it('every en key exists in es', () => {
    const missing = Object.keys(flatEn).filter((k) => !(k in flatEs))
    expect(missing).toEqual([])
  })

  it('every es key exists in en (no orphan translations)', () => {
    const orphans = Object.keys(flatEs).filter((k) => !(k in flatEn))
    expect(orphans).toEqual([])
  })
})

describe('zero placeholders (placeholder text reached production in June)', () => {
  const PLACEHOLDER = /\[TODO|TBD\b|XXX|lorem ipsum/i
  it.each([
    ['en', flatEn],
    ['es', flatEs],
  ])('%s catalog has no placeholder or empty values', (_name, flat) => {
    const bad = Object.entries(flat).filter(([, v]) => PLACEHOLDER.test(v) || v.trim() === '')
    expect(bad).toEqual([])
  })
})

describe('interpolation-var parity per key', () => {
  it('en and es declare identical {var} sets for every key', () => {
    const drift = Object.keys(flatEn)
      .filter((k) => k in flatEs)
      .filter((k) => JSON.stringify(varsOf(flatEn[k])) !== JSON.stringify(varsOf(flatEs[k])))
    expect(drift).toEqual([])
  })
})

describe('plural-variant parity', () => {
  function pluralGroups(tree: Tree, prefix = ''): Record<string, string[]> {
    const out: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(tree)) {
      const key = prefix ? `${prefix}.${k}` : k
      if (typeof v === 'object' && v !== null) {
        if (isPluralGroup(v)) out[key] = Object.keys(v).sort()
        else Object.assign(out, pluralGroups(v, key))
      }
    }
    return out
  }

  it('en and es have the same plural groups with the same categories', () => {
    expect(pluralGroups(es as Tree)).toEqual(pluralGroups(en as Tree))
  })

  it("every plural group includes 'other' (the universal fallback category)", () => {
    for (const cats of Object.values(pluralGroups(en as Tree))) {
      expect(cats).toContain('other')
    }
  })

  it("no '(s)' plural hacks anywhere in either catalog (June: safety banner shipped one)", () => {
    const hacks = [...Object.entries(flatEn), ...Object.entries(flatEs)].filter(([, v]) => v.includes('(s)'))
    expect(hacks).toEqual([])
  })
})

describe('pending-translation manifest (dark-phase discipline)', () => {
  const pending = new Set<string>(pendingManifest.pending)

  it('every manifest entry is a real catalog key', () => {
    const ghosts = Array.from(pending).filter((k) => !(k in flatEn))
    expect(ghosts).toEqual([])
  })

  it('every untranslated es value (=== en) is explicitly declared pending, intentionally identical, or blocked', () => {
    const undeclared = Object.keys(flatEs).filter(
      (k) =>
        flatEs[k] === flatEn[k] &&
        !pending.has(k) &&
        !INTENTIONALLY_IDENTICAL.includes(k) &&
        !BLOCKED_KEYS.includes(k)
    )
    expect(undeclared).toEqual([])
  })

  it('declared manifests never overlap (a key is pending XOR identical XOR blocked)', () => {
    const all = Array.from(pending).concat(INTENTIONALLY_IDENTICAL, BLOCKED_KEYS)
    expect(all.length).toBe(new Set(all).size)
  })

  it('every pending entry is still untranslated (translated keys must leave the manifest)', () => {
    const stale = Array.from(pending).filter((k) => k in flatEs && flatEs[k] !== flatEn[k])
    expect(stale).toEqual([])
  })
})

describe('generated key union freshness (scripts/gen-i18n-keys.mjs)', () => {
  // Mirror of the generator's algorithm — if the generator changes, this pin
  // changes with it in the same commit, which is exactly the freshness gate.
  function collectMessageKeys(tree: Tree): string[] {
    const keys: string[] = []
    function walk(node: Tree, prefix: string) {
      for (const [k, v] of Object.entries(node)) {
        const key = prefix ? `${prefix}.${k}` : k
        if (typeof v === 'object' && v !== null) {
          if (isPluralGroup(v)) keys.push(key)
          else walk(v, key)
        } else keys.push(key)
      }
    }
    walk(tree, '')
    return keys
  }

  it('src/lib/i18n-keys.d.ts matches a fresh generation from en.json', () => {
    const keys = collectMessageKeys(en as Tree)
    const expected = `// AUTO-GENERATED by scripts/gen-i18n-keys.mjs — do not edit by hand.
// Regenerate after catalog changes; the i18n-catalog vitest pins freshness.
export type MessageKey =
${keys.map((k) => `  | '${k}'`).join('\n')}
`
    const actual = readFileSync('src/lib/i18n-keys.d.ts', 'utf8')
    expect(actual).toBe(expected)
  })

  it('plural parents (not leaf variants) are the typed keys', () => {
    const actual = readFileSync('src/lib/i18n-keys.d.ts', 'utf8')
    expect(actual).toContain("| 'sync.recordsSynced'")
    expect(actual).not.toContain("| 'sync.recordsSynced.one'")
  })
})
