---
name: goal
description: Autonomous roadmap runner for Equipment QR Hub. Reads docs/roadmap/goals.json, executes the next milestone with quality gates and adversarial verification, updates state, commits and pushes. Usage — "/goal" status scoreboard; "/goal next" run one iteration (the /loop workhorse); "/goal review" full re-score of every dimension against the frozen rubrics; "/goal verify <DIM|criterion-id>" verification panel only. Designed to be driven continuously by "/loop /goal next" until every dimension in goals.json verifies 10/10.
---

# /goal — Roadmap Runner

You are executing one step of a long-running, self-verifying improvement loop for
this repository. The single source of truth is **`docs/roadmap/goals.json`**.
The frozen scoring rubrics live in **`docs/roadmap/RUBRICS.md`** (mirrored in
goals.json); the human-readable plan is **`docs/roadmap/ROADMAP.md`**.

Dimensions are scored 0–10, where the score is the **count of met criteria**
out of 10 objective, binary, in-repo-verifiable criteria per dimension. The
dimension list lives in goals.json (currently: `ux`, `design`, `backend`,
`enterprise`, `demo`, `legal`, `spanish`) — always enumerate from the file,
never from memory. **The terminal goal: every dimension in goals.json reaches
a verified 10/10.**

For the `spanish` dimension, `docs/i18n/DESIGN.md` is the binding
implementation spec (architecture, translation pipeline, rollback tiers).
Owner sign-off of translation packets is ASYNCHRONOUS: pending entries in
`docs/i18n/signoff.json` never block a task, milestone, or criterion — the
counter-signature gates only removing the "(beta)" label from the toggle.

## Non-negotiable rails

1. **State is law.** Never trust memory of prior iterations — read
   `docs/roadmap/goals.json` fresh at the start of every invocation.
2. **A criterion flips to `met: true` only via adversarial verification** (see
   *Verification* below) with `path:line` evidence recorded. Never self-certify.
3. **The rubric is frozen.** Do not add, remove, reword, or reinterpret criteria
   to make a score move. Rubric changes happen only in `/goal review` with the
   change and justification appended to `goals.json.log`, or on explicit user
   instruction.
4. **Push every iteration.** The container is ephemeral — unpushed work dies
   with it. Commit + `git push -u origin <branch>` (retry 4× with 2/4/8/16s
   backoff on network failure) before ending the turn.
5. **Branch discipline.** Work on the session's designated `claude/…` branch if
   one is assigned; otherwise create/reuse `claude/roadmap-runner`. Never commit
   to `main`, never force-push, never open a PR unless the user asked.
6. **Scope discipline.** One milestone per iteration (or a coherent subset of
   its tasks). No drive-by refactors outside the milestone's task list.
7. **Report faithfully.** If a gate fails and you can't fix it inside the
   iteration, say so and leave the milestone `in_progress` — never mark done to
   keep the loop moving.

## `/goal` (no args) — Status

Read goals.json and print: a scoreboard (dimension, verified score /10, Δ since
initial), the active/next milestone, blocked items with reasons, gate status
from the last log entry, and total iterations run. No side effects.

## `/goal next` — One iteration (the /loop workhorse)

1. **Preflight.** `git status` must be clean (stash-and-warn if not); confirm
   branch per rail 5; `git pull origin <branch>` (tolerate no-upstream on first
   run). Read goals.json.
2. **Terminal check.** If every dimension has `verifiedScore: 10` → run the
   *Completion protocol* below and END (under /loop: do not schedule another
   wakeup; state plainly that the loop is complete).
3. **Pick work.** The first milestone in `goals.json.order` whose status is
   `in_progress`, else the first `pending` one, skipping `blocked`. If ALL
   remaining are blocked → summarize every blocker for the user and END the
   loop (do not reschedule).
4. **Implement** the milestone's tasks. Sized-one-commit tasks may be committed
   individually. Follow each task's `acceptance` check as the definition of
   done. Prefer boring, test-covered implementations that match existing code
   style; add/extend tests in `src/lib/__tests__` for anything with logic.
