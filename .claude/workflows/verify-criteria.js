export const meta = {
  name: 'verify-criteria',
  description: 'Adversarially verify roadmap criteria from docs/roadmap/goals.json by id; N-vote panel per criterion, majority rules',
  whenToUse: 'Called by /goal next (votes:1) after implementing a milestone, and by dimension-completion panels (votes:3). args: {ids: ["BE-3", ...], votes?: 1|3}',
  phases: [{ title: 'Verify', detail: 'independent skeptics re-run each criterion check' }],
}

const ids = (args && args.ids) || []
const votes = (args && args.votes) || 1
if (!Array.isArray(ids) || ids.length === 0) {
  throw new Error('verify-criteria requires args.ids: a non-empty array of criterion ids from goals.json')
}

const VERDICT = {
  type: 'object',
  required: ['id', 'met', 'evidence'],
  properties: {
    id: { type: 'string' },
    met: { type: 'boolean' },
    evidence: { type: 'string' },
  },
}

const LENSES = [
  'literal: run the verify check EXACTLY as written and judge only its output',
  'edge-case: hunt for the counterexample the check would miss (an uncovered route, page, or component that violates the criterion)',
  'regression: confirm the claim holds at HEAD right now, not in stale docs or comments — trust only current code',
]

phase('Verify')
log(`Verifying ${ids.length} criteria with ${votes} vote(s) each`)

const results = await parallel(
  ids.map((id) => () =>
    parallel(
      Array.from({ length: votes }, (_, v) => () =>
        agent(
          `You are an adversarial verifier in repo /home/user/equipment-qr-hub. Read docs/roadmap/goals.json and locate criterion "${id}" (fields: criterion, verify). Your lens: ${LENSES[v % LENSES.length]}.

Independently determine whether the criterion is MET at the current HEAD:
- Execute the "verify" instruction yourself (read files, run read-only commands: grep, ls, cat, npx tsc --noEmit, npm test -- <file> if named). Do NOT modify anything.
- You are trying to REFUTE the claim that it is met. If you cannot positively confirm it with concrete evidence, return met=false.
- evidence: "path:line — observed fact" for met=true; for met=false, the concrete counterexample or missing artifact.

Return ONLY structured output. If criterion "${id}" does not exist in goals.json, return met=false with evidence "criterion not found".`,
          { label: `verify:${id}${votes > 1 ? `#${v + 1}` : ''}`, phase: 'Verify', schema: VERDICT, effort: 'high' }
        )
      )
    ).then((verdicts) => {
      const valid = verdicts.filter(Boolean)
      const metVotes = valid.filter((x) => x.met).length
      const met = valid.length > 0 && metVotes > valid.length / 2
      return {
        id,
        met,
        votes: valid.map((x) => ({ met: x.met, evidence: x.evidence })),
        evidence: (valid.find((x) => x.met === met) || valid[0] || { evidence: 'no verifier returned' }).evidence,
      }
    })
  )
)

return { results: results.filter(Boolean) }
