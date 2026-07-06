export const meta = {
  name: 'rescore',
  description: 'Re-score all six roadmap dimensions against the frozen rubrics in docs/roadmap/goals.json',
  whenToUse: 'Called by /goal review after big merges or on demand; returns per-dimension per-criterion verdicts for the caller to apply to goals.json',
  phases: [{ title: 'Rescore', detail: 'one skeptic per dimension re-runs all 10 criterion checks' }],
}

const DIMS = ['ux', 'design', 'backend', 'enterprise', 'demo', 'legal']

const DIM_RESULT = {
  type: 'object',
  required: ['dimension', 'criteria'],
  properties: {
    dimension: { type: 'string' },
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'met', 'evidence'],
        properties: {
          id: { type: 'string' },
          met: { type: 'boolean' },
          evidence: { type: 'string' },
        },
      },
    },
    notes: { type: 'string' },
  },
}

phase('Rescore')
log('Re-scoring all 6 dimensions against frozen rubrics')

const results = await parallel(
  DIMS.map((dim) => () =>
    agent(
      `You are an adversarial re-scorer in repo /home/user/equipment-qr-hub. Read docs/roadmap/goals.json and locate the dimension with key "${dim}". For EVERY one of its 10 criteria, independently determine met/unmet at current HEAD:
- Execute each criterion's "verify" instruction yourself (read files, run read-only commands: grep, ls, cat, npx tsc --noEmit). Do NOT modify anything.
- Ignore the stored met flag entirely — you are detecting both regressions and unrecorded progress.
- Default skeptical: unconfirmable = met=false.
- evidence per criterion: "path:line — observed fact" (met) or the concrete gap (unmet). Under 200 chars each.
- notes: anything material the roadmap runner should know (regressions found, flaky checks).

Return ONLY structured output with all 10 criteria for dimension "${dim}".`,
      { label: `rescore:${dim}`, phase: 'Rescore', schema: DIM_RESULT, effort: 'high' }
    )
  )
)

return { results: results.filter(Boolean) }
