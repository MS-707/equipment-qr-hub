/**
 * Strip regulatory citations from text before displaying to workers.
 * Removes OSHA/Cal-OSHA codes, CFR/CCR references, and section numbers
 * while preserving the practical safety content.
 */
export function stripRegCitations(text: string): string {
  return text
    .replace(/\b(per|per\s+)?(OSHA|Cal[\-\/]?OSHA|Cal\/OSHA)\b[\s\d\w./§\-]*/gi, '')
    .replace(/\bper\b\s+\d[\d.\-]*/g, '')
    .replace(/\b(29\s*CFR|T8\s*CCR|CCR|CFR|NFPA|ANSI|ASME)\b[\s\d.§/\-]*/gi, '')
    .replace(/§\s*\d[\d.\-]*/g, '')
    .replace(/\([\s,;]*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s,;.\-]+([.;])/g, '$1')
    .trim()
}