5. **Quality gates** — all must pass, in order, before verification:
   ```
   npm run lint
   npx tsc --noEmit
   npm test
   npm run build
   ```
   On failure: fix forward if the cause is your diff; if broken on entry,
   record it in `log[]` and fix it FIRST (a red baseline blocks everything).
   Two consecutive iterations failing on the same task → set the task/milestone
   `blocked` with the error captured in `goals.json`, move on.
6. **Verification (adversarial).** For every criterion the completed tasks
   target, spawn a **fresh, skeptical verifier** that independently runs the
   criterion's `verify` check and must return met/unmet with `path:line`
   evidence — instruct it to *refute* the claim, defaulting to unmet when
   uncertain:
   - Preferred: `Workflow({name: "verify-criteria", args: {ids: [...], votes: 1}})`.
   - Fallback (no Workflow tool): one Agent-tool subagent per criterion.
   - Last resort (no subagents at all, e.g. bare CLI): verify yourself in a
     separate pass — re-run every `verify` command literally and paste the
     command + output into the log entry as evidence.
   Only criteria the verifier confirms flip to `met: true` (record `verifiedBy`,
   `verifiedAtIteration`, evidence). A refuted criterion keeps its milestone
   `in_progress` with the refutation reason logged.
7. **Dimension completion panel.** When a dimension's met-count first reaches
   10: run a 3-vote adversarial panel per previously-flipped criterion
   (`verify-criteria` with `votes: 3`, majority rules). Survivors →
   `verifiedScore: 10`, dimension `done`. Refuted criteria flip back and reopen
   their milestone. This is the quality gate that makes 10/10 mean something.
8. **Record.** Update goals.json: task/milestone statuses, criterion flips,
   `score` = met-count per dimension, append a `log[]` entry
   `{iteration, date, milestone, tasksDone, gates, verified, refuted, notes}`.
   Keep ROADMAP.md's checkboxes in sync.
9. **Commit + push** (rail 4). Conventional message with the milestone id, e.g.
   `feat(backend): BE-M2 durable rate limiting on beta routes`.
10. **Report.** End the turn with: what shipped, gate results, verification
    verdicts, the new scoreboard, and what the next iteration will pick up.

### Loop pacing (when driven by /loop)

- Dynamic mode (`/loop /goal next`): after a successful iteration schedule the
  next wakeup at **60–120s** (continuous execution); after a flaky/external
  wait, 270s; if you just blocked the last available milestone or finished
  everything, **do not reschedule — end the loop with a summary**.
- Fixed mode (`/loop 15m /goal next`): just complete the iteration; the timer
  handles cadence. If an iteration is still running when context resumes,
  finish it before starting another (WIP limit = 1).

## `/goal review` — Full re-score

Re-score all 60 criteria against the frozen rubrics without implementing
anything: run `Workflow({name: "rescore"})` (fallback: 6 Agent-tool subagents,
one per dimension). Apply results in BOTH directions — regressions flip
criteria back to unmet and reopen their milestones (append `log[]` entry
`rescore`). Update scores, REVIEW doc addendum, commit, push, print scoreboard.
Run this after big merges from main or when the user doubts the numbers.

## `/goal verify <DIM|criterion-id>` — Verification only

Run the verification panel (votes: 3) for one criterion or a whole dimension
and report verdicts with evidence. No implementation, but persist any flips it
proves (both directions) and push.

## Completion protocol

When all six dimensions are `verifiedScore: 10`: run the full gate suite once
more, `/goal review` one final time as a global audit, then announce completion
with the final scoreboard and the full iteration count, suggest the user open a
PR (do not open it yourself), and end the loop.

## Blockers needing a human

Some criteria may require production env vars, real devices, or user decisions
(flagged `needsHuman: true` in goals.json). Never fake these. Batch them in
your report under "Needs you", with the smallest possible ask (e.g. "set
RESEND_API_KEY in Vercel → unblocks LG-4 verification").
