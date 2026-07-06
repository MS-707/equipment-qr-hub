'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { AlertTriangle, Camera, X, Plus, RotateCcw, Sparkles, Loader2, ChevronRight, Info } from 'lucide-react'
import type { IncidentType, IncidentSeverity, InjuredPerson } from '@/lib/safety-types'
import { INCIDENT_SEVERITY_COLORS } from '@/lib/safety-types'
import { createIncidentReport, saveSignatures, savePhotosForRecord, cryptoRandomId } from '@/lib/safety-records'
import { trySyncRecord } from '@/lib/safety-sync'
import { isReviewEnabled, submitForReview, type ReviewSubmitState } from '@/lib/review-submit'
import { useFormDraft } from '@/lib/use-draft'
import { getLastContext, saveLastContext } from '@/lib/use-last-context'
import LastUsedChip from './LastUsedChip'
import { compressPhoto } from '@/lib/media'
import { getCurrentIdentity } from '@/lib/identity'
import { toLocalInput, toIso } from '@/lib/datetime'
import SignaturePad from '@/components/SignaturePad'
import FormSuccess from './FormSuccess'
import { labelCls, inputCls, textareaCls } from '@/lib/form-styles'
import { getOfflineAnalysis } from '@/lib/incident-patterns'

const SAGE_ENABLED = process.env.NEXT_PUBLIC_AI_ASSIST === '1'

interface AnalysisRootCause {
  cause: string
  category: 'equipment' | 'process' | 'training' | 'environment' | 'management'
  whyChain: string[]
}

interface AnalysisCorrectiveAction {
  action: string
  controlLevel: 'elimination' | 'substitution' | 'engineering' | 'administrative' | 'ppe'
  priority: 'immediate' | 'short-term' | 'long-term'
}

interface AnalysisResult {
  rootCauses: AnalysisRootCause[]
  correctiveActions: AnalysisCorrectiveAction[]
}

const CATEGORY_COLORS: Record<string, string> = {
  equipment: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  process: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  training: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  environment: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  management: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
}

const CONTROL_LEVEL_ORDER: AnalysisCorrectiveAction['controlLevel'][] = [
  'elimination', 'substitution', 'engineering', 'administrative', 'ppe',
]

const CONTROL_LEVEL_LABELS: Record<string, string> = {
  elimination: 'Elimination',
  substitution: 'Substitution',
  engineering: 'Engineering Controls',
  administrative: 'Administrative Controls',
  ppe: 'PPE',
}

const CONTROL_LEVEL_COLORS: Record<string, string> = {
  elimination: 'bg-emerald-500/10 text-emerald-400',
  substitution: 'bg-teal-500/10 text-teal-400',
  engineering: 'bg-blue-500/10 text-blue-400',
  administrative: 'bg-amber-500/10 text-amber-400',
  ppe: 'bg-orange-500/10 text-orange-400',
}

const PRIORITY_COLORS: Record<string, string> = {
  immediate: 'bg-danger/10 text-danger',
  'short-term': 'bg-warn/10 text-warn',
  'long-term': 'bg-mytra-purple/10 text-mytra-purple',
}

const TYPES: { value: IncidentType; label: string }[] = [
  { value: 'injury', label: 'Injury' },
  { value: 'near-miss', label: 'Near-miss' },
  { value: 'property-damage', label: 'Property' },
  { value: 'environmental', label: 'Environmental' },
]
const SEVERITIES: IncidentSeverity[] = ['minor', 'moderate', 'serious', 'critical']

