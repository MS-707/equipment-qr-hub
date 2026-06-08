/**
 * Generators — the swappable "model" end of the loop.
 *
 * The loop framework deliberately separates the GENERATOR (cheap, replaceable)
 * from the VERIFIER (grader.mjs) and the ITERATION (loop.mjs). This file holds
 * generators that satisfy one interface:
 *
 *     generate(scope, location, { hints = [] }) -> Suggestion[]
 *
 * where a hint is a category key the critic believes is probably missing.
 *
 *  - makeStubSage(config): an OFFLINE, deterministic, rule-based generator. It
 *    needs no network or API key, so the whole harness runs anywhere. Its
 *    config knobs are what the meta-loop searches over — see meta-loop.mjs.
 *
 *  - anthropicSage: the REAL seam. This is where production Sage
 *    (src/app/api/safety/suggest-hazards) plugs in. It is intentionally inert
 *    offline: it throws unless a key + explicit opt-in are present, so `node`
 *    runs never make a surprise network call. Wire it up when you want to grade
 *    the real model against this same dataset and grader.
 */

import { HAZARD_CATEGORIES, ALL_KEYS, IMPLICATIONS, RISK_RANK, suggestionFor } from './taxonomy.mjs'

/**
 * Build an offline rule-based generator.
 *
 * @param {object} config
 * @param {string}  config.name           label for scoreboards
 * @param {number}  [config.minHits=1]     keyword hits in scope needed to fire
 * @param {string[]}[config.baseline=[]]   hazards always included (generic site risk)
 * @param {boolean} [config.useImplications=false]  expand matches via domain rules up front
 * @param {number}  [config.maxHazards=6]  cap, keeping highest-risk first
 */
export function makeStubSage(config) {
  const {
    name = 'stub',
    minHits = 1,
    baseline = [],
    useImplications = false,
    maxHazards = 6,
  } = config

  const generate = (scope, location, { hints = [] } = {}) => {
    const text = `${scope} ${location || ''}`.toLowerCase()

    const picked = new Set(baseline)

    // Direct evidence: keyword hits in the scope text.
    for (const key of ALL_KEYS) {
      const hits = HAZARD_CATEGORIES[key].keywords.filter((k) => text.includes(k)).length
      if (hits >= minHits) picked.add(key)
    }

    // A "smarter prompt" variant reasons about companion hazards immediately.
    if (useImplications) {
      for (const key of [...picked]) {
        for (const imp of IMPLICATIONS[key] || []) picked.add(imp)
      }
    }

    // Critic feedback from a previous loop iteration.
    for (const h of hints) if (ALL_KEYS.includes(h)) picked.add(h)

    // Cap, highest risk first (mirrors the .slice(0, 8) trim in the real route).
    const ordered = [...picked].sort(
      (a, b) => RISK_RANK[HAZARD_CATEGORIES[b].riskLevel] - RISK_RANK[HAZARD_CATEGORIES[a].riskLevel]
    )
    return ordered.slice(0, maxHazards).map(suggestionFor)
  }

  return { name, generate }
}

/**
 * Real-model seam. Mirrors the system prompt + shape of
 * src/app/api/safety/suggest-hazards/route.ts so the same dataset/grader can
 * score production Sage. Inert unless explicitly opted in.
 */
export function anthropicSage({ model = 'claude-sonnet-4-6' } = {}) {
  const generate = async () => {
    if (process.env.SAGE_EVAL_ONLINE !== '1' || !process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        'anthropicSage is offline by default. Set SAGE_EVAL_ONLINE=1 and ANTHROPIC_API_KEY to grade the real model.'
      )
    }
    // Intentionally not implemented here to keep the harness import-light and
    // offline. To enable: dynamic-import @anthropic-ai/sdk, reuse SYSTEM_PROMPT
    // from the route, parse { hazards: [...] }, and pass `hints` as an extra
    // critique turn. The grader/loop need no changes — that is the point of the
    // generator seam.
    throw new Error('anthropicSage.generate not wired — see comment for the 10-line hookup.')
  }
  return { name: `anthropic:${model}`, generate }
}
