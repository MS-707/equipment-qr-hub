export const meta = {
  name: 'rescore',
  description: 'Re-score all roadmap dimensions against the frozen rubrics in docs/roadmap/goals.json',
  whenToUse: 'Called by /goal review after big merges or on demand; returns per-dimension per-criterion verdicts for the caller to apply to goals.json. Runs on fable — widest blast radius in the harness with no downstream gate, since /goal review rewrites scores directly. Apply met=false verdicts immediately (fail-safe); treat met=true verdicts on a stored-false criterion as a PROPOSAL that must clear an adversarial panel before it flips.',
  phases: [{ title: 'Rescore', detail: 'one skeptic per dimension re-runs all 10 criterion checks' }],
}

// args unused today; kept parse-tolerant for future filters (harness may pass a JSON string)
const DIMS = ['ux', 'design', 'backend', 'enterprise', 'demo', 'legal', 'spanish']

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
log(`Re-scoring all ${DIMS.length} dimensions (${DIMS.length * 10} criteria) against frozen rubrics on fable`)

const results = await parallel(
  DIMS.map((dim) => () =>
    agent(
      `You are an adversarial re-scorer in repo /home/user/equipment-qr-hub. Read docs/roadmap/goals.json and locate the dimension with key "${dim}". For EVERY one of its 10 criteria, independently determine met/unmet at current HEAD:
- Execute each criterion's "verify" instruction yourself (read files, run read-only commands: grep, ls, cat, npx tsc --noEmit). Do NOT modify anything.
- Ignore the stored met flag entirely — you are detecting both regressions and unrecorded progress.
- Default skeptical: unconfirmable = met=false.
- evidence per criterion: "path:line — observed fact" (met) or the concrete gap (unmet). Under 200 chars each.
- notes: anything material the roadmap runner should know (regressions found, flaky checks).
- Label each evidence string as either a REGRESSION (stored met=true, you found unmet) or UNRECORDED PROGRESS (stored met=false, you found met). Unrecorded progress is a PROPOSAL only — an adversarial panel re-verifies it before it flips, so do not soften your standard to grant one.

Return ONLY structured output with all 10 criteria for dimension "${dim}".`,
      { label: `rescore:${dim}:fable`, phase: 'Rescore', schema: DIM_RESULT, effort: 'high', model: 'fable' }
    )
  )
)

return { results: results.filter(Boolean) }
