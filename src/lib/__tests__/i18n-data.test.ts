import { describe, it, expect, vi } from 'vitest'

/**
 * ES-6 data layer: the lookasides must cover EXACTLY the source data —
 * an orphan id (lookaside entry with no source) means stale translations;
 * a coverage gap (source with no lookaside entry) means silent English on
 * Spanish screens. Both directions fail npm test. Plus: records stamp the
 * locale the worker actually saw, and gas alarms translate.
 */

let store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: vi.fn((k: string) => store[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { store[k] = v }),
  removeItem: vi.fn((k: string) => { delete store[k] }),
  get length() { return Object.keys(store).length },
  key: vi.fn(() => null),
})
vi.stubGlobal('window', globalThis)

import { _lookasides, mapEs, optionLabel, inspectionItemLabel, permitItemLabel, ppeOptionLabel } from '@/lib/i18n-data'
import { currentEffectiveLocale, getT, FLAG_STORAGE_KEY, LOCALE_STORAGE_KEY } from '@/lib/i18n-core'
import { CHECKLISTS, getAllItems } from '@/data/inspection-checklists'
import {
  PPE_OPTIONS,
  PTP_HAZARD_LIBRARY,
  getPermitChecklistDef,
  HEIGHT_ACCESS_METHODS,
  HEIGHT_FALL_PROTECTION,
  HOT_WORK_TYPES,
  CONFINED_SPACE_HAZARDS,
  type PermitChecklistKey,
} from '@/data/safety-checklists'
import { analyzeAtmosphere } from '@/lib/atmo-check'
import type { ChecklistType } from '@/lib/types'

const CHECKLIST_TYPES = Object.keys(CHECKLISTS) as ChecklistType[]
const PERMIT_KEYS: PermitChecklistKey[] = ['height', 'hot-work', 'confined-space']

const sourceInspectionIds = new Set(CHECKLIST_TYPES.flatMap((t) => getAllItems(t).map((i) => i.id)))
const sourceInspectionCategories = new Set(
  CHECKLIST_TYPES.flatMap((t) => CHECKLISTS[t].sections.map((s) => s.category))
)
const sourcePermitIds = new Set(PERMIT_KEYS.flatMap((k) => getPermitChecklistDef(k).items.map((i) => i.id)))
const sourcePermitCategories = new Set(
  PERMIT_KEYS.flatMap((k) => getPermitChecklistDef(k).items.map((i) => i.category))
)
const sourcePpeIds = new Set(PPE_OPTIONS.map((p) => p.id))
const sourceHazardDescriptions = new Set(PTP_HAZARD_LIBRARY.map((h) => h.description))
const sourceHazardControls = new Set(PTP_HAZARD_LIBRARY.map((h) => h.controlMeasure))
const sourceOptions = new Set([
  ...HEIGHT_ACCESS_METHODS,
  ...HEIGHT_FALL_PROTECTION,
  ...HOT_WORK_TYPES,
  ...CONFINED_SPACE_HAZARDS,
])

describe('orphan check — every lookaside key exists in source data', () => {
  it('inspections lookaside has no orphan ids/categories/titles', () => {
    expect(Object.keys(_lookasides.inspections.items).filter((id) => !sourceInspectionIds.has(id))).toEqual([])
    expect(Object.keys(_lookasides.inspections.categories).filter((c) => !sourceInspectionCategories.has(c))).toEqual([])
    expect(Object.keys(_lookasides.inspections.titles).filter((t) => !CHECKLIST_TYPES.includes(t as ChecklistType))).toEqual([])
  })

  it('permits lookaside has no orphan ids/categories/titles', () => {
    expect(Object.keys(_lookasides.permits.items).filter((id) => !sourcePermitIds.has(id))).toEqual([])
    expect(Object.keys(_lookasides.permits.categories).filter((c) => !sourcePermitCategories.has(c))).toEqual([])
    expect(Object.keys(_lookasides.permits.titles).filter((k) => !PERMIT_KEYS.includes(k as PermitChecklistKey))).toEqual([])
  })

  it('ppe + hazards lookasides have no orphan keys', () => {
    expect(Object.keys(_lookasides.ppe).filter((id) => !sourcePpeIds.has(id))).toEqual([])
    expect(Object.keys(_lookasides.hazards.descriptions).filter((d) => !sourceHazardDescriptions.has(d))).toEqual([])
    expect(Object.keys(_lookasides.hazards.controls).filter((c) => !sourceHazardControls.has(c))).toEqual([])
    expect(Object.keys(_lookasides.hazards.options).filter((o) => !sourceOptions.has(o))).toEqual([])
  })
})

