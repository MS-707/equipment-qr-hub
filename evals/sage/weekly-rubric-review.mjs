/**
 * The scheduled agent. This is the thing you'd run on a timer (cron, the /loop
 * skill, or a CI schedule) so the rubric improves itself without anyone digging
 * through files.
 *
 *   node evals/sage/weekly-rubric-review.mjs
 *
 * It mines the override/near-miss log, drafts rubric amendments, regression-tests
 * each against the eval set, and writes a Slack digest (Block Kit JSON + a
 * text preview) to evals/sage/out/. Offline: it renders the message instead of
 * posting it. Flip postToSlack() on when you want it to land in a channel.
 *
 * Your only job is the 30-second decision in Slack: Approve or Dismiss.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { proposeAmendments } from './rubric-meta.mjs'
import { buildBlocks, renderText } from './slack-digest.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, 'out')
mkdirSync(outDir, { recursive: true })

const { baseEval, proposals } = proposeAmendments()
const blocks = buildBlocks(proposals)
const text = renderText(proposals)

writeFileSync(join(outDir, 'rubric-digest.blocks.json'), JSON.stringify({ blocks }, null, 2))
writeFileSync(join(outDir, 'rubric-digest.txt'), text + '\n')

console.log('\n' + text + '\n')
console.log('─'.repeat(60))
console.log(`current rubric score: ${baseEval.agg.score.toFixed(3)} over ${baseEval.perScenario.length} scenarios`)
console.log('wrote:')
console.log('  evals/sage/out/rubric-digest.txt          (eyeball preview)')
console.log('  evals/sage/out/rubric-digest.blocks.json  (Slack Block Kit payload)')
console.log('\nOffline: nothing posted. Approving a rule = appending it to')
console.log('IMPLICATIONS in taxonomy.mjs (one line), then re-running the evals.\n')