export default function IncidentReportForm() {
  const [projectName, setProjectName] = useState('')
  const [location, setLocation] = useState('')
  const [incidentType, setIncidentType] = useState<IncidentType>('near-miss')
  const [severity, setSeverity] = useState<IncidentSeverity>('minor')
  const [occurredAt, setOccurredAt] = useState(toLocalInput(new Date()))
  const [description, setDescription] = useState('')
  const [immediateActions, setImmediateActions] = useState('')
  const [witnessInput, setWitnessInput] = useState('')
  const [witnesses, setWitnesses] = useState<string[]>([])
  const [rootCause, setRootCause] = useState('')
  const [correctiveActions, setCorrectiveActions] = useState('')
  const [reportedToCalOsha, setReportedToCalOsha] = useState(false)
  const [injuredPerson, setInjuredPerson] = useState<InjuredPerson>({ name: '', jobTitle: '', employer: '', bodyPartAffected: '' })
  const [photos, setPhotos] = useState<{ id: string; dataUrl: string }[]>([])
  const [reporterName, setReporterName] = useState('')
  const [reporterSig, setReporterSig] = useState<string | null>(null)
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [reviewState, setReviewState] = useState<ReviewSubmitState | null>(null)
  const [wasOffline, setWasOffline] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastCtx] = useState(getLastContext)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisSource, setAnalysisSource] = useState<'ai' | 'offline' | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  const restore = useCallback((d: Record<string, unknown>) => {
    if (typeof d.projectName === 'string') setProjectName(d.projectName)
    if (typeof d.location === 'string') setLocation(d.location)
    if (typeof d.incidentType === 'string') setIncidentType(d.incidentType as IncidentType)
    if (typeof d.severity === 'string') setSeverity(d.severity as IncidentSeverity)
    if (typeof d.occurredAt === 'string') setOccurredAt(d.occurredAt)
    if (typeof d.description === 'string') setDescription(d.description)
    if (typeof d.immediateActions === 'string') setImmediateActions(d.immediateActions)
    if (Array.isArray(d.witnesses)) setWitnesses(d.witnesses)
    if (typeof d.rootCause === 'string') setRootCause(d.rootCause)
    if (typeof d.correctiveActions === 'string') setCorrectiveActions(d.correctiveActions)
    if (typeof d.reportedToCalOsha === 'boolean') setReportedToCalOsha(d.reportedToCalOsha)
    if (d.injuredPerson && typeof d.injuredPerson === 'object') {
      const ip = d.injuredPerson as InjuredPerson
      setInjuredPerson({ name: ip.name ?? '', jobTitle: ip.jobTitle ?? '', employer: ip.employer ?? '', bodyPartAffected: ip.bodyPartAffected ?? '' })
    }
    if (typeof d.reporterName === 'string') setReporterName(d.reporterName)
  }, [])

  const { hasDraft, clearDraft, dismissDraft } = useFormDraft(
    'incident',
    () => ({ projectName, location, incidentType, severity, occurredAt, description, immediateActions, witnesses, rootCause, correctiveActions, reportedToCalOsha, injuredPerson, reporterName }),
    restore,
    submittedId !== null
  )

  useEffect(() => {
    const id = getCurrentIdentity()
    if (id?.name) setReporterName(id.name)
  }, [])

  const isSerious = severity === 'serious' || severity === 'critical'
  const canSubmit = description.trim().length > 0 && location.trim().length > 0

  function addWitness() {
    const v = witnessInput.trim()
    if (!v) return
    setWitnesses((w) => [...w, v])
    setWitnessInput('')
  }

  async function onFile(file: File | null) {
    if (!file) return
    try {
      const dataUrl = await compressPhoto(file)
      setPhotos((p) => [...p, { id: cryptoRandomId(), dataUrl }])
    } catch (e) {
      console.error('photo compress failed', e)
    }
  }

  const canAnalyze = SAGE_ENABLED && description.trim().length >= 20

  async function analyzeIncident() {
    setAnalysisLoading(true)
    setAnalysisResult(null)
    setAnalysisError(null)
    setAnalysisSource(null)
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 55000)
      const res = await fetch('/api/safety/analyze-incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          incidentType,
          severity,
          bodyPartAffected: injuredPerson.bodyPartAffected || undefined,
          immediateActions: immediateActions || undefined,
          location: location || undefined,
        }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(data.error ?? `Request failed (${res.status})`)
      }
      const data = await res.json()
      if (data?.error) {
        throw new Error(data.error)
      }
      setAnalysisResult({ rootCauses: data.rootCauses ?? [], correctiveActions: data.correctiveActions ?? [] })
      setAnalysisSource('ai')
    } catch {
      const offline = getOfflineAnalysis(incidentType, description)
      if (offline) {
        setAnalysisResult(offline)
        setAnalysisSource('offline')
      } else {
        setAnalysisError('Unable to analyze — check your connection and try again')
      }
    } finally {
      setAnalysisLoading(false)
    }
  }

  function adoptRootCause(text: string) {
    const attributed = `[AI-suggested] ${text}`
    setRootCause((prev) => prev ? `${prev}\n\n${attributed}` : attributed)
  }

  function adoptCorrectiveAction(text: string) {
    const attributed = `[AI-suggested] ${text}`
    setCorrectiveActions((prev) => prev ? `${prev}\n\n${attributed}` : attributed)
  }

  function dismissAnalysis() {
    setAnalysisResult(null)
    setAnalysisError(null)
    setAnalysisSource(null)
  }

  const submitGuard = useRef(false)
  function submit() {
    if (!canSubmit || submitGuard.current) return
    submitGuard.current = true
    setSaveError(null)
    const reporterSignatureId = reporterSig ? cryptoRandomId() : null
    let record: ReturnType<typeof createIncidentReport>
    try {
      const hasInjured = injuredPerson.name.trim().length > 0
      record = createIncidentReport({
        projectName,
        location,
        incidentType,
        severity,
        occurredAt: toIso(occurredAt),
        description,
        immediateActions,
        witnesses,
        rootCause,
        correctiveActions,
        reportedToCalOsha,
        injuredPerson: hasInjured ? injuredPerson : undefined,
        photoSlots: photos.map((p) => p.id),
        reporterSignatureId,
      })
    } catch (e) {
      submitGuard.current = false
      setSaveError(e instanceof Error ? e.message : 'Failed to save record — device storage may be full.')
      return
    }
    if (photos.length > 0) savePhotosForRecord(record.id, photos).catch((e) => console.error('photo save failed', e))
    if (reporterSignatureId && reporterSig) {
      saveSignatures(record.id, [{ id: reporterSignatureId, dataUrl: reporterSig }]).catch((e) =>
        console.error('signature save failed', e)
      )
    }
    void trySyncRecord(record.id)
    saveLastContext({ projectName, location })
    if (isReviewEnabled()) {
      setReviewState('pending')
      void submitForReview(record.id).then(setReviewState)
    }
    clearDraft()
    setWasOffline(!navigator.onLine)
    setSubmittedId(record.id)
  }

  function reset() {
    clearDraft()
    setWasOffline(false)
    setIncidentType('near-miss')
    setSeverity('minor')
    setOccurredAt(toLocalInput(new Date()))
    setDescription('')
    setImmediateActions('')
    setWitnessInput('')
    setWitnesses([])
    setRootCause('')
    setCorrectiveActions('')
    setReportedToCalOsha(false)
    setPhotos([])
    setReporterSig(null)
    setSubmittedId(null)
    setAnalysisResult(null)
    setAnalysisError(null)
    setAnalysisSource(null)
  }

  if (submittedId) {
    return (
      <FormSuccess
        id={submittedId}
        title="Report Filed"
        message="Incident report recorded as"
        onNew={reset}
        newLabel="Start new report"
        offline={wasOffline}
        reviewAutoSubmitted={reviewState}
        onRetryReview={() => {
          setReviewState('pending')
          void submitForReview(submittedId).then(setReviewState)
        }}
      />
    )
  }

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
      <div className="bg-mytra-card border border-mytra-border rounded-card p-4 space-y-4 shadow-card">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-mytra-purple" />
          <h3 className="text-sm font-semibold text-fg">Incident / Near-Miss Report</h3>
        </div>

        <div>
          <label className={labelCls}>Type</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setIncidentType(t.value)}
                className={`text-xs font-medium py-2 rounded-lg transition-colors min-h-[44px] ${
                  incidentType === t.value
                    ? 'bg-mytra-purple text-white'
                    : 'bg-mytra-bg border border-mytra-border text-fg-2 hover:text-fg'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Severity</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {SEVERITIES.map((s) => {
              const on = severity === s
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  className="text-xs font-medium py-2 rounded-lg border capitalize transition-colors min-h-[44px]"
                  style={
                    on
                      ? { backgroundColor: INCIDENT_SEVERITY_COLORS[s], color: '#fff', borderColor: INCIDENT_SEVERITY_COLORS[s] }
                      : { backgroundColor: 'transparent', color: 'var(--fg-3)', borderColor: 'var(--border)' }
                  }
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>

        {/* Mytra reporting culture: every incident gets reported, big or small. */}
        <div className="flex items-start gap-2 bg-mytra-purple/10 border border-mytra-purple/20 rounded-lg px-3 py-2">
          <Info className="w-4 h-4 text-mytra-purple shrink-0 mt-0.5" />
          <p className="text-xs text-mytra-purple leading-relaxed">
            Report every incident — injury, near-miss, property, or environmental — as soon as you safely can, no matter how minor. At Mytra, reporting the small things is how we prevent the serious ones.
          </p>
        </div>

        {isSerious && (
          <div className="flex items-start gap-2 bg-warn/10 border border-warn/20 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
            <p className="text-xs text-warn leading-relaxed">
              This one also needs prompt escalation: notify your safety officer right away. Serious and critical events may trigger regulatory reporting — check your local requirements.
            </p>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-fg-2 min-h-[44px] cursor-pointer">
          <input type="checkbox" checked={reportedToCalOsha} onChange={() => setReportedToCalOsha((v) => !v)} className="accent-mytra-purple w-5 h-5" />
          Reported to regulatory authority
        </label>

        {incidentType === 'injury' && (
          <div className="space-y-3 border-t border-mytra-border pt-3">
            <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">Injured person</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ir-name" className={labelCls}>Name</label>
                <input id="ir-name" type="text" autoCapitalize="words" maxLength={100} value={injuredPerson.name} onChange={(e) => setInjuredPerson((p) => ({ ...p, name: e.target.value }))} placeholder="Full name" className={inputCls} />
              </div>
              <div>
                <label htmlFor="ir-job-title" className={labelCls}>Job title</label>
                <input id="ir-job-title" type="text" maxLength={100} value={injuredPerson.jobTitle} onChange={(e) => setInjuredPerson((p) => ({ ...p, jobTitle: e.target.value }))} placeholder="e.g. Ironworker" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ir-employer" className={labelCls}>Employer</label>
                <input id="ir-employer" type="text" maxLength={200} value={injuredPerson.employer} onChange={(e) => setInjuredPerson((p) => ({ ...p, employer: e.target.value }))} placeholder="Company name" className={inputCls} />
              </div>
              <div>
                <label htmlFor="ir-body-part" className={labelCls}>Body part affected</label>
                <input id="ir-body-part" type="text" maxLength={200} value={injuredPerson.bodyPartAffected} onChange={(e) => setInjuredPerson((p) => ({ ...p, bodyPartAffected: e.target.value }))} placeholder="e.g. Left hand" className={inputCls} />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ir-project" className={labelCls}>Project / Structure</label>
            <input id="ir-project" type="text" maxLength={200} value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Tower B steel erection" className={inputCls} />
            {lastCtx.projectName && <LastUsedChip label="Last" value={lastCtx.projectName} currentValue={projectName} onApply={setProjectName} />}
          </div>
          <div>
            <label htmlFor="ir-location" className={labelCls}>Location / Area</label>
            <input id="ir-location" type="text" maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Level / grid" className={inputCls} />
            {lastCtx.location && <LastUsedChip label="Last" value={lastCtx.location} currentValue={location} onApply={setLocation} />}
          </div>
        </div>
        <div>
          <label htmlFor="ir-when" className={labelCls}>When did it occur?</label>
          <input id="ir-when" type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="ir-what" className={labelCls}>What happened?</label>
          <textarea id="ir-what" rows={4} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the incident…" className={textareaCls} />
        </div>
        <div>
          <label htmlFor="ir-actions" className={labelCls}>Immediate actions taken</label>
          <textarea id="ir-actions" rows={2} maxLength={2000} value={immediateActions} onChange={(e) => setImmediateActions(e.target.value)} className={textareaCls} />
        </div>

        {canAnalyze && !analysisResult && !analysisLoading && (
          <button
            type="button"
            onClick={analyzeIncident}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium
                       bg-mytra-purple-glow border border-mytra-purple/30 text-mytra-purple
                       hover:border-mytra-purple/60 transition-colors"
          >
            <Sparkles className="w-4 h-4" /> Analyze with Sage
          </button>
        )}

        {analysisLoading && (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-mytra-purple">
            <Loader2 className="w-4 h-4 animate-spin" /> Sage is analyzing...
          </div>
        )}

        {analysisError && (
          <div className="flex items-start gap-2 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 text-xs text-danger">
            <span>{analysisError}</span>
          </div>
        )}

        {analysisResult && (
          <div className="bg-mytra-card border border-mytra-purple/30 rounded-card p-3 shadow-card animate-fadeInUp space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-mytra-purple" />
                <span className="text-sm font-medium text-fg">Root Cause Analysis</span>
                {analysisSource === 'offline' && (
                  <span className="text-xs bg-warn/10 text-warn px-1.5 py-0.5 rounded">offline</span>
                )}
              </div>
              <button type="button" onClick={dismissAnalysis} aria-label="Dismiss analysis" className="text-fg-4 hover:text-fg-2 transition-colors w-11 h-11 -m-2 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            {analysisResult.rootCauses.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">Root Causes</h5>
                {analysisResult.rootCauses.map((rc, i) => (
                  <div key={i} className="bg-mytra-bg border border-mytra-border rounded-lg p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border capitalize ${CATEGORY_COLORS[rc.category]}`}>
                          {rc.category}
                        </span>
                        <span className="text-sm text-fg">{rc.cause}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => adoptRootCause(rc.cause)}
                        className="shrink-0 text-xs font-medium text-mytra-purple hover:underline whitespace-nowrap min-h-[44px] px-2 inline-flex items-center"
                      >
                        Use this
                      </button>
                    </div>
                    {rc.whyChain.length > 0 && (
                      <div className="mt-2 ml-1 space-y-1">
                        {rc.whyChain.map((why, j) => (
                          <div key={j} className="flex items-start gap-1.5 text-xs text-fg-2" style={{ paddingLeft: `${j * 12}px` }}>
                            <ChevronRight className="w-3 h-3 shrink-0 mt-0.5 text-fg-4" />
                            <span>{why}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {analysisResult.correctiveActions.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">Corrective Actions</h5>
                {CONTROL_LEVEL_ORDER.map((level) => {
                  const actions = analysisResult!.correctiveActions.filter((a) => a.controlLevel === level)
                  if (actions.length === 0) return null
                  return (
                    <div key={level}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${CONTROL_LEVEL_COLORS[level]}`}>
                          {CONTROL_LEVEL_LABELS[level]}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {actions.map((ca, j) => (
                          <div key={j} className="flex items-start justify-between gap-2 bg-mytra-bg border border-mytra-border rounded-lg p-2.5">
                            <div className="min-w-0">
                              <span className="text-sm text-fg">{ca.action}</span>
                              <span className={`ml-2 inline-block text-xs font-medium px-1.5 py-0.5 rounded ${PRIORITY_COLORS[ca.priority]}`}>
                                {ca.priority}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => adoptCorrectiveAction(ca.action)}
                              className="shrink-0 text-xs font-medium text-mytra-purple hover:underline whitespace-nowrap min-h-[44px] px-2 inline-flex items-center"
                            >
                              Use this
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <p className="text-xs text-fg-4 text-center">
              AI suggestions are not a substitute for a competent incident investigation.
            </p>
          </div>
        )}
      </div>

      {/* Witnesses */}
      <section className="bg-mytra-card border border-mytra-border rounded-card p-4 space-y-2 shadow-card">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">Witnesses</h4>
        <div className="flex gap-2">
          <input
            type="text"
            value={witnessInput}
            maxLength={100}
            onChange={(e) => setWitnessInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addWitness()
              }
            }}
            autoCapitalize="words"
            enterKeyHint="done"
            placeholder="Witness name"
            className={inputCls}
          />
          <button type="button" onClick={addWitness} className="shrink-0 px-3 rounded-lg bg-mytra-bg border border-mytra-border text-fg-2 hover:text-fg min-h-[44px]">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {witnesses.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {witnesses.map((w, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-mytra-bg border border-mytra-border rounded-full pl-2.5 pr-1 py-1 text-fg-2">
                {w}
                <button type="button" onClick={() => setWitnesses((arr) => arr.filter((_, j) => j !== i))} aria-label="Remove witness" className="text-fg-3 hover:text-danger w-11 h-11 flex items-center justify-center -mr-1">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Photos */}
      <section className="bg-mytra-card border border-mytra-border rounded-card p-4 space-y-2 shadow-card">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">Photos</h4>
        <p className="text-xs text-fg-3">Tip: capture a wide shot, a close-up, and any equipment involved</p>
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.dataUrl} alt="Incident photo" className="w-20 h-20 object-cover rounded-lg border border-mytra-border" />
              <button
                type="button"
                onClick={() => setPhotos((arr) => arr.filter((x) => x.id !== p.id))}
                aria-label="Remove photo"
                className="absolute -top-3 -right-3 w-11 h-11 rounded-full flex items-center justify-center group"
              >
                <span className="w-7 h-7 bg-danger rounded-full flex items-center justify-center group-hover:bg-danger/80 transition-colors">
                  <X className="w-3.5 h-3.5 text-white" />
                </span>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-20 h-20 rounded-lg border border-dashed border-mytra-border text-fg-3 hover:text-fg hover:border-mytra-purple/50 flex flex-col items-center justify-center gap-1 transition-colors"
          >
            <Camera className="w-4 h-4" />
            <span className="text-xs">Add</span>
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            onFile(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />
      </section>

      {/* Root cause & corrective */}
      <section className="bg-mytra-card border border-mytra-border rounded-card p-4 space-y-3 shadow-card">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">Analysis</h4>
        <div>
          <label htmlFor="ir-root-cause" className={labelCls}>Root cause analysis</label>
          <textarea id="ir-root-cause" rows={2} maxLength={2000} value={rootCause} onChange={(e) => setRootCause(e.target.value)} className={textareaCls} />
        </div>
        <div>
          <label htmlFor="ir-corrective" className={labelCls}>Corrective actions to prevent recurrence</label>
          <textarea id="ir-corrective" rows={2} maxLength={2000} value={correctiveActions} onChange={(e) => setCorrectiveActions(e.target.value)} className={textareaCls} />
        </div>
      </section>

      {/* Reporter signature */}
      <section className="bg-mytra-card border border-mytra-border rounded-card p-4 space-y-3 shadow-card">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">Reporter</h4>
        <div>
          <label htmlFor="ir-reporter-name" className={labelCls}>Name</label>
          <input id="ir-reporter-name" type="text" maxLength={100} value={reporterName} onChange={(e) => setReporterName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Signature (optional)</label>
          <p className="text-xs text-fg-3 mb-2">
            By signing you certify this report is accurate to the best of your knowledge.
            Your signature is stored on this device with the report for recordkeeping.
          </p>
          <SignaturePad onChange={(url) => setReporterSig(url)} />
        </div>
      </section>

      {saveError && (
        <div className="flex items-start gap-2 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 text-xs text-danger">
          <span className="font-semibold shrink-0">Save failed:</span>
          <span>{saveError}</span>
        </div>
      )}
      <div className="sticky bottom-0 pb-4 pt-2 bg-gradient-to-t from-mytra-bg via-mytra-bg to-transparent">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="w-full py-3 rounded-lg text-sm font-semibold transition-colors bg-mytra-purple text-white hover:bg-mytra-purple-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {canSubmit ? 'File Report' : 'Describe what happened and add location'}
        </button>
      </div>
    </div>
  )
}
