# Translation pipeline — generation, adversarial review, termination

Binding process for every Spanish catalog batch (docs/i18n/DESIGN.md §pipeline
is the architecture; this file is the operating rule the tests enforce).

## Flow per namespace batch (≤50 strings)

1. **Generate** — the translating agent receives: the glossary
   (`docs/i18n/glossary.json`, mandated terms + register rules + forbidden
   variants), the HEAD-extracted English catalog values, and each string's
   render context. It must preserve `{var}` sets exactly and produce
   `.one`/`.other` variants wherever English has them.
2. **Review — five independent lenses**, fresh context each, per batch:
   `terminology` (glossary compliance), `register` (usted, imperative,
   ≤6th-grade), `regional` (neutral LatAm, no Iberian forms),
   `consistency` (one en term → one es term across the whole catalog),
   `safety-drift` (blind back-translation diffed against the source; negation
   flips, dropped conditions, softened imperatives = automatic FAIL).
3. **Regenerate** any FAILing key and re-run all five lenses on it.
4. **Evidence** — `docs/i18n/review/<namespace>.json` records, per key: the es
   value, five verdicts, and reviewer notes. The milestone verifier asserts
   the file exists, covers exactly the namespace's key set, and contains zero
   FAILs.

## Termination rule (the 3-round cap)

A key that still FAILs any lens after **3 generate→review rounds** stops
consuming pipeline time:

- Its es value is set to the **exact English source string** (safe fallback —
  never a best-effort translation that failed review).
- It is logged in `docs/i18n/blocked-keys.json`:
  `{ "key", "namespace", "reason", "failedLenses", "rounds": 3, "date" }`.
- `blocked-keys.json` is size-capped at **20 entries** (tests enforce). More
  than that means the glossary or the generator is broken — fix the tool, not
  the list.

A blocked key must then take exactly ONE of two documented paths:

1. **Block exposure**: its namespace ships suppressed (kill-switch
   `suppressedNamespaces`) until the key is fixed, or
2. **Documented leakage**: the key is added to the es-leakage spec's sentinel
   allowlist (`e2e/es-leakage-allowlist.json`) with a justification, so the
   English string is a *known, asserted* exception on Spanish screens.

Never both, never neither — the i18n-pipeline-rules vitest fails if a blocked
key is missing from both lists or present in both.

## Sign-off (asynchronous)

Safety-critical namespaces get a bilingual packet in `docs/i18n/review/` and a
`docs/i18n/signoff.json` entry (`pending` until mark.starr counter-signs).
Sign-off gates ONLY removing the "(beta)" label from the toggle — it never
blocks a milestone (goals.json `autonomyNote`).
