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
8. **Model routing is policy, not preference.** Never pass a model to a workflow
   or subagent ad hoc. The default is the session model; only the roles
   enumerated in *Model routing* below run on `fable`. Adding a role to that
   list is a rubric-grade change — it goes in `goals.json.log` with its
   justification, same as a criterion reword.

## Model routing

The session model is the default. Escalate to `fable` **only where a mistake is
terminal** — where nothing downstream re-checks the work. Blanket escalation is
not the safe choice; it just burns budget on agents whose errors a gate would
have caught anyway.

**Runs on `fable`** (no gate above it):

| Role | Why |
| --- | --- |
| Dimension-panel edge-case + regression lenses (votes 2 and 3) | The panel is the only thing making 10/10 mean anything. A rubber-stamp converts "unknown" into a false "verified". |
| Any verifier for a **superficial-compliance-prone** criterion (`DS-3`, `DS-4`, `DS-6`, `BE-8`, `EN-7`) | `goals.json.verificationRule` requires pairing the grep with a behavioral check. A passing grep *is* the failure mode — both the DS-3 and DS-6 dissents found inline styles that evaded one. |
| `rescore.js` dimension re-scorer | Widest blast radius in the harness: `/goal review` applies its verdicts directly, in both directions. |
| Glossary / terminology-foundation authoring | Ground truth every downstream lens checks against — nothing above it to catch an error. |
| Safety-drift review lens (blind back-translation + semantic diff) | The lens that caught the real hazards: a respirator downgraded to a surgical mask, a dropped PFAS qualifier, a bare alarm word colliding with a risk level. |
| Platform-contract authoring: D1 migration pairs, and the Worker identity/authorization boundary | A wrong `sql_down` is a data-loss event no vitest sees; a wrong `appRole`/`isManager` check is a silent privilege bug. |
| Rubric-change adjudication (the rail-3 exception) | The one action that moves a score without moving code. |

**Inherits the session model** (a gate catches its mistakes): milestone
implementers and per-task subagents (lint · tsc · test · build · adversarial
verify all sit downstream); gate-repair agents (the gate is the oracle);
string extractors and component converters (tsc on generated key types, the
eslint ratchet, and the dark-invariance pins catch drift); translation
generators (five review lenses downstream); the panel's literal lens (execute
the check, report the output); documentation and report writers (a human or a
later verifier reads them before anything acts).

`verify-criteria.js` and `rescore.js` implement this themselves — call them
with no model argument and the routing happens.

## `/goal` (no args) — Status

Read goals.json and print: a scoreboard (dimension, verified score /10, Δ since
initial), the active/next milestone, blocked items with reasons, gate status
from the last log entry, and total iterations run. No side effects.

## `/goal next` — One iteration (the /loop workhorse)

1. **Preflight.** `git status` must be clean (stash-and-warn if not); confirm
   branch per rail 5; `git pull origin <branch>` (tolerate no-upstream on first
   run). If `node_modules` is missing (fresh container/clone), run
   `npm ci --no-audit --no-fund` before anything else. Read goals.json.
   **Capability check:** if the milestone you are about to pick belongs to the
   `kin` dimension, confirm the Kin MCP tools (`kin_create_app`, `kin_deploy`,
   …) are actually reachable. If they are not, **STOP immediately** — do not
   start the milestone, do not scaffold around the gap, and under /loop do not
   reschedule. Report exactly this to the user: register the Kin MCP with
   `claude mcp add kin --transport http https://api.mkin.app/mcp` (or add it to
   the project's `.mcp.json`), then re-run. A Kin milestone attempted without
   its tools burns an iteration and leaves half-built scaffolding behind.
2. **Terminal check.** If every dimension has `verifiedScore: 10` → run the
   *Completion protocol* below and END (under /loop: do not schedule another
   wakeup; state plainly that the loop is complete).
3. **Pick work.** The first milestone in `goals.json.order` whose status is
   `in_progress`, else the first `pending` one, skipping `blocked` and
   `parked`. **`parked` is a deliberate owner deferral, not a failure** — never
   un-park a milestone on your own initiative, and never treat one as remaining
   work in a completion check. If nothing is left but `blocked` and `parked` →
   summarize both sets for the user and END the loop (do not reschedule).
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
   - Preferred: `Workflow({scriptPath: ".claude/workflows/verify-criteria.js", args: {ids: [...], votes: 1}})`
     (scriptPath, not name — the named-workflow registry can serve a stale
     cached copy; args must be a real JSON object, though the script also
     tolerates a JSON-encoded string).
   - Fallback (no Workflow tool): one Agent-tool subagent per criterion,
     mirroring *Model routing* by hand — the literal lens inherits; use
     `model: 'fable'` for DS-3/DS-4/DS-6/BE-8/EN-7 and for panel votes 2-3.
   - Last resort (no subagents at all, e.g. bare CLI): verify yourself in a
     separate pass — re-run every `verify` command literally and paste the
     command + output into the log entry as evidence.
   Only criteria the verifier confirms flip to `met: true` (record `verifiedBy`,
   `verifiedAtIteration`, evidence). A refuted criterion keeps its milestone
   `in_progress` with the refutation reason logged.
7. **Dimension completion panel.** When a dimension's met-count first reaches
   10: run a 3-vote adversarial panel per previously-flipped criterion
   (`verify-criteria` with `votes: 3`, majority rules). Survivors →
   `verifiedScore: 10`, dimension `done`. The panel runs 1 literal vote on the
   session model and 2 judgment lenses on `fable` (the workflow routes this
   itself). Record the certifying tier in `verifiedBy` — a 10/10 must be
   auditable back to the tier that granted it. Refuted criteria flip back and reopen
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

Re-score all 70 criteria (7 dimensions x 10) against the frozen rubrics without implementing
anything: run `Workflow({scriptPath: ".claude/workflows/rescore.js"})`
(fallback: one Agent-tool subagent per dimension). Apply results in BOTH directions — regressions flip
criteria back to unmet and reopen their milestones (append `log[]` entry
`rescore`). Update scores, REVIEW doc addendum, commit, push, print scoreboard.
Run this after big merges from main or when the user doubts the numbers.

## `/goal verify <DIM|criterion-id>` — Verification only

Run the verification panel (votes: 3) for one criterion or a whole dimension
and report verdicts with evidence. No implementation, but persist any flips it
proves (both directions) and push.

## Completion protocol

When every dimension in goals.json is `verifiedScore: 10`: run the full gate suite once
more, `/goal review` one final time as a global audit, then announce completion
with the final scoreboard and the full iteration count, suggest the user open a
PR (do not open it yourself), and end the loop.

## Blockers needing a human

Some criteria may require production env vars, real devices, or user decisions
(flagged `needsHuman: true` in goals.json). Never fake these. Batch them in
your report under "Needs you", with the smallest possible ask (e.g. "set
RESEND_API_KEY in Vercel → unblocks LG-4 verification").
