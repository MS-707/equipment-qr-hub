const SAGE_FAQ: Array<{ patterns: string[]; answer: string }> = [
  {
    patterns: ['start', 'ptp', 'pre-task', 'pretask', 'begin', 'get started'],
    answer: 'Go to Safety → Pre-Task Plans to start a new PTP. You\'ll need your scope of work, crew list, and hazard assessment ready.',
  },
  {
    patterns: ['incident', 'report', 'injury', 'accident', 'hurt', 'near miss'],
    answer: 'Go to Safety → Incident Report. For serious injuries, call 911 first, then report in the app. Cal/OSHA requires notification within 8 hours for serious injuries — call 1-866-627-3233.',
  },
  {
    patterns: ['permit', 'height', 'fall', 'harness', 'tie-off', 'anchor'],
    answer: 'For work above 6 feet, you need a Work-at-Height Permit. Go to Safety → Permits → Height. Anchor points must be rated ≥5,000 lb per worker (29 CFR 1926.502).',
  },
  {
    patterns: ['hot work', 'weld', 'grind', 'cut', 'torch', 'fire watch'],
    answer: 'Hot work requires a Hot Work Permit. Go to Safety → Permits → Hot Work. Clear combustibles 35 feet around the work area (NFPA 51B). A fire watch must remain 30 minutes after work ends.',
  },
  {
    patterns: ['confined', 'space', 'entry', 'entrant', 'attendant'],
    answer: 'Confined space entry requires a permit. Go to Safety → Permits → Confined Space. Test atmosphere before entry: O₂ must be 19.5–23.5%. Never enter alone — you need an entrant, attendant, and rescue plan.',
  },
  {
    patterns: ['loto', 'lockout', 'tagout', 'lock out', 'tag out', 'energized'],
    answer: 'LOTO (Lock-Out/Tag-Out): De-energize equipment, apply your personal lock and tag, verify zero energy before work. Never remove another worker\'s lock. See 29 CFR 1910.147.',
  },
  {
    patterns: ['ppe', 'protection', 'glasses', 'gloves', 'hard hat', 'helmet', 'boots'],
    answer: 'PPE requirements depend on the task. At minimum: hard hat, safety glasses, steel-toe boots, hi-vis vest. Check your PTP hazard assessment for additional requirements (gloves, hearing protection, respirator, etc.).',
  },
  {
    patterns: ['emergency', '911', 'fire', 'evacuation', 'muster'],
    answer: 'In an emergency: call 911 immediately. Know your site muster point (check your PTP). After the emergency is controlled, report the incident in the app.',
  },
  {
    patterns: ['unsafe', 'stop work', 'refuse', 'right to refuse', 'danger'],
    answer: 'You have the right to stop work if you feel unsafe. Report the concern to your supervisor and safety officer. Document it using the Incident Report form — no one can retaliate for a good-faith safety concern.',
  },
  {
    patterns: ['fatigue', 'tired', 'overtime', 'hours', 'break', 'rest'],
    answer: 'Fatigue increases injury risk. Take breaks every 2 hours, stay hydrated, and alert your crew if you\'re feeling slow. Shifts over 10 hours require extra vigilance. Talk to your foreman about rest scheduling.',
  },
  {
    patterns: ['training', 'certified', 'qualification', 'authorized'],
    answer: 'Check your training status on the Equipment Profile → Training tab. If you\'re not trained on a piece of equipment, do not operate it. Contact your supervisor to schedule training.',
  },
  {
    patterns: ['work order', 'maintenance', 'pm', 'preventive'],
    answer: 'Go to Work Orders to view and manage preventive maintenance tasks. Each equipment item has scheduled PM intervals. Overdue items are flagged in red.',
  },
]

export function matchFaq(query: string): string | null {
  const q = query.toLowerCase()
  for (const entry of SAGE_FAQ) {
    if (entry.patterns.some((p) => q.includes(p))) return entry.answer
  }
  return null
}