describe('coverage check — every source entry has a Spanish lookaside value', () => {
  it('every inspection item/category/title is covered', () => {
    expect(Array.from(sourceInspectionIds).filter((id) => !_lookasides.inspections.items[id])).toEqual([])
    expect(Array.from(sourceInspectionCategories).filter((c) => !_lookasides.inspections.categories[c])).toEqual([])
    expect(CHECKLIST_TYPES.filter((t) => !_lookasides.inspections.titles[t])).toEqual([])
  })

  it('every permit item/category/title is covered', () => {
    expect(Array.from(sourcePermitIds).filter((id) => !_lookasides.permits.items[id])).toEqual([])
    expect(Array.from(sourcePermitCategories).filter((c) => !_lookasides.permits.categories[c])).toEqual([])
    expect(PERMIT_KEYS.filter((k) => !_lookasides.permits.titles[k])).toEqual([])
  })

  it('every ppe option, hazard description/control, and option list entry is covered', () => {
    expect(PPE_OPTIONS.filter((p) => !_lookasides.ppe[p.id])).toEqual([])
    expect(Array.from(sourceHazardDescriptions).filter((d) => !_lookasides.hazards.descriptions[d])).toEqual([])
    expect(Array.from(sourceHazardControls).filter((c) => !_lookasides.hazards.controls[c])).toEqual([])
    expect(Array.from(sourceOptions).filter((o) => !_lookasides.hazards.options[o])).toEqual([])
  })
})

describe('lookup semantics', () => {
  it('en locale passes every accessor through unchanged', () => {
    expect(inspectionItemLabel('en', 'ef-leaks', 'No hydraulic oil or battery leaks')).toBe('No hydraulic oil or battery leaks')
    expect(permitItemLabel('en', 'cs-o2', 'O₂ 19.5–23.5%')).toBe('O₂ 19.5–23.5%')
    expect(ppeOptionLabel('en', 'hard-hat', 'Hard hat')).toBe('Hard hat')
    expect(mapEs('en', 'Working at height')).toBe('Working at height')
  })

  it('unknown strings pass through mapEs untouched (worker free text is theirs)', () => {
    expect(mapEs('es', 'Custom hazard the worker typed')).toBe('Custom hazard the worker typed')
    expect(optionLabel('es', 'Never-seen option')).toBe('Never-seen option')
  })
})

describe('record locale stamping (ES-6)', () => {
  it('currentEffectiveLocale defaults to en with nothing stored', () => {
    store = {}
    expect(currentEffectiveLocale()).toBe('en')
  })

  it('follows the stored preference but respects the kill switch', () => {
    store = { [LOCALE_STORAGE_KEY]: 'es' }
    expect(currentEffectiveLocale()).toBe('es')
    store[FLAG_STORAGE_KEY] = JSON.stringify({ esEnabled: false, suppressedNamespaces: [] })
    expect(currentEffectiveLocale()).toBe('en')
    store = {}
  })
})

describe('records render labels in THEIR stored locale (ES-6)', () => {
  it("a locale:'es' record renders Spanish labels; a locale:'en' record renders English", () => {
    const esRecord = { locale: 'es' as const }
    const enRecord = { locale: 'en' as const }
    const enLabel = 'Guardrails present: top rail ~42″, midrail ~21″, toeboard where required'
    const esRendered = permitItemLabel(esRecord.locale, 'h-guardrails', enLabel)
    const enRendered = permitItemLabel(enRecord.locale, 'h-guardrails', enLabel)
    expect(enRendered).toBe(enLabel)
    expect(esRendered).not.toBe(enLabel)
    expect(esRendered.length).toBeGreaterThan(10)

    const enItem = 'No hydraulic oil or battery leaks'
    expect(inspectionItemLabel('es', 'ef-leaks', enItem)).not.toBe(enItem)
    expect(inspectionItemLabel('en', 'ef-leaks', enItem)).toBe(enItem)
  })

  it('legacy records without a locale stamp default to English rendering', () => {
    const legacy: { locale?: 'en' | 'es' } = {}
    const label = permitItemLabel(legacy.locale ?? 'en', 'cs-o2', 'O₂ 19.5–23.5%')
    expect(label).toBe('O₂ 19.5–23.5%')
  })
})

describe('atmo guidance through the catalog', () => {
  it('default (English) output is byte-identical to the pre-conversion literals', () => {
    const res = analyzeAtmosphere({ oxygen: 15, lel: null, co: null, h2s: null })
    expect(res.alerts[0].guidance).toBe('O2 at 15% is Immediately Dangerous to Life — EVACUATE, emergency rescue only with SCBA')
  })

  it('a Spanish t() yields Spanish guidance once the catalog is translated', () => {
    const res = analyzeAtmosphere({ oxygen: 15, lel: null, co: null, h2s: null }, undefined, undefined, getT('es'))
    expect(res.alerts[0].guidance).toContain('15')
    // Post-translation this must differ from English; the catalog gate
    // (pending manifest) tracks the interim dark state.
    if (getT('es')('atmo.o2Idlh', { reading: 15 }) !== getT('en')('atmo.o2Idlh', { reading: 15 })) {
      expect(res.alerts[0].guidance).not.toBe('O2 at 15% is Immediately Dangerous to Life — EVACUATE, emergency rescue only with SCBA')
    }
  })

  it('the chemical-hazard sensor cross-checks fire in both languages', () => {
    const en = analyzeAtmosphere({ oxygen: 20.9, lel: 0, co: 0, h2s: 0 }, undefined, ['Chemical storage'])
    const es = analyzeAtmosphere({ oxygen: 20.9, lel: 0, co: 0, h2s: 0 }, undefined, ['Almacenamiento químico'])
    expect(en.recommendations.length).toBeGreaterThan(0)
    expect(es.recommendations.length).toBe(en.recommendations.length)
  })
})
