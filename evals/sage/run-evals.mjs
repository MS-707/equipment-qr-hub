/**
 * Scoreboard runner. Demonstrates the core claim: a generate→critique→refine
 * LOOP beats the same generator run once (a single "prompt"), measured by an
 * independent grader on a fixed dataset.
 *
 *   node evals/sage/run-evals.mjs
 *
 * Compares, on every scenario:
 *   - single-shot: generator.generate(...) once   (the "I write prompts" world)
 *   - looped:      runLoop(...) to fixpoint        (the "I write loops" world)
 */

import { SCENARIOS } from './dataset.mjs'
import { makeStubSage } from './generators.mjs'
import { gradeOne, aggregate } from './grader.mjs'
import { runLoop } from './loop.mjs'

// A deliberately literal generator: fires only on direct keyword evidence, no
// companion-hazard reasoning. This is the realistic "naive prompt" baseline —
// the loop's critique step is what recovers the implied hazards.
const sage = makeStubSage({ name: 'literal-stub', minHits: 1, useImplications: false, maxHazards: 7 })

const singleResults = []
const loopResults = []

console.log('\n  Sage hazard-suggestion eval — single-shot vs. looped')
console.log('  generator:', sage.name)
console.log('  ' + '─'.repeat(64))
console.log(
  '  ' +
    'scenario'.padEnd(22) +
    'single→looped score'.padEnd(24) +
    'recovered (critic)'
)
console.log('  ' + '─'.repeat(64))

for (const sc of SCENARIOS) {
  const single = gradeOne(sc, sage.generate(sc.scopeOfWork, sc.location))
  const loop = runLoop(sc, sage)
  singleResults.push(single)
  loopResults.push(loop.final)

  const recovered = loop.final.hit.filter((k) => !single.hit.includes(k))
  const arrow = `${single.score.toFixed(2)} → ${loop.final.score.toFixed(2)}`
  const crit = loop.final.criticalMisses.length ? '  ⚠ crit-miss' : ''
  console.log(
    '  ' +
      sc.id.padEnd(22) +
      arrow.padEnd(24) +
      (recovered.length ? recovered.join(', ') : '—') +
      crit
  )
}

const a0 = aggregate(singleResults)
const a1 = aggregate(loopResults)

console.log('  ' + '─'.repeat(64))
const row = (label, a) =>
  `  ${label.padEnd(12)} score ${a.score.toFixed(3)}   recall ${a.recall.toFixed(3)}   ` +
  `precision ${a.precision.toFixed(3)}   crit-miss ${a.criticalMisses}`
console.log(row('single-shot', a0))
console.log(row('looped', a1))
console.log(
  `\n  Δ score ${(a1.score - a0.score >= 0 ? '+' : '')}${(a1.score - a0.score).toFixed(3)}` +
    `   Δ recall ${(a1.recall - a0.recall >= 0 ? '+' : '')}${(a1.recall - a0.recall).toFixed(3)}` +
    `   critical misses ${a0.criticalMisses} → ${a1.criticalMisses}\n`
)
