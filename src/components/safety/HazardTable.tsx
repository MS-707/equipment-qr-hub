'use client'

import { Plus, X } from 'lucide-react'
import type { HazardEntry, RiskLevel } from '@/lib/safety-types'
import { RISK_COLORS, RISK_LABELS } from '@/lib/safety-types'
import { PTP_HAZARD_LIBRARY } from '@/data/safety-checklists'
import { cryptoRandomId } from '@/lib/safety-records'
import { useLocale, useT } from '@/lib/i18n'
import { mapEs } from '@/lib/i18n-data'

interface HazardTableProps {
  hazards: HazardEntry[]
  onChange: (hazards: HazardEntry[]) => void
}

const RISK_LEVELS: RiskLevel[] = ['low', 'medium', 'high', 'critical']

export default function HazardTable({ hazards, onChange }: HazardTableProps) {
  const t = useT()
  const { locale } = useLocale()
  function update(id: string, patch: Partial<HazardEntry>) {
    onChange(hazards.map((h) => (h.id === id ? { ...h, ...patch, source: (patch.description || patch.controlMeasure) ? 'manual' : h.source } : h)))
  }

  function remove(id: string) {
    onChange(hazards.filter((h) => h.id !== id))
  }

  function addBlank() {
    onChange([
      ...hazards,
      { id: cryptoRandomId(), description: '', riskLevel: 'medium', controlMeasure: '', addedBy: null, source: 'manual' },
    ])
  }

  function addTemplate(tpl: (typeof PTP_HAZARD_LIBRARY)[number]) {
    // Insertion-time translation (ES-6): the stored record carries the
    // language the worker chose; the record's locale stamp marks it.
    onChange([
      ...hazards,
      { id: cryptoRandomId(), description: mapEs(locale, tpl.description), riskLevel: tpl.riskLevel, controlMeasure: mapEs(locale, tpl.controlMeasure), addedBy: null, source: 'manual' },
    ])
  }

  return (
    <div className="space-y-3">
      {/* Quick-add chips */}
      <div className="flex flex-wrap gap-1.5">
        {PTP_HAZARD_LIBRARY.map((tpl) => (
          <button
            key={tpl.description}
            type="button"
            onClick={() => addTemplate(tpl)}
            className="text-xs px-3 py-2 rounded-full bg-mytra-bg border border-mytra-border
                       text-fg-2 hover:text-fg hover:border-mytra-purple/50 transition-colors min-h-[44px] inline-flex items-center"
          >
            + {mapEs(locale, tpl.description)}
          </button>
        ))}
      </div>

      {/* Rows */}
      {hazards.length === 0 ? (
        <p className="text-xs text-fg-4 py-2">{t('hazard.empty', undefined, 'No hazards yet — tap a common hazard above to add it, or use “+ Add hazard” for a custom entry.')}</p>
      ) : (
        <div className="space-y-2">
          {hazards.map((h) => (
            <div key={h.id} className="bg-mytra-card shadow-card border border-mytra-border rounded-card p-3 space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  value={h.description}
                  onChange={(e) => update(h.id, { description: e.target.value })}
                  placeholder={t('hazard.placeholder', undefined, 'Hazard')}
                  className="flex-1 bg-mytra-input border border-mytra-border rounded-lg py-2 px-3
                             text-sm text-fg placeholder:text-fg-4
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple"
                />
                <button
                  type="button"
                  onClick={() => remove(h.id)}
                  aria-label={t('hazard.removeAria', undefined, 'Remove hazard')}
                  className="shrink-0 w-11 h-11 flex items-center justify-center rounded-lg
                             bg-mytra-bg border border-mytra-border text-fg-3 hover:text-danger transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-1.5" role="radiogroup" aria-label={t('hazard.riskAria', undefined, 'Risk level')}>
                {RISK_LEVELS.map((lvl) => {
                  const on = h.riskLevel === lvl
                  return (
                    <button
                      key={lvl}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => update(h.id, { riskLevel: lvl })}
                      className="flex-1 text-xs font-medium py-2.5 rounded-lg border transition-colors min-h-[44px]"
                      style={
                        on
                          ? { backgroundColor: `color-mix(in srgb, ${RISK_COLORS[lvl]} 18%, transparent)`, borderColor: RISK_COLORS[lvl], color: RISK_COLORS[lvl] }
                          : { backgroundColor: 'transparent', color: 'var(--fg-3)', borderColor: 'var(--border)' }
                      }
                    >
                      {t(`hazard.risk.${lvl}` as Parameters<typeof t>[0], undefined, RISK_LABELS[lvl])}
                    </button>
                  )
                })}
              </div>

              <input
                type="text"
                value={h.controlMeasure}
                onChange={(e) => update(h.id, { controlMeasure: e.target.value })}
                placeholder={t('hazard.controlPlaceholder', undefined, 'Control measure')}
                className="w-full bg-mytra-input border border-mytra-border rounded-lg py-2 px-3
                           text-sm text-fg placeholder:text-fg-4
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple"
              />

              {h.source === 'sage' && (
                <span className="inline-flex items-center gap-1 text-xs text-mytra-purple">
                  {t('hazard.viaSage', undefined, '✨ via Sage — review before signing')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addBlank}
        className="inline-flex items-center gap-1.5 text-xs text-fg-2 hover:text-fg
                   bg-mytra-bg border border-mytra-border rounded-lg px-3 py-2 hover:border-mytra-purple/50 transition-colors min-h-[44px]"
      >
        <Plus className="w-3.5 h-3.5" /> {t('hazard.addHazard', undefined, 'Add hazard')}
      </button>
    </div>
  )
}
