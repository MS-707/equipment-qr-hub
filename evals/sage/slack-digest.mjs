/**
 * Slack digest renderer. Turns rubric proposals into:
 *   1. a Slack Block Kit payload (exactly what would be POSTed to a channel),
 *   2. a plain-text preview so you can eyeball it without Slack.
 *
 * Approve/Dismiss are real Block Kit buttons; their action_id + value are what a
 * Slack interactivity endpoint would receive to apply or discard the amendment.
 * postToSlack() is the live seam — inert offline by design.
 */

const EMOJI = { recommend: '✅', flag: '⚠️', reject: '🚫', skipped: '⏸️' }

export function buildBlocks(proposals) {
  const recommend = proposals.filter((p) => p.status === 'recommend')
  const flag = proposals.filter((p) => p.status === 'flag')
  const filtered = proposals.filter((p) => p.status === 'reject' || p.status === 'skipped')

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: `🦺 Sage rubric — weekly review` } },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `${recommend.length} ready to approve · ${flag.length} flagged · ${filtered.length} auto-filtered by the regression check` }],
    },
    { type: 'divider' },
  ]

  const proposalBlock = (p) => {
    const ev = p.evidence[0]
    const evLine = `${p.support} signals — e.g. _${ev.kind}_ on "${ev.job}" (${ev.date})`
    const impact = p.criticalFixed?.length
      ? `*+${p.deltaScore.toFixed(3)}* score · fixes critical miss on \`${p.criticalFixed.join(', ')}\` · no regressions`
      : `*+${p.deltaScore.toFixed(3)}* score · no regressions`
    return [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `${EMOJI[p.status]} *${p.ruleText}*\n${evLine}\n${p.status === 'flag' ? `⚠️ ${p.reason}` : impact}` },
      },
      {
        type: 'actions',
        elements: [
          { type: 'button', style: 'primary', text: { type: 'plain_text', text: 'Approve' }, action_id: 'approve_rule', value: p.id },
          { type: 'button', text: { type: 'plain_text', text: 'Dismiss' }, action_id: 'dismiss_rule', value: p.id },
        ],
      },
    ]
  }

  for (const p of [...recommend, ...flag]) blocks.push(...proposalBlock(p))

  if (filtered.length) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: '🚫 *Filtered (no action needed):* ' +
          filtered.map((p) => `${p.ruleText} — _${p.reason}_`).join(' · '),
      }],
    })
  }
  return blocks
}

export function renderText(proposals) {
  const lines = ['🦺  SAGE RUBRIC — WEEKLY REVIEW', '═'.repeat(60), '']
  const show = proposals.filter((p) => p.status === 'recommend' || p.status === 'flag')
  if (!show.length) lines.push('No amendments ready for approval this week.')
  for (const p of show) {
    lines.push(`${EMOJI[p.status]}  ${p.ruleText}`)
    const ev = p.evidence[0]
    lines.push(`     evidence : ${p.support} signals — e.g. ${ev.kind} on "${ev.job}" (${ev.date})`)
    if (p.status === 'recommend') {
      const fix = p.criticalFixed?.length ? `, fixes critical miss on [${p.criticalFixed.join(', ')}]` : ''
      lines.push(`     impact   : +${p.deltaScore.toFixed(3)} score${fix}, no regressions`)
    } else {
      lines.push(`     impact   : ${p.reason}`)
    }
    lines.push('     action   : [ Approve ]   [ Dismiss ]')
    lines.push('')
  }
  const filtered = proposals.filter((p) => p.status === 'reject' || p.status === 'skipped')
  if (filtered.length) {
    lines.push('─'.repeat(60))
    lines.push('Filtered by the regression/support check (no action needed):')
    for (const p of filtered) lines.push(`   🚫 ${p.ruleText} — ${p.reason}`)
  }
  return lines.join('\n')
}

/**
 * Live seam. Inert unless explicitly opted in, so offline runs never post.
 * To enable: dynamic-import @slack/web-api, channel from env, blocks from
 * buildBlocks(), and add an interactivity endpoint that maps approve_rule /
 * dismiss_rule action_ids to a taxonomy.IMPLICATIONS edit + eval re-run.
 */
export async function postToSlack(blocks) {
  if (process.env.SAGE_SLACK_ONLINE !== '1' || !process.env.SLACK_BOT_TOKEN) {
    throw new Error('postToSlack is offline by default. Set SAGE_SLACK_ONLINE=1 + SLACK_BOT_TOKEN to post for real.')
  }
  throw new Error('postToSlack not wired — see comment for the hookup.')
}
