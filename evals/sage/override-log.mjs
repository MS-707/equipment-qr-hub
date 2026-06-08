/**
 * Override + near-miss log — the EXTERNAL signal that improves the rubric.
 *
 * A verifier can't improve from inside its own loop (that's circular). The
 * rubric only gets smarter from signals more "real" than itself:
 *
 *   - override-add : a reviewer manually ADDED a hazard Sage didn't suggest
 *                    (the loop, given the current rubric, missed it)
 *   - near-miss    : reality showed a hazard that should have been on the plan
 *
 * Each entry names the `trigger` (the hazard that was present / central to the
 * job) and the hazard that `should` have come with it. Repeated pairs are
 * evidence of a missing rule. This is just your lessons-learned / CAPA stream,
 * structured so a meta-loop can turn it into rubric amendments.
 *
 * In production this would be read from the Safety Hub's accept/reject events
 * and the incident module. Here it's a small hand-written sample.
 */

export const OVERRIDE_LOG = [
  // Strong, repeated signal: hot work on EXISTING/energized equipment keeps
  // getting an electrical (LOTO) hazard added by reviewers. 3 independent jobs.
  { id: 'ov-101', date: '2026-05-12', kind: 'override-add', trigger: 'hotwork', should: 'electrical',
    by: 'M. Starr', job: 'Weld brackets onto a live conveyor frame' },
  { id: 'ov-118', date: '2026-05-19', kind: 'near-miss', trigger: 'hotwork', should: 'electrical',
    by: 'EHS', job: 'Cutting on an energized rack upright — arc observed, no injury' },
  { id: 'ov-126', date: '2026-05-28', kind: 'override-add', trigger: 'hotwork', should: 'electrical',
    by: 'J. Lee', job: 'Grinding near an open control panel' },

  // Weaker, plausibly spurious signal: noise added on a couple of electrical jobs.
  // The regression gate will decide whether this earns a rule.
  { id: 'ov-130', date: '2026-05-30', kind: 'override-add', trigger: 'electrical', should: 'noise',
    by: 'J. Lee', job: 'VFD commissioning next to a running genset' },
  { id: 'ov-141', date: '2026-06-03', kind: 'override-add', trigger: 'electrical', should: 'noise',
    by: 'M. Starr', job: 'Panel terminations in a loud plant room' },

  // Already covered by the rubric (pit ⇒ public) — the miner should skip it.
  { id: 'ov-150', date: '2026-06-04', kind: 'override-add', trigger: 'pit', should: 'public',
    by: 'EHS', job: 'Reach-truck work near a pedestrian door' },

  // Single occurrence — below support threshold, should NOT become a rule yet.
  { id: 'ov-151', date: '2026-06-05', kind: 'near-miss', trigger: 'confined', should: 'pressure',
    by: 'EHS', job: 'Sump entry near a charged hydraulic line' },
]
