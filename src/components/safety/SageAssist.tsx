'use client'

import { useState } from 'react'
import { Sparkles, Plus, Loader2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { HazardEntry, RiskLevel } from '@/lib/safety-types'
import { RISK_COLORS, RISK_LABELS } from '@/lib/safety-types'
import { cryptoRandomId } from '@/lib/safety-records'
import { PPE_OPTIONS } from '@/data/safety-checklists'

interface Suggestion {
  description: string
  riskLevel: RiskLevel
  controlMeasure: string
}

interface PermitGap {
  permit_type: 'height-permit' | 'hot-work-permit' | 'confined-space-permit'
  reason: string
  urgency: 'required' | 'recommended'
}

interface PpeSuggestion {
  id: string
  label: string
  reason: string
}

interface SageAssistProps {
  scopeOfWork: string
  location: string
  existingHazards: HazardEntry[]
  onAddHazards: (hazards: HazardEntry[]) => void
  onAddPpe: (ppeIds: string[]) => void
}

const SAGE_ENABLED = process.env.NEXT_PUBLIC_AI_ASSIST === '1'

// ── PPE keyword mapping ────────────────────────────────────
const PPE_KEYWORD_MAP: { keywords: string[]; ppeId: string; reason: string }[] = [
  { keywords: ['fall', 'height', 'ladder', 'scaffold', 'elevated', 'mewp', 'boom lift', 'scissor', 'roof'], ppeId: 'harness', reason: 'Work at height detected' },
  { keywords: ['dust', 'silica', 'grinding', 'fume', 'sanding', 'concrete cutting', 'welding fume'], ppeId: 'respirator', reason: 'Airborne hazard detected' },
  { keywords: ['weld', 'brazing', 'cutting torch', 'hot work', 'plasma'], ppeId: 'welding-ppe', reason: 'Hot work / welding detected' },
  { keywords: ['arc flash', 'electrical', 'energized', 'panel', 'voltage'], ppeId: 'arc-flash', reason: 'Electrical hazard detected' },
  { keywords: ['noise', 'loud', 'grinding', 'impact tool', 'jackhammer', 'genset'], ppeId: 'hearing', reason: 'Noise exposure detected' },
  { keywords: ['sharp', 'edge', 'blade', 'sheet metal', 'cut', 'pinch', 'crush'], ppeId: 'cut-gloves', reason: 'Cut / pinch hazard detected' },
  { keywords: ['traffic', 'vehicle', 'public', 'roadway', 'pedestrian'], ppeId: 'hi-vis', reason: 'Vehicle / traffic interface detected' },
  { keywords: ['overhead', 'falling object', 'dropped', 'crane', 'rigging'], ppeId: 'hard-hat', reason: 'Overhead / falling object risk' },
  { keywords: ['splash', 'chemical', 'grind', 'chip', 'flying'], ppeId: 'face-shield', reason: 'Face / eye splash risk' },
  { keywords: ['construction', 'site', 'steel', 'formwork', 'demolition'], ppeId: 'boots', reason: 'General worksite safety' },
  { keywords: ['impact', 'debris', 'drill', 'saw', 'grinder'], ppeId: 'safety-glasses', reason: 'Eye hazard from debris / impact' },
]

function suggestPpeFromHazards(hazards: HazardEntry[]): PpeSuggestion[] {
  const allText = hazards.map((h) => `${h.description} ${h.controlMeasure}`.toLowerCase()).join(' ')
  const seen = new Set<string>()
  const results: PpeSuggestion[] = []

  for (const rule of PPE_KEYWORD_MAP) {
    if (seen.has(rule.ppeId)) continue
    if (rule.keywords.some((kw) => allText.includes(kw))) {
      const opt = PPE_OPTIONS.find((p) => p.id === rule.ppeId)
      if (opt) {
        seen.add(rule.ppeId)
        results.push({ id: opt.id, label: opt.label, reason: rule.reason })
      }
    }
  }
  return results
}

const PERMIT_LABELS: Record<string, string> = {
  'height-permit': 'Work-at-Height Permit',
  'hot-work-permit': 'Hot Work Permit',
  'confined-space-permit': 'Confined Space Permit',
}

const PERMIT_LINKS: Record<string, string> = {
  'height-permit': '/safety/permits/height',
  'hot-work-permit': '/safety/permits/hot-work',
  'confined-space-permit': '/safety/permits/confined-space',
}

type FollowUpMode = 'chips' | 'gap-check' | 'ppe' | 'permits'

export default function SageAssist({ scopeOfWork, location, existingHazards, onAddHazards, onAddPpe }: SageAssistProps) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // Follow-up state
  const [followUpMode, setFollowUpMode] = useState<FollowUpMode | null>(null)
  const [ppeSuggestions, setPpeSuggestions] = useState<PpeSuggestion[]>([])
  const [selectedPpe, setSelectedPpe] = useState<Set<string>>(new Set())
  const [permitGaps, setPermitGaps] = useState<PermitGap[]>([])
  const [followUpLoading, setFollowUpLoading] = useState(false)
  const [followUpError, setFollowUpError] = useState<string | null>(null)

  if (!SAGE_ENABLED) return null

  const canAsk = scopeOfWork.trim().split(/\s+/).filter(Boolean).length >= 3

  async function ask() {
    setLoading(true)
    setSuggestions(null)
    setError(null)
    setFollowUpMode(null)
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 55000)
      const res = await fetch('/api/safety/suggest-hazards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopeOfWork, location }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        setError(data.error ?? `Request failed (${res.status})`)
        setSuggestions([])
        return
      }
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
    setFollowUpMode('chips')
    setFollowUpError(null)
  }

  // ── Follow-up actions ────────────────────────────────────

  async function checkForGaps() {
    setFollowUpMode('gap-check')
    setFollowUpLoading(true)
    setFollowUpError(null)
    setSuggestions(null)
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 55000)
      const res = await fetch('/api/safety/suggest-hazards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scopeOfWork,
          location,
          followUp: true,
          existingHazards: existingHazards.map((h) => h.description),
        }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        setFollowUpError(data.error ?? `Request failed (${res.status})`)
        setSuggestions([])
        return
      }
      const data = await res.json()
      if (data?.error) {
        setFollowUpError(data.error)
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
      setFollowUpError(msg)
      setSuggestions([])
    } finally {
      setFollowUpLoading(false)
    }
  }

  function suggestPpe() {
    setFollowUpMode('ppe')
    setFollowUpError(null)
    const results = suggestPpeFromHazards(existingHazards)
    setPpeSuggestions(results)
    setSelectedPpe(new Set(results.map((r) => r.id)))
  }

  function togglePpe(id: string) {
    setSelectedPpe((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function addSelectedPpe() {
    const ids = Array.from(selectedPpe)
    if (ids.length > 0) onAddPpe(ids)
    setFollowUpMode('chips')
  }

  async function checkPermits() {
    setFollowUpMode('permits')
    setFollowUpLoading(true)
    setFollowUpError(null)
    setPermitGaps([])
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 55000)
      const res = await fetch('/api/safety/check-permits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scopeOfWork,
          location,
          hazards: existingHazards.map((h) => h.description),
        }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        setFollowUpError(data.error ?? `Request failed (${res.status})`)
        return
      }
      const data = await res.json()
      if (data?.error) {
        setFollowUpError(data.error)
      } else {
        const permits: PermitGap[] = Array.isArray(data?.missing_permits) ? data.missing_permits : []
        setPermitGaps(permits)
      }
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'AbortError'
        ? 'Request timed out — try again'
        : 'Network error — check your connection'
      setFollowUpError(msg)
    } finally {
      setFollowUpLoading(false)
    }
  }

  function dismiss() {
    setFollowUpMode(null)
    setSuggestions(null)
    setFollowUpError(null)
    setPermitGaps([])
    setPpeSuggestions([])
  }

  return (
    <div className="mb-3">
      {/* ── Initial ask button ──────────────────────────────── */}
      {!suggestions && !followUpMode && (
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
              <Loader2 className="w-4 h-4 animate-spin" /> Sage is thinking...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Ask Sage to suggest hazards
            </>
          )}
        </button>
      )}
      {!suggestions && !followUpMode && !canAsk && !loading && (
        <p className="text-xs text-fg-4 mt-1 text-center">Add a scope of work first</p>
      )}

      {/* ── Suggestion cards (initial + gap-check reuse) ──── */}
      {suggestions && (
        <div className="bg-mytra-card border border-mytra-purple/30 rounded-lg p-3 shadow-card animate-fadeInUp">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-4 h-4 text-mytra-purple" />
            <span className="text-sm font-medium text-fg">
              {followUpMode === 'gap-check' ? 'Sage found gaps' : 'Sage suggests'}
            </span>
            <span className="text-xs text-mytra-purple">— review before signing</span>
          </div>

          {suggestions.length === 0 ? (
            <p className="text-xs text-fg-2 py-2">
              {error || followUpError || (followUpMode === 'gap-check' ? 'No gaps found — your hazard list looks thorough.' : 'No suggestions — add hazards manually.')}
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
              onClick={dismiss}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-mytra-bg border border-mytra-border
                         text-fg-2 hover:text-fg transition-colors"
            >
              Dismiss
            </button>
          </div>
          <p className="text-xs text-fg-4 mt-2 text-center">
            AI suggestions are not a substitute for a competent safety assessment.
          </p>
        </div>
      )}

      {/* ── Follow-up chips bar ─────────────────────────────── */}
      {followUpMode === 'chips' && !suggestions && (
        <div className="bg-mytra-card border border-mytra-purple/30 rounded-lg p-3 shadow-card animate-fadeInUp">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-mytra-purple" />
            <span className="text-xs font-medium text-fg-2">What next?</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={checkForGaps}
              className="inline-flex items-center gap-1.5 bg-mytra-purple/10 border border-mytra-purple/20 text-mytra-purple text-xs rounded-full px-3 py-1.5 hover:bg-mytra-purple/20 transition-colors"
            >
              <Sparkles className="w-3 h-3" /> Check for gaps
            </button>
            <button
              type="button"
              onClick={suggestPpe}
              className="inline-flex items-center gap-1.5 bg-mytra-purple/10 border border-mytra-purple/20 text-mytra-purple text-xs rounded-full px-3 py-1.5 hover:bg-mytra-purple/20 transition-colors"
            >
              <Sparkles className="w-3 h-3" /> Suggest PPE
            </button>
            <button
              type="button"
              onClick={checkPermits}
              className="inline-flex items-center gap-1.5 bg-mytra-purple/10 border border-mytra-purple/20 text-mytra-purple text-xs rounded-full px-3 py-1.5 hover:bg-mytra-purple/20 transition-colors"
            >
              <Sparkles className="w-3 h-3" /> Need a permit?
            </button>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="block mt-2 text-xs text-fg-4 hover:text-fg-2 transition-colors"
          >
            Done with Sage
          </button>
        </div>
      )}

      {/* ── Loading state for follow-ups ────────────────────── */}
      {followUpLoading && (
        <div className="bg-mytra-card border border-mytra-purple/30 rounded-lg p-3 shadow-card animate-fadeInUp">
          <div className="flex items-center justify-center gap-2 py-2 text-sm text-mytra-purple">
            <Loader2 className="w-4 h-4 animate-spin" /> Sage is thinking...
          </div>
        </div>
      )}

      {/* ── PPE suggestions ─────────────────────────────────── */}
      {followUpMode === 'ppe' && !followUpLoading && (
        <div className="bg-mytra-card border border-mytra-purple/30 rounded-lg p-3 shadow-card animate-fadeInUp">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-4 h-4 text-mytra-purple" />
            <span className="text-sm font-medium text-fg">Suggested PPE</span>
            <span className="text-xs text-mytra-purple">— based on your hazards</span>
          </div>

          {ppeSuggestions.length === 0 ? (
            <p className="text-xs text-fg-2 py-2">No additional PPE suggestions based on current hazards.</p>
          ) : (
            <div className="space-y-1.5">
              {ppeSuggestions.map((p) => (
                <label
                  key={p.id}
                  className="flex items-start gap-2 bg-mytra-bg border border-mytra-border rounded-lg p-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedPpe.has(p.id)}
                    onChange={() => togglePpe(p.id)}
                    className="mt-0.5 accent-mytra-purple"
                  />
                  <span className="min-w-0">
                    <span className="text-sm text-fg">{p.label}</span>
                    <span className="block text-xs text-fg-3 mt-0.5">{p.reason}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-3">
            {ppeSuggestions.length > 0 && (
              <button
                type="button"
                onClick={addSelectedPpe}
                disabled={selectedPpe.size === 0}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium
                           bg-mytra-purple text-white hover:bg-mytra-purple-hover transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" /> Add selected PPE
              </button>
            )}
            <button
              type="button"
              onClick={() => setFollowUpMode('chips')}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-mytra-bg border border-mytra-border
                         text-fg-2 hover:text-fg transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* ── Permit gap results ──────────────────────────────── */}
      {followUpMode === 'permits' && !followUpLoading && (
        <div className="bg-mytra-card border border-mytra-purple/30 rounded-lg p-3 shadow-card animate-fadeInUp">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-4 h-4 text-mytra-purple" />
            <span className="text-sm font-medium text-fg">Permit check</span>
          </div>

          {followUpError ? (
            <p className="text-xs text-fg-2 py-2">{followUpError}</p>
          ) : permitGaps.length === 0 ? (
            <p className="text-xs text-fg-2 py-2">No permits appear to be needed for this scope of work.</p>
          ) : (
            <div className="space-y-2">
              {permitGaps.map((p, i) => (
                <div
                  key={i}
                  className="bg-mytra-bg border border-mytra-border rounded-lg p-2.5"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                        p.urgency === 'required'
                          ? 'bg-danger/10 text-danger'
                          : 'bg-warn/10 text-warn'
                      }`}
                    >
                      {p.urgency === 'required' ? 'Required' : 'Recommended'}
                    </span>
                    <span className="text-sm font-medium text-fg">
                      {PERMIT_LABELS[p.permit_type] ?? p.permit_type}
                    </span>
                  </div>
                  <p className="text-xs text-fg-2 mb-2">{p.reason}</p>
                  <Link
                    href={PERMIT_LINKS[p.permit_type] ?? '/safety/permits'}
                    className="inline-flex items-center gap-1 text-xs font-medium text-mytra-purple hover:underline"
                  >
                    Open Permit <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => setFollowUpMode('chips')}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-mytra-bg border border-mytra-border
                         text-fg-2 hover:text-fg transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
