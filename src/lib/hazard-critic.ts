/**
 * Rule-based hazard critic for the generate→critique→refine loop.
 *
 * Ported from evals/sage/taxonomy.mjs and evals/sage/loop.mjs.
 * The critic uses domain implication rules (not eval labels) to detect
 * likely gaps in a hazard suggestion set. A senior safety reviewer
 * applies the same reasoning: "working at height ⇒ dropped objects".
 */

interface HazardSuggestion {
  description: string
  riskLevel: string
  controlMeasure: string
}

const HAZARD_KEYWORDS: Record<string, string[]> = {
  height: ['height', 'elevated', 'mezzanine', 'scissor', 'boom lift', 'mewp', 'scaffold', 'ladder', 'roof', 'overhead steel', 'rack', 'catwalk'],
  dropped: ['dropped', 'falling object', 'tool drop', 'overhead work'],
  pinch: ['pinch', 'crush', 'mating', 'assemble', 'bolt up', 'shuttle', 'actuator', 'moving part'],
  lifting: ['lift', 'crane', 'rigging', 'hoist', 'suspended', 'sling', 'forklift lift', 'set steel'],
  pit: ['forklift', 'pallet jack', 'reach truck', 'mobile plant', 'powered industrial truck', 'pit', 'agv'],
  electrical: ['electrical', 'energized', 'panel', 'wiring', 'voltage', 'loto', 'lockout', 'control cabinet', 'busbar', 'vfd'],
  hotwork: ['weld', 'cut', 'torch', 'grind', 'braze', 'solder', 'hot work', 'spark', 'plasma'],
  confined: ['confined', 'tank', 'vessel', 'pit entry', 'silo', 'duct', 'manhole', 'sump'],
  manual: ['manual handling', 'lifting boxes', 'carry', 'ergonomic', 'repetitive', 'awkward posture'],
  slips: ['slip', 'trip', 'housekeeping', 'cable', 'cords', 'wet floor', 'clutter'],
  noise: ['noise', 'loud', 'grinding', 'impact tool', 'genset'],
  silica: ['silica', 'dust', 'fume', 'concrete', 'cutting concrete', 'sanding', 'welding fume', 'anchor drill'],
  heat: ['heat', 'outdoor', 'summer', 'hot weather', 'high temp'],
  pressure: ['pressur', 'pneumatic', 'hydraulic', 'compressed air', 'accumulator', 'air line'],
  cuts: ['sharp', 'edge', 'blade', 'knife', 'sheet metal', 'banding', 'deburr'],
  public: ['public', 'traffic', 'vehicle', 'roadway', 'pedestrian', 'loading dock', 'yard'],
}

const HAZARD_DESCRIPTIONS: Record<string, string> = {
  height: 'working at height',
  dropped: 'falling / dropped objects',
  pinch: 'pinch / crush points',
  lifting: 'overhead loads / lifting',
  pit: 'powered industrial trucks / mobile plant',
  electrical: 'electrical / energized parts',
  hotwork: 'hot work / fire',
  confined: 'confined space',
  manual: 'manual handling / ergonomics',
  slips: 'slips, trips & falls',
  noise: 'noise',
  silica: 'silica / dust / fumes',
  heat: 'heat illness',
  pressure: 'pressurized systems',
  cuts: 'sharp edges / cuts',
  public: 'public / vehicle interface',
}

const IMPLICATIONS: Record<string, string[]> = {
  height: ['dropped', 'slips'],
  lifting: ['dropped', 'pinch'],
  pit: ['public', 'pinch'],
  hotwork: ['silica', 'cuts'],
  confined: ['silica', 'electrical'],
  electrical: ['pinch'],
}

function classify(description: string): string | null {
  const text = description.toLowerCase()
  for (const [key, desc] of Object.entries(HAZARD_DESCRIPTIONS)) {
    if (text.includes(desc)) return key
  }
  for (const [key, keywords] of Object.entries(HAZARD_KEYWORDS)) {
    if (keywords.some((k) => text.includes(k))) return key
  }
  return null
}

export interface CritiqueResult {
  hints: string[]
  notes: string[]
}

export function critique(suggestions: HazardSuggestion[]): CritiqueResult {
  const present = new Set(
    suggestions.map((s) => classify(s.description)).filter((k): k is string => k !== null)
  )
  const hints = new Set<string>()
  const notes: string[] = []
  Array.from(present).forEach((key) => {
    for (const imp of IMPLICATIONS[key] ?? []) {
      if (!present.has(imp)) {
        hints.add(imp)
        notes.push(`'${key}' present → also expect '${imp}'`)
      }
    }
  })
  return { hints: Array.from(hints), notes }
}

export function hintDescriptions(hints: string[]): string[] {
  return hints
    .map((h) => HAZARD_DESCRIPTIONS[h])
    .filter((d): d is string => !!d)
}
