export const meta = {
  name: 'verify-criteria',
  description: 'Adversarially verify roadmap criteria from docs/roadmap/goals.json by id; N-vote panel per criterion, majority rules',
  whenToUse: 'Called by /goal next (votes:1) after implementing a milestone, and by dimension-completion panels (votes:3). args: {ids: ["BE-3", ...], votes?: 1|3}. Model routing is AUTOMATIC — never pass a model in: the literal lens inherits the session model, while the edge-case/regression lenses and the superficial-compliance-prone criteria run on fable. See .claude/skills/goal/SKILL.md "Model routing".',
  phases: [{ title: 'Verify', detail: 'independent skeptics re-run each criterion check' }],
}

// Tolerate args arriving as a JSON-encoded string (harness serialization quirk)
const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args
const ids = (parsedArgs && parsedArgs.ids) || []
const votes = (parsedArgs && parsedArgs.votes) || 1
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

// ── Model routing (automatic — see .claude/skills/goal/SKILL.md) ────────────
// Escalate to fable ONLY where a mistake is terminal: nothing downstream
// re-checks a verifier's verdict, so a rubber-stamp silently converts
// "unknown" into "verified". Mechanical re-runs stay on the session model.
const FABLE = 'fable'

// goals.json.verificationRule: grep-defined criteria "must pair the grep with
// one rendered-output or behavioral spot-check to prevent superficial
// compliance". Those need judgment even on the literal lens — a passing grep
// is exactly the failure mode here (the DS-3 and DS-6 panel dissents both
// found inline styles that evaded a literal grep).
const HIGH_JUDGMENT_IDS = new Set(['DS-3', 'DS-4', 'DS-6', 'BE-8', 'EN-7'])

const LENSES = [
  // Mechanical by construction: execute the check, report its output.
  { model: null, lens: 'literal: run the verify check EXACTLY as written and judge only its output' },
  // Judgment: invent the counterexample the written check cannot express.
  { model: FABLE, lens: 'edge-case: hunt for the counterexample the check would miss (an uncovered route, page, or component that violates the criterion)' },
  // Judgment: distinguish current reality from stale docs/comments.
  { model: FABLE, lens: 'regression: confirm the claim holds at HEAD right now, not in stale docs or comments — trust only current code' },
]

phase('Verify')
log(`Verifying ${ids.length} criteria with ${votes} vote(s) each`)

const results = await parallel(
  ids.map((id) => () =>
    parallel(
      Array.from({ length: votes }, (_, v) => () => {
        const { lens, model } = LENSES[v % LENSES.length]
        // A superficial-compliance-prone criterion earns fable on EVERY lens.
        const routed = HIGH_JUDGMENT_IDS.has(id) ? FABLE : model
        return agent(
          `You are an adversarial verifier in repo /home/user/equipment-qr-hub. Read docs/roadmap/goals.json and locate criterion "${id}" (fields: criterion, verify). Your lens: ${lens}.

Independently determine whether the criterion is MET at the current HEAD:
- Execute the "verify" instruction yourself (read files, run read-only commands: grep, ls, cat, npx tsc --noEmit, npm test -- <file> if named). Do NOT modify anything.
- You are trying to REFUTE the claim that it is met. If you cannot positively confirm it with concrete evidence, return met=false.
- evidence: "path:line — observed fact" for met=true; for met=false, the concrete counterexample or missing artifact.

Return ONLY structured output. If criterion "${id}" does not exist in goals.json, return met=false with evidence "criterion not found".`,
          {
            label: `verify:${id}${votes > 1 ? `#${v + 1}` : ''}${routed ? ':fable' : ''}`,
            phase: 'Verify',
            schema: VERDICT,
            effort: 'high',
            ...(routed ? { model: routed } : {}),
          }
        ).then((verdict) => (verdict ? { ...verdict, model: routed || 'inherit' } : verdict))
      })
    ).then((verdicts) => {
      const valid = verdicts.filter(Boolean)
      const metVotes = valid.filter((x) => x.met).length
      const met = valid.length > 0 && metVotes > valid.length / 2
      return {
        id,
        met,
        votes: valid.map((x) => ({ met: x.met, evidence: x.evidence, model: x.model })),
        // Which tier certified this flip — a 10/10 must be auditable back to it.
        models: valid.map((x) => x.model),
        evidence: (valid.find((x) => x.met === met) || valid[0] || { evidence: 'no verifier returned' }).evidence,
      }
    })
  )
)

return { results: results.filter(Boolean) }
