/**
 * The loop. This is the thing Karpathy says he writes instead of prompts.
 *
 * generate → critique → refine → repeat, until the critic stops finding gaps
 * (a fixpoint) or we hit the iteration budget. The human authored the STRUCTURE
 * and the critic's rules; the content is produced and corrected inside the loop.
 *
 * Honest-loop discipline: the critic NEVER sees the eval labels. It reasons from
 * domain rules (taxonomy IMPLICATIONS + structural checks) — the same knowledge
 * encoded in Sage's system prompt. The grader (which DOES hold labels) only
 * observes; it does not feed the refinement. That separation is what makes a
 * subsequent score improvement meaningful rather than circular.
 */

import { IMPLICATIONS } from './taxonomy.mjs'
import { classify } from './taxonomy.mjs'
import { gradeOne } from './grader.mjs'

/**
 * Domain critic. Returns category keys it believes are likely missing, based on
 * companion-hazard rules — not on the answer key.
 */
export function critique(suggestions, implications = IMPLICATIONS) {
  const present = new Set((suggestions || []).map((s) => classify(s.description)).filter(Boolean))
  const hints = new Set()
  const notes = []
  for (const key of present) {
    for (const imp of implications[key] || []) {
      if (!present.has(imp)) {
        hints.add(imp)
        notes.push(`'${key}' present → also expect '${imp}'`)
      }
    }
  }
  return { hints: [...hints], notes }
}

/**
 * Run the loop for one scenario.
 * @returns trace with per-iteration suggestions, critic notes, and (observed) grade.
 */
export function runLoop(scenario, generator, { maxIters = 4, implications } = {}) {
  const trace = []
  let hints = []

  for (let i = 0; i < maxIters; i++) {
    const suggestions = generator.generate(scenario.scopeOfWork, scenario.location, { hints })
    const grade = gradeOne(scenario, suggestions) // observation only
    const { hints: newHints, notes } = critique(suggestions, implications)

    trace.push({ iter: i, suggestions, grade, criticNotes: notes })

    // Stop at fixpoint: critic surfaced nothing the loop hasn't already added.
    const unresolved = newHints.filter((h) => !hints.includes(h))
    if (unresolved.length === 0) break
    hints = [...new Set([...hints, ...newHints])]
  }

  return {
    id: scenario.id,
    iterations: trace.length,
    first: trace[0].grade,
    final: trace[trace.length - 1].grade,
    trace,
  }
}
