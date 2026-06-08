# Sage eval + loop harness

A small, **offline, zero-dependency** demonstration of the framework Andrej
Karpathy describes as *"I don't write prompts, I write loops."* It's built
around this repo's own Sage hazard-suggestion feature, using the real
`PTP_HAZARD_LIBRARY` taxonomy as ground truth.

Runs with bare `node` (≥18). No network, no API key, no install:

```bash
node evals/sage/run-evals.mjs   # single-shot ("a prompt") vs. looped, scored
node evals/sage/meta-loop.mjs   # a loop that searches loop designs and ranks them
```

## The idea, in one ladder

1. **Write code** — specify every step.
2. **Write a prompt** — describe the outcome once; inspect the one-shot result;
   re-word; re-run. *You* are the loop. Quality is capped by your wording.
3. **Write a loop** — author a *harness*: generate → check → refine, iterating
   without you in the seat. You stop tuning wording and start defining **what
   "good" means** and **how the cycle corrects itself**.
4. **Write loops that design loops** — a meta-loop searches over loop/prompt
   designs and keeps the winner by score, not taste.

The scarce human work moves from *authoring content* to *authoring the verifier
and the iteration*. That's the whole shift.

## What's here (the three moving parts of any loop)

| Part | File | Role |
|------|------|------|
| **Reward / dataset** | `dataset.mjs` | Labeled PTP scenarios. The part only a domain expert authors — your value lives here. |
| **Verifier / grader** | `grader.mjs` | recall · precision · F1 over hazard categories + a hard penalty for missed *critical* hazards → one score in [0,1]. |
| **Generator** | `generators.mjs` | The swappable "model": an offline rule-based stub, plus the inert seam where real Sage (`/api/safety/suggest-hazards`) plugs in. |
| **Loop** | `loop.mjs` | generate → critique (domain rules) → refine → repeat to fixpoint. |
| **Meta-loop** | `meta-loop.mjs` | searches generator/loop configs, ranks by dataset score. |
| **Taxonomy** | `taxonomy.mjs` | the 16 hazard categories (mirrors `src/data/safety-checklists.ts`) + companion-hazard implication rules. |

## Honest-loop discipline (why the result means anything)

The **critic** inside the loop never sees the answer key. It reasons only from
domain rules — e.g. *"working at height ⇒ you also have dropped-object and
exclusion-zone exposure"* — the same kind of knowledge baked into Sage's system
prompt. The **grader** holds the labels but only *observes*; it never feeds the
refinement. So when the looped score rises, it's because the loop genuinely
recovered hazards a naive single shot missed — not because it peeked.

Typical run (`run-evals.mjs`):

```
single-shot  score 0.519   recall 0.418   precision 0.850   crit-miss 1
looped       score 0.697   recall 0.750   precision 0.740   crit-miss 1
Δ score +0.178   Δ recall +0.332
```

## The most important line on the board

`conveyor-weld` ("weld and grind brackets onto an **existing** conveyor") keeps
its **critical miss** (`electrical`) through every iteration. That is the
headline lesson, not a defect:

> **A loop can only recover what its verifier/critic knows.** The critic has no
> rule connecting hot work on live equipment to electrical isolation (LOTO), so
> no amount of looping invents it.

Fixing it is a one-line edit to `IMPLICATIONS` in `taxonomy.mjs`
(`hotwork → electrical`) — i.e. you improve the *system*, not a prompt, and the
score board tells you whether it helped. That edit-the-verifier move is the
actual day-to-day of "writing loops."

## Improving the rubric over time (the meta-loop on the verifier)

The inner loop's ceiling is the rubric, so the real question is how the *rubric*
gets smarter. You can't improve a verifier from inside its own loop (circular) —
it takes a signal more "real" than the rubric: reviewer overrides and near-misses.
This is that meta-loop, running offline and surfaced as a Slack digest:

```bash
node evals/sage/weekly-rubric-review.mjs
```

It mines `override-log.mjs`, drafts candidate amendments, **regression-tests each
against the eval set**, and writes a Slack message (Block Kit JSON + a text
preview) to `out/`. The regression test is the guardrail — a rule is only offered
if it raises the score with no per-scenario regression. A human still approves.

| File | Role |
|------|------|
| `override-log.mjs` | reviewer overrides + near-misses — the external signal |
| `rubric-meta.mjs` | mine pairs → propose rule → regression-test → recommend/flag/reject |
| `slack-digest.mjs` | render Block Kit + text; inert `postToSlack` seam |
| `weekly-rubric-review.mjs` | the scheduled agent; writes the digest to `out/` |

Sample run, showing all four decision paths:

```
✅  Hot work / fire ⇒ also flag Electrical / energized parts
     evidence : 3 signals — e.g. override-add on "Weld brackets onto a live conveyor frame"
     impact   : +0.032 score, fixes critical miss on [conveyor-weld], no regressions
     action   : [ Approve ]   [ Dismiss ]
🚫  Electrical ⇒ Noise            — no net improvement on the eval set   (regression gate)
🚫  PIT ⇒ Public                  — already in rubric                   (dedup)
🚫  Confined space ⇒ Pressure     — only 1 occurrence (need 2)          (support threshold)
```

The repeated-signal pair (`hotwork ⇒ electrical`) is exactly the gap the conveyor
scenario exposed above — here it's recovered automatically *from the field*,
gated by regression, ready for one-tap human approval. Approving = appending one
line to `IMPLICATIONS` and re-running the evals. Stays local/offline until you
set `SAGE_SLACK_ONLINE=1` + `SLACK_BOT_TOKEN`.

## How this maps to the three altitudes at work

- **In the product (Sage):** wrap the existing one-shot route in this
  generate→critique→refine loop so it self-checks hazards against your OSHA-mapped
  taxonomy before showing them. Plug real Sage in via `anthropicSage` —
  the grader and loop need zero changes (that's the point of the generator seam).
- **In how you build:** the same shape is `implement → typecheck/lint/test → fix
  → repeat`. The missing rung in this repo is a test command + this eval set.
- **The meta-loop:** once labels exist, stop hand-tuning prompts — search
  variants and ship the winner by score.

## Extending it

- Add anonymized real PTPs to `dataset.mjs`. Label disagreements among reviewers
  are the highest-signal work you can do — that argument *is* the reward design.
- Add/adjust `IMPLICATIONS` rules as your team's review heuristics get sharper.
- Wire `anthropicSage.generate` (≈10 lines; see the comment) and set
  `SAGE_EVAL_ONLINE=1` + `ANTHROPIC_API_KEY` to grade the real model on the same
  dataset. Until then everything stays local and offline by design.
