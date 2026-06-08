'use client'

import { useState } from 'react'
import { Sparkles, Plus, Loader2 } from 'lucide-react'
import type { HazardEntry, RiskLevel } from '@/lib/safety-types'
import { RISK_COLORS, RISK_LABELS } from '@/lib/safety-types'
import { cryptoRandomId } from '@/lib/safety-records'

interface Suggestion {
  description: string
  riskLevel: RiskLevel
  controlMeasure: string
}

interface SageAssistProps {
  scopeOfWork: string
  location: string
  onAddHazards: (hazards: HazardEntry[]) => void
}

const SAGE_ENABLED = process.env.NEXT_PUBLIC_AI_ASSIST === '1'

export default function SageAssist({ scopeOfWork, location, onAddHazards }: SageAssistProps) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  if (!SAGE_ENABLED) return null

  const canAsk = scopeOfWork.trim().split(/\s+/).filter(Boolean).length >= 3

  async function ask() {
    setLoading(true)
    setSuggestions(null)
    setError(null)
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 28000)
      const res = await fetch('/api/safety/suggest-hazards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopeOfWork, location }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      const data = await res.json()
      if (data?.error) {
        setError(data.error)
        setSuggestions([])
      } else {
        const list: Suggestion[] = Array.isArray(data?.hazards) ? data.hazards : []
        setSuggestions(list)
        setSelected(new Set(list.map((_, i) => i)))
      }
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'AbortError'
        ? 'Request timed out — try again'
        : 'Network error — check your connection'
      setError(msg)
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function addSelected() {
    if (!suggestions) return
    const picked = suggestions.filter((_, i) => selected.has(i))
    onAddHazards(
      picked.map((s) => ({
        id: cryptoRandomId(),
        description: s.description,
        riskLevel: s.riskLevel,
        controlMeasure: s.controlMeasure,
        addedBy: 'Sage',
        source: 'sage' as const,
      }))
    )
    setSuggestions(null)
    setSelected(new Set())
  }

  return (
    <div className="mb-3">
      {!suggestions && (
        <button
          type="button"
          onClick={ask}
          disabled={!canAsk || loading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium
                     bg-mytra-purple-glow border border-mytra-purple/30 text-mytra-purple
                     hover:border-mytra-purple/60 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Sage is thinking…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Ask Sage to suggest hazards
            </>
          )}
        </button>
      )}
      {!suggestions && !canAsk && !loading && (
        <p className="text-xs text-fg-4 mt-1 text-center">Add a scope of work first</p>
      )}

      {suggestions && (
        <div className="bg-mytra-card border border-mytra-purple/30 rounded-lg p-3 shadow-card animate-fadeInUp">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-4 h-4 text-mytra-purple" />
            <span className="text-sm font-medium text-fg">Sage suggests</span>
            <span className="text-xs text-mytra-purple">— review before signing</span>
          </div>

          {suggestions.length === 0 ? (
            <p className="text-xs text-fg-2 py-2">
              {error || 'No suggestions — add hazards manually.'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {suggestions.map((s, i) => (
                <label
                  key={i}
                  className="flex items-start gap-2 bg-mytra-bg border border-mytra-border rounded-lg p-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggle(i)}
                    className="mt-0.5 accent-mytra-purple"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="text-xs font-semibold px-1.5 py-0.5 rounded"
                        style={{ color: RISK_COLORS[s.riskLevel], backgroundColor: `color-mix(in srgb, ${RISK_COLORS[s.riskLevel]} 10%, transparent)` }}
                      >
                        {RISK_LABELS[s.riskLevel]}
                      </span>
                      <span className="text-sm text-fg">{s.description}</span>
                    </span>
                    <span className="block text-xs text-fg-2 mt-0.5">{s.controlMeasure}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={addSelected}
              disabled={selected.size === 0}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium
                         bg-mytra-purple text-white hover:bg-mytra-purple-hover transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" /> Add selected
            </button>
            <button
              type="button"
              onClick={() => setSuggestions(null)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-mytra-bg border border-mytra-border
                         text-fg-2 hover:text-fg transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
