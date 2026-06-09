const SAGE_FAQ: Array<{ patterns: string[]; answer: string }> = [
  {
    patterns: ['start', 'ptp', 'pre-task', 'pretask', 'begin', 'get started'],
    answer: 'Go to Safety → Pre-Task Plans to start a new PTP. You\'ll need your scope of work, crew list, and hazard assessment ready.',
  },
  {
    patterns: ['incident', 'report', 'injury', 'accident', 'hurt', 'near miss'],
    answer: 'Go to Safety → Incident Report. For serious injuries, call 911 first, then report in the app. Most jurisdictions require prompt notification for serious injuries — check with your safety officer for local reporting requirements.',
  },
  {
    patterns: ['permit', 'height', 'fall', 'harness', 'tie-off', 'anchor'],
    answer: 'For work above 6 feet, you need a Work-at-Height Permit. Go to Safety → Permits → Height. Anchor points must be rated for the load — check your company\'s fall protection plan for requirements.',
  },
  {
    patterns: ['hot work', 'weld', 'grind', 'cut', 'torch', 'fire watch'],
    answer: 'Hot work requires a Hot Work Permit. Go to Safety → Permits → Hot Work. Clear combustibles from around the work area. A fire watch must remain after work ends per your site plan.',
  },
  {
    patterns: ['confined', 'space', 'entry', 'entrant', 'attendant'],
    answer: 'Confined space entry requires a permit. Go to Safety → Permits → Confined Space. Test the atmosphere before entry: oxygen must be in safe range (19.5–23.5%). Never enter alone — you need an entrant, attendant, and rescue plan.',
  },
  {
    patterns: ['loto', 'lockout', 'tagout', 'lock out', 'tag out', 'energized'],
    answer: 'LOTO (Lock-Out/Tag-Out): De-energize equipment, apply your personal lock and tag, verify zero energy before work. Never remove another worker\'s lock.',
  },
  {
    patterns: ['ppe', 'protection', 'glasses', 'gloves', 'hard hat', 'helmet', 'boots'],
    answer: 'PPE requirements depend on the task and your work area. Check your PTP hazard assessment for specific requirements (safety glasses, gloves, hearing protection, respirator, steel-toe boots, etc.). When in doubt, ask your safety officer.',
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
    answer: 'Fatigue increases injury risk. Take breaks every 2 hours, stay hydrated, and alert your team if you\'re feeling slow. Shifts over 10 hours require extra vigilance. Talk to your supervisor about rest scheduling.',
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
