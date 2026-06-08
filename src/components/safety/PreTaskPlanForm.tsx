'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { ClipboardList, CheckCircle2, ArrowLeft, RotateCcw, WifiOff, Send, Loader2 } from 'lucide-react'
import type { Shift } from '@/lib/types'
import type { HazardEntry, HeatIllnessPlan } from '@/lib/safety-types'
import { createPreTaskPlan, saveSignatures, markSubmittedForReview, getSafetyRecordById } from '@/lib/safety-records'
import { trySyncRecord } from '@/lib/safety-sync'
import { useFormDraft } from '@/lib/use-draft'
import { getLastContext, saveLastContext } from '@/lib/use-last-context'
import LastUsedChip from './LastUsedChip'
import HazardTable from './HazardTable'
import PPESelector from './PPESelector'
import SageAssist from './SageAssist'
import CrewSignatureBlock, { type SignatureData } from './CrewSignatureBlock'
import { getCurrentIdentity } from '@/lib/identity'

const SHIFTS: Shift[] = ['Day', 'Swing', 'Night']

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

const labelCls = 'block text-xs text-fg-2 mb-1'
const inputCls =
  'w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple'

export default function PreTaskPlanForm() {
  const [step, setStep] = useState<'plan' | 'signon' | 'done'>('plan')

  const [date, setDate] = useState(todayStr())
  const [shift, setShift] = useState<Shift>('Day')
  const [projectName, setProjectName] = useState('')
  const [location, setLocation] = useState('')
  const [scopeOfWork, setScopeOfWork] = useState('')
  const [hazards, setHazards] = useState<HazardEntry[]>([])
  const [ppe, setPpe] = useState<string[]>([])
  const [musterPoint, setMusterPoint] = useState('')
  const [hospital, setHospital] = useState('')
  const [firstAid, setFirstAid] = useState('')
  const [weather, setWeather] = useState('')
  const [wind, setWind] = useState('')
  const [heat, setHeat] = useState<HeatIllnessPlan>({
    water: false,
    shade: false,
    restBreaks: false,
    highHeatProcedures: false,
  })
  const [toolboxTopic, setToolboxTopic] = useState('')
  const [toolboxNotes, setToolboxNotes] = useState('')

  const [sigData, setSigData] = useState<SignatureData>({ signatures: [], blobs: {} })
  const [supervisorId, setSupervisorId] = useState<string | null>(null)
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [wasOffline, setWasOffline] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastCtx] = useState(getLastContext)

  const restore = useCallback((d: Record<string, unknown>) => {
    if (typeof d.date === 'string') setDate(d.date)
    if (typeof d.shift === 'string') setShift(d.shift as Shift)
    if (typeof d.projectName === 'string') setProjectName(d.projectName)
    if (typeof d.location === 'string') setLocation(d.location)
    if (typeof d.scopeOfWork === 'string') setScopeOfWork(d.scopeOfWork)
    if (Array.isArray(d.hazards)) setHazards(d.hazards)
    if (Array.isArray(d.ppe)) setPpe(d.ppe)
    if (typeof d.musterPoint === 'string') setMusterPoint(d.musterPoint)
    if (typeof d.hospital === 'string') setHospital(d.hospital)
    if (typeof d.firstAid === 'string') setFirstAid(d.firstAid)
    if (typeof d.weather === 'string') setWeather(d.weather)
    if (typeof d.wind === 'string') setWind(d.wind)
    if (d.heat && typeof d.heat === 'object') setHeat(d.heat as HeatIllnessPlan)
    if (typeof d.toolboxTopic === 'string') setToolboxTopic(d.toolboxTopic)
    if (typeof d.toolboxNotes === 'string') setToolboxNotes(d.toolboxNotes)
  }, [])

  const { hasDraft, clearDraft, dismissDraft } = useFormDraft(
    'ptp',
    () => ({ date, shift, projectName, location, scopeOfWork, hazards, ppe, musterPoint, hospital, firstAid, weather, wind, heat, toolboxTopic, toolboxNotes }),
    restore
  )

  const canContinue = scopeOfWork.trim().length > 0 && location.trim().length > 0
  const canSubmit = sigData.signatures.length >= 1 && supervisorId !== null

  function toggleHeat(key: keyof HeatIllnessPlan) {
    setHeat((h) => ({ ...h, [key]: !h[key] }))
  }

  function handleSubmit() {
    if (!canSubmit) return
    setSaveError(null)
    let record: ReturnType<typeof createPreTaskPlan>
    try {
      record = createPreTaskPlan({
        date,
        shift,
        projectName,
        location,
        scopeOfWork,
        hazards,
        ppeRequired: ppe,
        emergencyMusterPoint: musterPoint,
        nearestHospital: hospital,
        firstAidEyewashLocation: firstAid,
        weatherNotes: weather,
        windSpeed: wind,
        heatIllnessPlan: heat,
        toolboxTalkTopic: toolboxTopic,
        toolboxTalkNotes: toolboxNotes,
        crewSignatures: sigData.signatures,
        supervisorSignatureId: supervisorId,
      })
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save record — device storage may be full.')
      return
    }

    // Persist signature images to IndexedDB, then attempt sync (both fire-and-forget).
    const blobs = Object.entries(sigData.blobs).map(([id, dataUrl]) => ({ id, dataUrl }))
    saveSignatures(record.id, blobs).catch((e) => console.error('signature save failed', e))
    void trySyncRecord(record.id)

    saveLastContext({ projectName, location, shift })
    clearDraft()
    setWasOffline(!navigator.onLine)
    setSubmittedId(record.id)
    setStep('done')
  }

  function resetNew() {
    clearDraft()
    setWasOffline(false)
    setStep('plan')
    setScopeOfWork('')
    setHazards([])
    setPpe([])
    setSigData({ signatures: [], blobs: {} })
    setSupervisorId(null)
    setSubmittedId(null)
    setToolboxTopic('')
    setToolboxNotes('')
  }

  // ── DONE ──────────────────────────────────────────────────
  if (step === 'done' && submittedId) {
    return <PtpDone submittedId={submittedId} sigCount={sigData.signatures.length} wasOffline={wasOffline} onNew={resetNew} />
  }

  // ── SIGN-ON ───────────────────────────────────────────────
  if (step === 'signon') {
    return (
      <div className="animate-fadeIn space-y-4">
        <button
          type="button"
          onClick={() => setStep('plan')}
          className="inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg"
        >
          <ArrowLeft className="w-4 h-4" /> Back to plan
        </button>

        <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 shadow-card">
          <h3 className="text-sm font-semibold text-fg mb-1">Crew sign-on</h3>
          <p className="text-xs text-fg-2 mb-3">
            Pass the device around — each crew member signs to acknowledge the plan. Mark one as
            supervisor.
          </p>
          <CrewSignatureBlock
            value={sigData}
            onChange={setSigData}
            supervisorId={supervisorId}
            onSupervisorChange={setSupervisorId}
            supervisorLabel="Supervisor"
          />
        </div>

        {saveError && (
          <div className="flex items-start gap-2 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 text-xs text-danger">
            <span className="font-semibold shrink-0">Save failed:</span>
            <span>{saveError}</span>
          </div>
        )}
        <div className="sticky bottom-0 pb-4 pt-2 bg-gradient-to-t from-mytra-bg via-mytra-bg to-transparent">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3 rounded-lg text-sm font-semibold transition-colors bg-mytra-purple text-white hover:bg-mytra-purple-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sigData.signatures.length === 0
              ? 'Add at least one signature'
              : supervisorId === null
                ? 'Mark a supervisor'
                : 'Submit Pre-Task Plan'}
          </button>
        </div>
      </div>
    )
  }

  // ── PLAN ──────────────────────────────────────────────────
  return (
    <div className="animate-fadeIn space-y-4">
      {hasDraft && (
        <div className="flex items-center justify-between gap-2 bg-mytra-purple/10 border border-mytra-purple/20 rounded-lg px-4 py-2.5 animate-fadeIn">
          <div className="flex items-center gap-2 text-sm text-mytra-purple">
            <RotateCcw className="w-4 h-4" />
            <span>Draft restored</span>
          </div>
          <button type="button" onClick={dismissDraft} className="text-xs text-fg-3 hover:text-fg-2 min-h-[44px] px-3 inline-flex items-center">
            Dismiss
          </button>
        </div>
      )}
      <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-4 shadow-card">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-mytra-purple" />
          <h3 className="text-sm font-semibold text-fg">Pre-Task / Pre-Build Plan</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ptp-date" className={labelCls}>Date</label>
            <input id="ptp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Shift</label>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Shift">
              {SHIFTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={shift === s}
                  onClick={() => setShift(s)}
                  className={`flex-1 text-xs font-medium py-2.5 rounded-lg transition-colors ${
                    shift === s
                      ? 'bg-mytra-purple text-white'
                      : 'bg-mytra-bg border border-mytra-border text-fg-2 hover:text-fg'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="ptp-project" className={labelCls}>Project / Structure</label>
          <input id="ptp-project" type="text" maxLength={200} value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Tower B steel erection" className={inputCls} />
          {lastCtx.projectName && <LastUsedChip label="Last" value={lastCtx.projectName} currentValue={projectName} onApply={setProjectName} />}
        </div>
        <div>
          <label htmlFor="ptp-location" className={labelCls}>Location / Area</label>
          <input id="ptp-location" type="text" maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Level 3, grid C4" className={inputCls} />
          {lastCtx.location && <LastUsedChip label="Last" value={lastCtx.location} currentValue={location} onApply={setLocation} />}
        </div>
        <div>
          <label htmlFor="ptp-scope" className={labelCls}>Scope of work today</label>
          <textarea id="ptp-scope" rows={2} maxLength={2000} value={scopeOfWork} onChange={(e) => setScopeOfWork(e.target.value)} placeholder="What is the crew building/commissioning today?" className={`${inputCls} resize-none`} />
        </div>
      </div>

      {/* Hazards (Sage sits above the table, dormant by default) */}
      <section className="space-y-2">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold px-1">Hazards & Controls</h4>
        <SageAssist
          scopeOfWork={scopeOfWork}
          location={location}
          onAddHazards={(h) => setHazards((prev) => [...prev, ...h])}
        />
        <HazardTable hazards={hazards} onChange={setHazards} />
      </section>

      {/* PPE */}
      <section className="space-y-2">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold px-1">PPE Required</h4>
        <PPESelector selected={ppe} onChange={setPpe} />
      </section>

      {/* Site conditions */}
      <section className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-3 shadow-card">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">Site Conditions & Emergency</h4>
        <div>
          <label htmlFor="ptp-muster" className={labelCls}>Emergency muster point</label>
          <input id="ptp-muster" type="text" maxLength={200} value={musterPoint} onChange={(e) => setMusterPoint(e.target.value)} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ptp-hospital" className={labelCls}>Nearest hospital</label>
            <input id="ptp-hospital" type="text" maxLength={200} value={hospital} onChange={(e) => setHospital(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="ptp-firstaid" className={labelCls}>First aid / eyewash</label>
            <input id="ptp-firstaid" type="text" maxLength={200} value={firstAid} onChange={(e) => setFirstAid(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ptp-weather" className={labelCls}>Weather</label>
            <input id="ptp-weather" type="text" maxLength={100} value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="Conditions" className={inputCls} />
          </div>
          <div>
            <label htmlFor="ptp-wind" className={labelCls}>Wind speed</label>
            <input id="ptp-wind" type="text" inputMode="decimal" maxLength={50} value={wind} onChange={(e) => setWind(e.target.value)} placeholder="For MEWP / height" className={inputCls} />
          </div>
        </div>
      </section>

      {/* Heat illness (T8 §3395) */}
      <section className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-2 shadow-card">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">
          Heat Illness Prevention
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['water', 'Water available'],
            ['shade', 'Shade available'],
            ['restBreaks', 'Rest breaks'],
            ['highHeatProcedures', 'High-heat procedures (≥95°F)'],
          ] as [keyof HeatIllnessPlan, string][]).map(([key, lbl]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-fg-2">
              <input type="checkbox" checked={heat[key]} onChange={() => toggleHeat(key)} className="accent-mytra-purple w-5 h-5" />
              {lbl}
            </label>
          ))}
        </div>
      </section>

      {/* Toolbox talk */}
      <section className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-3 shadow-card">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">Toolbox Talk</h4>
        <div>
          <label htmlFor="ptp-tbt-topic" className={labelCls}>Topic</label>
          <input id="ptp-tbt-topic" type="text" maxLength={200} value={toolboxTopic} onChange={(e) => setToolboxTopic(e.target.value)} placeholder="Today's safety topic" className={inputCls} />
        </div>
        <div>
          <label htmlFor="ptp-tbt-notes" className={labelCls}>Notes</label>
          <textarea id="ptp-tbt-notes" rows={2} maxLength={2000} value={toolboxNotes} onChange={(e) => setToolboxNotes(e.target.value)} className={`${inputCls} resize-none`} />
        </div>
      </section>

      <div className="sticky bottom-0 pb-4 pt-2 bg-gradient-to-t from-mytra-bg via-mytra-bg to-transparent">
        <button
          type="button"
          onClick={() => setStep('signon')}
          disabled={!canContinue}
          className="w-full py-3 rounded-lg text-sm font-semibold transition-colors bg-mytra-purple text-white hover:bg-mytra-purple-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {canContinue ? 'Continue to crew sign-on' : 'Add scope and location'}
        </button>
      </div>
    </div>
  )
}

function PtpDone({ submittedId, sigCount, wasOffline, onNew }: { submittedId: string; sigCount: number; wasOffline: boolean; onNew: () => void }) {
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewDone, setReviewDone] = useState(false)
  const ehsEnabled = process.env.NEXT_PUBLIC_EHS_REVIEW === '1'

  async function handleReviewSubmit() {
    setReviewSubmitting(true)
    const identity = getCurrentIdentity()
    markSubmittedForReview(submittedId, { name: identity?.name ?? 'Unknown', email: identity?.email ?? null })
    const rec = getSafetyRecordById(submittedId)
    if (rec) {
      try {
        await fetch('/api/safety/review/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ record: rec, notionPageId: rec.notionPageId }),
        })
      } catch { /* offline — will retry */ }
    }
    setReviewDone(true)
    setReviewSubmitting(false)
  }

  return (
    <div className="animate-fadeIn space-y-4">
      <div className="bg-ok/10 border border-ok/20 rounded-lg p-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-ok mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-ok mb-1">PTP Logged</h3>
        <p className="text-sm text-ok">
          {sigCount} crew signed on. Recorded as{' '}
          <span className="font-mono text-fg">{submittedId}</span>.
        </p>
      </div>
      {wasOffline && (
        <div className="flex items-center gap-2 bg-warn/10 border border-warn/20 rounded-lg px-4 py-2.5">
          <WifiOff className="w-4 h-4 text-warn shrink-0" />
          <p className="text-xs text-warn">Saved locally. Will sync automatically when connection returns.</p>
        </div>
      )}
      {ehsEnabled && !reviewDone && (
        <button
          type="button"
          onClick={handleReviewSubmit}
          disabled={reviewSubmitting}
          className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium
                     bg-mytra-purple/10 border border-mytra-purple/30 text-mytra-purple
                     hover:border-mytra-purple/60 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {reviewSubmitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Submitting for review…</>
          ) : (
            <><Send className="w-4 h-4" /> Submit for EHS Review</>
          )}
        </button>
      )}
      {reviewDone && (
        <div className="flex items-center gap-2 bg-mytra-purple-glow border border-mytra-purple/20 rounded-lg px-4 py-2.5">
          <Send className="w-4 h-4 text-mytra-purple shrink-0" />
          <p className="text-xs text-mytra-purple">Submitted for EHS review — your manager will be notified</p>
        </div>
      )}
      <Link
        href={`/safety/record/${submittedId}`}
        className="block w-full text-center py-3 rounded-lg text-sm font-semibold bg-mytra-purple text-white hover:bg-mytra-purple-hover transition-colors"
      >
        View / Print
      </Link>
      <button
        type="button"
        onClick={onNew}
        className="w-full py-3 rounded-lg text-sm font-semibold bg-mytra-card border border-mytra-border text-fg hover:bg-mytra-card-hover transition-colors"
      >
        New Plan
      </button>
      <Link href="/safety" className="block text-center text-sm text-fg-2 hover:text-fg">
        Back to Safety Hub
      </Link>
    </div>
  )
}
