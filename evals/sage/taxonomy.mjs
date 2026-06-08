/**
 * Sage eval taxonomy — the machine-checkable ground truth the loop steers toward.
 *
 * The 16 categories below mirror PTP_HAZARD_LIBRARY in
 * src/data/safety-checklists.ts. That file is the product source of truth; this
 * is a dependency-free ESM copy so the harness runs under bare `node` with no
 * TypeScript toolchain and no network. If you edit the library, re-sync here
 * (or, later, generate this file from the TS source in a build step).
 *
 * Each category adds two things the product library does not need but the loop
 * does:
 *   - `keywords`     — let the grader map free-text model output back to a
 *                      canonical category, and let the offline stub generator
 *                      derive hazards from a scope-of-work string.
 *   - IMPLICATIONS   — domain rules a senior safety reviewer applies in their
 *                      head ("working at height ⇒ you also have dropped-object
 *                      and exclusion-zone exposure"). The runtime critic uses
 *                      these to push the loop forward WITHOUT ever seeing the
 *                      eval labels — see loop.mjs.
 */

export const RISK_RANK = { low: 1, medium: 2, high: 3, critical: 4 }

/** key → canonical hazard. description/riskLevel/controlMeasure match the library. */
export const HAZARD_CATEGORIES = {
  height: {
    description: 'Working at height',
    riskLevel: 'high',
    controlMeasure: 'Guardrails / 100% tie-off; pre-use MEWP inspection; exclusion zone below',
    keywords: ['height', 'elevated', 'mezzanine', 'scissor', 'boom lift', 'mewp', 'scaffold', 'ladder', 'roof', 'overhead steel', 'rack', 'catwalk'],
  },
  dropped: {
    description: 'Falling / dropped objects',
    riskLevel: 'medium',
    controlMeasure: 'Tool tethers; toe-boards; barricade and signage below',
    keywords: ['dropped', 'falling object', 'tool drop', 'overhead work'],
  },
  pinch: {
    description: 'Pinch / crush points',
    riskLevel: 'medium',
    controlMeasure: 'Hands clear of mating surfaces; cut-resistant gloves; tag lines on loads',
    keywords: ['pinch', 'crush', 'mating', 'assemble', 'bolt up', 'shuttle', 'actuator', 'moving part'],
  },
  lifting: {
    description: 'Overhead loads / lifting',
    riskLevel: 'high',
    controlMeasure: 'Certified rigging; never under suspended loads; spotter/signaler',
    keywords: ['lift', 'crane', 'rigging', 'hoist', 'suspended', 'sling', 'forklift lift', 'set steel'],
  },
  pit: {
    description: 'Powered industrial trucks / mobile plant',
    riskLevel: 'high',
    controlMeasure: 'Pre-trip inspection; pedestrian separation; spotter in tight areas',
    keywords: ['forklift', 'pallet jack', 'reach truck', 'mobile plant', 'powered industrial truck', 'pit', 'agv'],
  },
  electrical: {
    description: 'Electrical / energized parts',
    riskLevel: 'high',
    controlMeasure: 'LOTO; verify de-energized; qualified person; insulated tools',
    keywords: ['electrical', 'energized', 'panel', 'wiring', 'voltage', 'loto', 'lockout', 'control cabinet', 'busbar', 'vfd'],
  },
  hotwork: {
    description: 'Hot work / fire',
    riskLevel: 'high',
    controlMeasure: 'Hot work permit; fire watch; extinguisher; clear combustibles 35 ft',
    keywords: ['weld', 'cut', 'torch', 'grind', 'braze', 'solder', 'hot work', 'spark', 'plasma'],
  },
  confined: {
    description: 'Confined space',
    riskLevel: 'critical',
    controlMeasure: 'Entry permit; atmospheric testing; attendant; rescue plan',
    keywords: ['confined', 'tank', 'vessel', 'pit entry', 'silo', 'duct', 'manhole', 'sump'],
  },
  manual: {
    description: 'Manual handling / ergonomics',
    riskLevel: 'low',
    controlMeasure: 'Team lift; mechanical aids; size up load before lifting',
    keywords: ['manual handling', 'lifting boxes', 'carry', 'ergonomic', 'repetitive', 'awkward posture'],
  },
  slips: {
    description: 'Slips, trips & falls',
    riskLevel: 'low',
    controlMeasure: 'Housekeeping; cable management; mark/clear hazards',
    keywords: ['slip', 'trip', 'housekeeping', 'cable', 'cords', 'wet floor', 'clutter'],
  },
  noise: {
    description: 'Noise',
    riskLevel: 'low',
    controlMeasure: 'Hearing protection in posted zones',
    keywords: ['noise', 'loud', 'grinding', 'impact tool', 'genset'],
  },
  silica: {
    description: 'Silica / dust / fumes',
    riskLevel: 'medium',
    controlMeasure: 'Wet methods / LEV; appropriate respirator; rotate tasks',
    keywords: ['silica', 'dust', 'fume', 'concrete', 'cutting concrete', 'sanding', 'welding fume', 'anchor drill'],
  },
  heat: {
    description: 'Heat illness',
    riskLevel: 'medium',
    controlMeasure: 'Water, shade, rest breaks; high-heat procedures (T8 §3395)',
    keywords: ['heat', 'outdoor', 'summer', 'hot weather', 'high temp'],
  },
  pressure: {
    description: 'Pressurized systems',
    riskLevel: 'high',
    controlMeasure: 'Depressurize / isolate; verify zero energy; PPE',
    keywords: ['pressur', 'pneumatic', 'hydraulic', 'compressed air', 'accumulator', 'air line'],
  },
  cuts: {
    description: 'Sharp edges / cuts',
    riskLevel: 'low',
    controlMeasure: 'Cut-resistant gloves; edge protection; safe blade handling',
    keywords: ['sharp', 'edge', 'blade', 'knife', 'sheet metal', 'banding', 'deburr'],
  },
  public: {
    description: 'Public / vehicle interface',
    riskLevel: 'medium',
    controlMeasure: 'Traffic control; barriers; hi-vis; flaggers as needed',
    keywords: ['public', 'traffic', 'vehicle', 'roadway', 'pedestrian', 'loading dock', 'yard'],
  },
}

