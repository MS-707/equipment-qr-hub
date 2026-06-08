/**
 * The meta-loop: a loop that designs loops.
 *
 *   node evals/sage/meta-loop.mjs
 *
 * You stop hand-tuning the generator config (the "prompt") and instead define
 * the search space + the scoreboard, then let iteration pick the winner. Here
 * the search space is a handful of generator configs; the reward is the
 * dataset-wide looped score from grader.mjs. The output is the config you would
 * ship — chosen by evidence, not by taste.
 *
 * This is a tiny, legible stand-in for the real thing: the same pattern scales
 * to searching over actual prompt variants, model choices, temperature, or
 * scaffold shapes — as long as the grader and dataset hold still.
 */

import { SCENARIOS } from './dataset.mjs'
import { makeStubSage } from './generators.mjs'
import { aggregate } from './grader.mjs'
import { runLoop } from './loop.mjs'

// The candidate "loop designs" the meta-loop searches over.
const CANDIDATES = [
  { name: 'literal',            minHits: 1, useImplications: false, baseline: [],                maxHazards: 7 },
  { name: 'literal+baseline',   minHits: 1, useImplications: false, baseline: ['slips', 'manual'], maxHazards: 7 },
  { name: 'eager (minHits=2)',  minHits: 2, useImplications: false, baseline: [],                maxHazards: 7 },
  { name: 'implications-on',    minHits: 1, useImplications: true,  baseline: [],                maxHazards: 7 },
  { name: 'impl+baseline',      minHits: 1, useImplications: true,  baseline: ['slips'],          maxHazards: 8 },
]

function evaluateConfig(cfg) {
  const sage = makeStubSage(cfg)
  const finals = SCENARIOS.map((sc) => runLoop(sc, sage).final)
  return aggregate(finals)
}

console.log('\n  Meta-loop — searching generator/loop designs by dataset score\n')
console.log(
  '  ' +
    'config'.padEnd(22) +
    'score'.padEnd(9) +
    'recall'.padEnd(9) +
    'prec'.padEnd(9) +
    'crit-miss'
)
console.log('  ' + '─'.repeat(60))

const ranked = CANDIDATES.map((cfg) => ({ cfg, agg: evaluateConfig(cfg) })).sort(
  (a, b) => b.agg.score - a.agg.score
)

for (const { cfg, agg } of ranked) {
  console.log(
    '  ' +
      cfg.name.padEnd(22) +
      agg.score.toFixed(3).padEnd(9) +
      agg.recall.toFixed(3).padEnd(9) +
      agg.precision.toFixed(3).padEnd(9) +
      String(agg.criticalMisses)
  )
}

const winner = ranked[0]
console.log('  ' + '─'.repeat(60))
console.log(
  `\n  → ship: "${winner.cfg.name}"  (score ${winner.agg.score.toFixed(3)}, ` +
    `${winner.agg.criticalMisses} critical misses across ${SCENARIOS.length} scenarios)\n`
)
console.log('  config:', JSON.stringify(winner.cfg), '\n')
