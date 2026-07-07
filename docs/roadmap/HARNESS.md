# Roadmap Harness — How the Autonomous Improvement Loop Works

One prompt drives this repository from its current state to a verified 10/10
across seven dimensions. This document explains the machinery; the state lives in
`goals.json`, the frozen scoring rubrics in `RUBRICS.md`, the plan in
`ROADMAP.md`, and the operating procedure in `.claude/skills/goal/SKILL.md`.

## The one prompt

```
/loop /goal next
```

Run it in a Claude Code session (web or CLI) opened on this repo. Dynamic
`/loop` lets the agent self-pace: it schedules the next iteration ~60–120s
after each successful one (effectively continuous), backs off when waiting on
something external, and **ends the loop by itself** when every dimension
verifies 10/10 or when all remaining work is blocked on a human. Prefer a fixed
cadence instead? `/loop 15m /goal next`.

## The seven dimensions

| Key | Dimension | 10/10 means |
|-----|-----------|-------------|
| `ux` | UX | All 10 UX criteria in RUBRICS.md verified |
| `design` | Design | All 10 design-system criteria verified |
| `backend` | Backend | All 10 API/data-resilience criteria verified |
| `enterprise` | Enterprise Readiness | All 10 IT-buyer criteria verified |
| `demo` | MVP Demo Readiness | All 10 live-demo criteria verified |
| `legal` | Legal | All 10 in-repo legal-artifact criteria verified |
| `spanish` | Spanish Language Support | All 10 i18n criteria verified (spec: `docs/i18n/DESIGN.md`) |

Scores are **counts, not vibes**: each dimension has exactly 10 binary
criteria, each with a written `verify` check (a command to run or a file fact
to confirm). Score = number of criteria met. The original six rubrics were
authored by six independent reviewer agents, then adversarially audited by six
verifier agents and a cross-dimension critic before being frozen. The `spanish`
rubric was added 2026-07-06 via a 9-agent design tournament over the reverted
June i18n attempt — implementation spec in `docs/i18n/DESIGN.md`.

## The loop, one iteration

```
read goals.json ─► pick next milestone ─► implement tasks
      ─► GATES: npm run lint · npx tsc --noEmit · npm test · npm run build
      ─► VERIFY: fresh adversarial agents re-run each targeted criterion's check
      ─► update goals.json ─► commit ─► push ─► report scoreboard
```

## Quality gates (what keeps the loop honest)

1. **Build gates** — lint, typecheck, full test suite, production build must
   all pass before any verification runs.
2. **Adversarial verification** — a criterion only flips to *met* when a fresh
   agent, instructed to refute it, confirms it with `path:line` evidence
   (`.claude/workflows/verify-criteria.js`).
3. **Dimension completion panel** — the first time a dimension reaches 10/10,
   every criterion faces a 3-vote panel (literal / edge-case / regression
   lenses, majority rules). Refuted criteria flip back and reopen work.
4. **Re-score audits** — `/goal review` re-runs all 60 checks from scratch
   (`.claude/workflows/rescore.js`), catching regressions in both directions.
5. **State + audit log** — every iteration appends to `goals.json.log`;
   every iteration commits and pushes, so progress survives ephemeral
   containers and is reviewable commit-by-commit.

## Manual controls

| Command | Effect |
|---------|--------|
| `/goal` | Scoreboard + next milestone, no side effects |
| `/goal next` | Exactly one iteration |
| `/goal review` | Full 60-criterion re-score, applied both directions |
| `/goal verify BE-3` | 3-vote verification panel for one criterion |
| `/goal verify backend` | Panel for a whole dimension |

## Things the loop will never do

Commit to `main`, force-push, open a PR unprompted, reword a rubric criterion
to make a score move, mark work done when a gate is red, or fake a criterion
that needs production env vars or a human decision (those get batched under
"Needs you" in the iteration report).
