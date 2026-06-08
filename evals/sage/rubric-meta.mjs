/**
 * The rubric meta-loop — improving the VERIFIER over time.
 *
 *   mine the log → draft candidate amendments → REGRESSION-TEST each against the
 *   eval set → keep only those that improve score without regressing → hand the
 *   survivors to a human to approve.
 *
 * The regression test is the crucial guardrail: a proposed rule is only worth
 * offering if, when added to the rubric and the whole dataset is re-run, the
 * aggregate score goes UP and no individual scenario gets WORSE. That stops the
 * rubric from drifting on noisy signal (and is why a human still approves —
 * the eval set screens, the expert decides).
 */

import { IMPLICATIONS, HAZARD_CATEGORIES } from './taxonomy.mjs'
import { SCENARIOS } from './dataset.mjs'
import { makeStubSage } from './generators.mjs'
import { aggregate } from './grader.mjs'
import { runLoop } from './loop.mjs'
import { OVERRIDE_LOG } from './override-log.mjs'

const MIN_SUPPORT = 2 // how many independent log entries before a pair is a candidate

// Literal generator: the critic's implication rules (the rubric) are what we're
// testing, so the generator must not do its own implication expansion.
const generator = makeStubSage({ name: 'literal', minHits: 1, useImplications: false, maxHazards: 7 })

/** Run the whole dataset under a given rubric (implications map). */
export function evaluateRubric(implications) {
  const perScenario = SCENARIOS.map((sc) => {
    const r = runLoop(sc, generator, { implications }).final
    return { id: sc.id, score: r.score, criticalMisses: r.criticalMisses.length }
  })
  return { agg: aggregate(perScenario.map((p) => ({ ...p, recall: 0, precision: 0, f1: 0 }))), perScenario }
}

function clone(impl) {
  return Object.fromEntries(Object.entries(impl).map(([k, v]) => [k, [...v]]))
}

/** Mine the log for repeated (trigger ⇒ should) pairs not already in the rubric. */
export function mineCandidates(log = OVERRIDE_LOG, base = IMPLICATIONS) {
  const groups = new Map() // "trigger>should" -> { trigger, should, evidence[] }
  for (const e of log) {
    if (!e.trigger || !e.should) continue
    const key = `${e.trigger}>${e.should}`
    if (!groups.has(key)) groups.set(key, { trigger: e.trigger, should: e.should, evidence: [] })
    groups.get(key).evidence.push(e)
  }

  const candidates = []
  for (const g of groups.values()) {
    const already = (base[g.trigger] || []).includes(g.should)
    const support = g.evidence.length
    if (already) {
      g.skipReason = 'already in rubric'
    } else if (support < MIN_SUPPORT) {
      g.skipReason = `only ${support} occurrence (need ${MIN_SUPPORT})`
    }
    candidates.push({ ...g, support, already })
  }
  return candidates.sort((a, b) => b.support - a.support)
}

/** Build a proposal per minable pair: amendment text + regression evidence. */
export function proposeAmendments(log = OVERRIDE_LOG, base = IMPLICATIONS) {
  const baseEval = evaluateRubric(base)
  const candidates = mineCandidates(log, base)
  const proposals = []

  for (const c of candidates) {
    const ruleText = `${HAZARD_CATEGORIES[c.trigger].description} ⇒ also flag ${HAZARD_CATEGORIES[c.should].description}`

    if (c.skipReason) {
      proposals.push({
        id: c.evidence[0].id, trigger: c.trigger, should: c.should, ruleText,
        support: c.support, evidence: c.evidence, status: 'skipped', reason: c.skipReason,
      })
      continue
    }

    // Regression test: add the rule, re-run the whole dataset.
    const candidate = clone(base)
    candidate[c.trigger] = [...(candidate[c.trigger] || []), c.should]
    const candEval = evaluateRubric(candidate)

    const deltaScore = candEval.agg.score - baseEval.agg.score
    const regressed = candEval.perScenario.filter((p, i) => p.score < baseEval.perScenario[i].score)
    const criticalFixed = baseEval.perScenario.filter(
      (p, i) => candEval.perScenario[i].criticalMisses < p.criticalMisses
    )

    let status, reason
    if (deltaScore <= 1e-9) {
      status = 'reject'; reason = 'no net improvement on the eval set'
    } else if (regressed.length > 0) {
      status = 'flag'; reason = `improves overall (+${deltaScore.toFixed(3)}) but regresses ${regressed.map((r) => r.id).join(', ')}`
    } else {
      status = 'recommend'; reason = `+${deltaScore.toFixed(3)} score, no regressions`
    }

    proposals.push({
      id: c.evidence[0].id, trigger: c.trigger, should: c.should, ruleText,
      support: c.support, evidence: c.evidence,
      deltaScore, regressed: regressed.map((r) => r.id),
      criticalFixed: criticalFixed.map((r) => r.id),
      baseScore: baseEval.agg.score, candScore: candEval.agg.score,
      status, reason,
    })
  }

  return { baseEval, proposals }
}
