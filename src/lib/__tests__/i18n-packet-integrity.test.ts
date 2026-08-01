import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'

/**
 * ES-M3-T5: sign-off is enforced, not aspirational. Every safety-critical
 * namespace must carry committed review evidence whose VALUES equal the live
 * es catalog exactly, and the sign-off packet's digests must match the live
 * catalog — so editing a reviewed safety string without re-running the
 * pipeline (and re-generating the packet) fails `npm test`. A SIGNED packet
 * whose digest no longer matches means someone edited signed safety copy —
 * hard failure.
 */

import es from '@/messages/es.json'

type Tree = { [k: string]: string | Tree }

const SAFETY_NS = ['ptp', 'jha', 'incident', 'permits', 'signature', 'hazard', 'atmo', 'forms'] as const
// atmo/forms evidence lives in earlier-run files with different shapes; the
// digest anchor below covers them. Namespaces with per-run values evidence:
const VALUES_EVIDENCE_NS = ['ptp', 'jha', 'incident', 'permits', 'signature', 'hazard', 'forms'] as const

function leaves(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null) Object.assign(out, leaves(v, key))
    else out[key] = v
  }
  return out
}

function digest(vals: Record<string, string>): string {
  const sorted = Object.entries(vals).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex')
}

describe('review evidence matches the live catalog', () => {
  for (const ns of VALUES_EVIDENCE_NS) {
    it(`docs/i18n/review/${ns}.json values === es.json ${ns}.*`, () => {
      const path = `docs/i18n/review/${ns}.json`
      expect(existsSync(path), `${path} missing`).toBe(true)
      const ev = JSON.parse(readFileSync(path, 'utf8'))
      const live = leaves((es as Tree)[ns] as Tree, ns)
      expect(ev.values).toEqual(live)
    })
  }
})

describe('sign-off packet digests anchor the live catalog', () => {
  const signoff = JSON.parse(readFileSync('docs/i18n/signoff.json', 'utf8'))
  const packet = signoff.packets.find((p: { packet: string }) => p.packet === 'safety-forms')

  it('the safety-forms packet exists with digests for every safety namespace', () => {
    expect(packet).toBeTruthy()
    for (const ns of SAFETY_NS) expect(packet.namespaceDigests[ns]).toMatch(/^[a-f0-9]{64}$/)
  })

  it('every digest matches the live es catalog (signed copy can never drift silently)', () => {
    for (const ns of SAFETY_NS) {
      const live = digest(leaves((es as Tree)[ns] as Tree, ns))
      expect(`${ns}:${live}`).toBe(`${ns}:${packet.namespaceDigests[ns]}`)
    }
  })
})
