# Safety-forms sign-off packet — Spanish for the six safety forms

**Status:** awaiting owner counter-signature (gates ONLY the '(beta)' toggle label — the pipeline keeps moving).

Scope: PTP, JHA, incident report, three permits, signature/consent flow, hazard table, gas-alarm guidance, shared form chrome — 491 strings translated by the pipeline (4 batches × 5 adversarial lenses × ≤3 rounds + cross-catalog sweep, workflow wf_ae7b583a-4db; 67 agents).

Outcomes: 486 translated · 5 blocked to exact English per the 3-round termination rule (docs/i18n/blocked-keys.json) · 20 sweep unifications applied.

Per-namespace evidence with final values (hash-anchored by the packet-integrity vitest):

- `docs/i18n/review/ptp.json` — sha256 `34dd09b103a90690…`
- `docs/i18n/review/jha.json` — sha256 `bf033fe218aff521…`
- `docs/i18n/review/incident.json` — sha256 `4fdadbb69b27c44f…`
- `docs/i18n/review/permits.json` — sha256 `d480e0ceaa027261…`
- `docs/i18n/review/signature.json` — sha256 `90a8f1ba482e6bbf…`
- `docs/i18n/review/hazard.json` — sha256 `cc564bd2239a9823…`
- `docs/i18n/review/atmo.json` — sha256 `0a08d3f9c2809fa6…` (evidence from earlier runs)
- `docs/i18n/review/forms.json` — sha256 `66848334a435e7cb…` (evidence from earlier runs)

Counter-sign by setting the safety-forms packet `status: "signed"` + `signedBy`/`signedDate` in `docs/i18n/signoff.json` (or ask Claude).
