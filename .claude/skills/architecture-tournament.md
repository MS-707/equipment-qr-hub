# /architecture-tournament — Multi-Agent Decision Tournament

Run a structured multi-agent tournament to evaluate an architectural decision before implementation. Ensures holistic coverage by pitting competing approaches against a scored rubric, with adversarial critique and synthesis.

## When to use

Before implementing any feature that touches 5+ files, introduces a new external integration, or changes the data model. The tournament prevents tunnel vision by forcing multiple perspectives and adversarial review before a single line of code is written.

## Input

The invoker provides:
- **Decision**: What architectural choice is being made
- **Context**: Current codebase state, constraints, user requirements
- **Options** (optional): If the user has already narrowed to specific approaches

## UX Success Rubric (agents score 1-5 on each axis)

| # | Axis | What it measures |
|---|------|-----------------|
| 1 | **Field Readiness** | Works reliably on construction sites: offline, intermittent connectivity, shared devices, gloved hands |
| 2 | **Cognitive Load** | How many new concepts/steps the end user must learn; fewer is better |
| 3 | **Time to Value** | How quickly the primary actor gets actionable information after the trigger event |
| 4 | **Audit Completeness** | Every state change leaves a traceable, append-only record |
| 5 | **Graceful Degradation** | What happens when external services are down or not configured; should fail closed to manual workflows |
| 6 | **Integration Friction** | Amount of external setup required (API keys, OAuth apps, webhooks, third-party config) |
| 7 | **Codebase Consistency** | Follows existing patterns (pub/sub, localStorage swap-point, fire-and-forget sync, design tokens) |
| 8 | **Implementation Risk** | Could this break existing functionality; blast radius of changes |

**Scoring**: 40 points max. Ship threshold: 30+. Conditional: 24-29. Reject: below 24.

## Tournament Rounds

### Round 1 — Three Competing Architects (parallel)

Launch 3 agents, each designing a complete implementation plan from a different lens:

| Agent | Lens | Optimization target |
|-------|------|-------------------|
| **Architect A: Minimalist** | Fewest files, simplest path, smallest blast radius | Implementation Risk + Codebase Consistency |
| **Architect B: UX-First** | Best field worker experience, fastest workflows | Field Readiness + Cognitive Load + Time to Value |
| **Architect C: Systems** | Best long-term extensibility, cleanest abstractions | Audit Completeness + Graceful Degradation |

Each agent must:
1. Read the relevant codebase files
2. Produce a concrete plan with: file list, type changes, API specs, UI wireframes (text), migration strategy
3. Self-score on all 8 rubric axes with justification
4. Identify the #1 risk of their own approach

### Round 2 — Adversarial Critics (parallel)

Launch 2 critic agents who have access to all Round 1 proposals:

| Critic | Focus |
|--------|-------|
| **Critic 1: Field Worker Advocate** | Scores each proposal on axes 1-3 (Field Readiness, Cognitive Load, Time to Value). Tests: "Can a worker in PPE with wet gloves use this?" "What happens when the tower crane blocks cell signal?" |
| **Critic 2: Code Guardian** | Scores each proposal on axes 4-8 (Audit, Degradation, Friction, Consistency, Risk). Tests: "Does this break existing flows?" "What's the rollback story?" "How many env vars?" |

Each critic:
1. Independently scores all 3 proposals on their axes
2. Flags specific concerns with file:line references
3. Identifies which elements from each proposal should be cherry-picked into the winner

### Round 3 — Synthesis Judge (sequential)

Launch 1 agent that receives all proposals + all critiques:

1. Produces a final merged plan taking the best elements from each proposal
2. Resolves any conflicts between critic recommendations
3. Scores the merged plan on all 8 axes
4. Outputs an ordered implementation queue with dependencies
5. Lists explicit acceptance criteria (testable statements)

### Round 4 — Final Gate (user confirmation)

Present the synthesized plan to the user with:
- The merged plan summary
- Score breakdown vs rubric
- Key trade-offs that were made
- What was rejected and why
- Estimated implementation time

User approves, modifies, or rejects before any code is written.

## Execution Template

```
Step 1: Establish rubric context (the decision + constraints)
Step 2: Launch 3 Architect agents in parallel (Round 1)
Step 3: Collect proposals, format for critics
Step 4: Launch 2 Critic agents in parallel (Round 2)
Step 5: Collect critiques, launch Synthesis Judge (Round 3)
Step 6: Present final plan to user (Round 4 — gate)
Step 7: On approval, execute implementation queue
```

Total agents: 6 (3 + 2 + 1). Expected wall-clock time: ~10-15 minutes for rounds 1-3.
