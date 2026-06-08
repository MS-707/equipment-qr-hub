/**
 * Grader — THE VERIFIER. Karpathy's point: the bottleneck isn't prompting, it's
 * defining "good" cheaply and reliably. This file is that definition.
 *
 * gradeOne() scores one set of suggestions against one labeled scenario:
 *   - structural validity (valid risk level + a non-empty control measure),
 *     mirroring the filter in the production route
 *   - recall / precision / F1 over hazard CATEGORIES (not exact wording)
 *   - a hard penalty for any missed CRITICAL hazard
 *
 * The single `score` in [0,1] is what the loop and meta-loop optimize. Tune the
 * weights to match how your safety team actually trades off misses vs. noise.
 */

import { classify } from './taxonomy.mjs'

const VALID_RISK = new Set(['low', 'medium', 'high', 'critical'])

function structurallyValid(s) {
  return (
    s &&
    typeof s.description === 'string' && s.description.trim().length > 0 &&
    typeof s.controlMeasure === 'string' && s.controlMeasure.trim().length > 0 &&
    VALID_RISK.has(s.riskLevel)
  )
}

export function gradeOne(scenario, suggestions) {
  const valid = (suggestions || []).filter(structurallyValid)
  const structuralOk = valid.length === (suggestions || []).length

  const predicted = new Set(valid.map((s) => classify(s.description)).filter(Boolean))
  const expected = new Set(scenario.expected)
  const critical = new Set(scenario.critical || [])

  const hit = [...expected].filter((k) => predicted.has(k))
  const missed = [...expected].filter((k) => !predicted.has(k))
  const extra = [...predicted].filter((k) => !expected.has(k))
  const criticalMisses = [...critical].filter((k) => !predicted.has(k))

  const recall = expected.size ? hit.length / expected.size : 1
  const precision = predicted.size ? hit.length / predicted.size : 1
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0

  // Composite score: recall-leaning (in safety, a miss hurts more than noise),
  // gated hard by critical misses and lightly by malformed output.
  let score = 0.7 * recall + 0.3 * precision
  score -= 0.5 * criticalMisses.length // each missed critical is near-fatal
  if (!structuralOk) score -= 0.1
  score = Math.max(0, Math.min(1, score))

  return {
    id: scenario.id,
    score,
    recall,
    precision,
    f1,
    structuralOk,
    hit,
    missed,
    extra,
    criticalMisses,
    predicted: [...predicted],
  }
}

export function aggregate(results) {
  const n = results.length || 1
  const mean = (sel) => results.reduce((a, r) => a + sel(r), 0) / n
  return {
    n: results.length,
    score: mean((r) => r.score),
    recall: mean((r) => r.recall),
    precision: mean((r) => r.precision),
    f1: mean((r) => r.f1),
    criticalMisses: results.reduce((a, r) => a + r.criticalMisses.length, 0),
    structuralFails: results.filter((r) => !r.structuralOk).length,
  }
}