export const ALL_KEYS = Object.keys(HAZARD_CATEGORIES)

/**
 * Domain implication rules. "If hazard A is present, a competent reviewer also
 * expects B." The runtime critic (loop.mjs) applies these to flag likely gaps.
 * These are NOT the eval labels — they are general safety knowledge, the same
 * way Sage's system prompt encodes OSHA references.
 */
export const IMPLICATIONS = {
  height: ['dropped', 'slips'],
  lifting: ['dropped', 'pinch'],
  pit: ['public', 'pinch'],
  hotwork: ['silica', 'cuts'],
  confined: ['silica', 'electrical'],
  electrical: ['pinch'],
  silica: ['noise'],
}

/** Map a free-text hazard description back to a canonical key, or null. */
export function classify(description) {
  const text = String(description || '').toLowerCase()
  // Exact-ish: canonical description substring wins.
  for (const [key, cat] of Object.entries(HAZARD_CATEGORIES)) {
    if (text.includes(cat.description.toLowerCase())) return key
  }
  // Otherwise fall back to keyword hit.
  for (const [key, cat] of Object.entries(HAZARD_CATEGORIES)) {
    if (cat.keywords.some((k) => text.includes(k))) return key
  }
  return null
}

/** Build a suggestion object for a category key (canonical control measure). */
export function suggestionFor(key) {
  const c = HAZARD_CATEGORIES[key]
  return { description: c.description, riskLevel: c.riskLevel, controlMeasure: c.controlMeasure }
}
