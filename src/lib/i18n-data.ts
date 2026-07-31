/**
 * Data lookasides (ES-6, docs/i18n/DESIGN.md): Spanish for CONTENT that lives
 * in src/data — checklist items, permit checklists, PPE options, the PTP
 * hazard library — without touching the source data or its schema.
 *
 * Two shapes:
 * - Id-keyed (inspections/permits/ppe): stable ids exist, so labels are
 *   looked up at RENDER time; stored records keep ids and re-render in the
 *   record's own locale.
 * - Exact-string keyed via mapEs() (hazard library, permit option lists):
 *   no ids exist, so translation happens at INSERTION time — the stored
 *   record value becomes the language the worker chose, which is correct
 *   because records carry a locale stamp.
 *
 * Files live under src/messages/data (NEVER src/data — DM-2 grep scope).
 * All accessors take the locale explicitly: components pass useLocale()'s
 * value so React re-renders on change; lib code passes the record's stamp.
 */

import inspectionsEs from '@/messages/data/inspections.es.json'
import permitsEs from '@/messages/data/permits.es.json'
import ppeEs from '@/messages/data/ppe.es.json'
import hazardsEs from '@/messages/data/hazards.es.json'
import type { Locale } from '@/lib/i18n-core'

type IdMap = Record<string, string>
type ChecklistLookaside = { titles: IdMap; categories: IdMap; items: IdMap }

const inspections = inspectionsEs as ChecklistLookaside
const permits = permitsEs as ChecklistLookaside
const ppe = ppeEs as IdMap
const hazards = hazardsEs as { descriptions: IdMap; controls: IdMap; options: IdMap }

function pick(locale: Locale, map: IdMap, key: string, en: string): string {
  if (locale !== 'es') return en
  return map[key] ?? en
}

// ── Id-keyed render-time lookups ─────────────────────────────

export function inspectionItemLabel(locale: Locale, id: string, en: string): string {
  return pick(locale, inspections.items, id, en)
}
export function inspectionCategory(locale: Locale, en: string): string {
  return pick(locale, inspections.categories, en, en)
}
export function inspectionTitle(locale: Locale, type: string, en: string): string {
  return pick(locale, inspections.titles, type, en)
}

export function permitItemLabel(locale: Locale, id: string, en: string): string {
  return pick(locale, permits.items, id, en)
}
export function permitCategory(locale: Locale, en: string): string {
  return pick(locale, permits.categories, en, en)
}
export function permitTitle(locale: Locale, key: string, en: string): string {
  return pick(locale, permits.titles, key, en)
}

export function ppeOptionLabel(locale: Locale, id: string, en: string): string {
  return pick(locale, ppe, id, en)
}

// ── Exact-string insertion-time mapping (id-less data) ───────

/**
 * Translate an id-less data string (hazard description/control, permit
 * option) at insertion time. Unknown strings pass through unchanged — a
 * worker's custom hazard text is already in their own words.
 */
export function mapEs(locale: Locale, s: string): string {
  if (locale !== 'es') return s
  return hazards.descriptions[s] ?? hazards.controls[s] ?? hazards.options[s] ?? s
}

/** Render-time variant for option CHIPS (selected values are stored English
 *  on legacy/en records; chips still display the viewer-locale label). */
export function optionLabel(locale: Locale, en: string): string {
  if (locale !== 'es') return en
  return hazards.options[en] ?? en
}

// Exposed for the orphan-id/coverage vitest only.
export const _lookasides = { inspections, permits, ppe, hazards }
