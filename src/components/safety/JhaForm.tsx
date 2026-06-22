'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  ListChecks,
  CheckCircle2,
  RotateCcw,
  WifiOff,
  Send,
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  ChevronDown,
  Info,
  Upload,
  FileText,
  X,
} from 'lucide-react'
import type { JhaStep, RiskLevel } from '@/lib/safety-types'
import { RISK_COLORS, RISK_LABELS } from '@/lib/safety-types'
import {
  createJobHazardAnalysis,
  cryptoRandomId,
  markSubmittedForReview,
  getSafetyRecordById,
} from '@/lib/safety-records'
import { trySyncRecord } from '@/lib/safety-sync'
import { useFormDraft } from '@/lib/use-draft'
import { getCurrentIdentity } from '@/lib/identity'
import PPESelector from './PPESelector'
import { labelCls, inputCls, textareaCls } from '@/lib/form-styles'
import { haptic } from '@/lib/haptic'
import { localToday } from '@/lib/datetime'

const SAGE_ENABLED = process.env.NEXT_PUBLIC_AI_ASSIST === '1'

const RISK_ORDER: RiskLevel[] = ['low', 'medium', 'high', 'critical']

function todayStr(): string {
  return localToday()
}

/** Read a file as bare base64 (no data-URL prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      resolve(url.slice(url.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function blankStep(): JhaStep {
  return {
    id: cryptoRandomId(),
    taskActivity: '',
    hazards: '',
    riskLevel: 'low',
    controls: '',
    residualRiskLevel: 'low',
    responsible: '',
    source: 'manual',
  }
}

export default function JhaForm() {
  const [jobTitle, setJobTitle] = useState('')
  const [dateOfAnalysis, setDateOfAnalysis] = useState(todayStr())
  const [validUntil, setValidUntil] = useState('')
  const [department, setDepartment] = useState('')
  const [location, setLocation] = useState('')
  const [referenceDoc, setReferenceDoc] = useState('')
  const [ppe, setPpe] = useState<string[]>([])
  const [steps, setSteps] = useState<JhaStep[]>([blankStep()])
  const [additionalNotes, setAdditionalNotes] = useState('')

  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [wasOffline, setWasOffline] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [sageLoading, setSageLoading] = useState(false)
  const [sageError, setSageError] = useState<string | null>(null)

  const [docLoading, setDocLoading] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)
  const [docName, setDocName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const restore = useCallback((d: Record<string, unknown>) => {
    if (typeof d.jobTitle === 'string') setJobTitle(d.jobTitle)
    if (typeof d.dateOfAnalysis === 'string') setDateOfAnalysis(d.dateOfAnalysis)
    if (typeof d.validUntil === 'string') setValidUntil(d.validUntil)
    if (typeof d.department === 'string') setDepartment(d.department)
    if (typeof d.location === 'string') setLocation(d.location)
    if (typeof d.referenceDoc === 'string') setReferenceDoc(d.referenceDoc)
    if (Array.isArray(d.ppe)) setPpe(d.ppe as string[])
    if (Array.isArray(d.steps) && d.steps.length > 0) setSteps(d.steps as JhaStep[])
    if (typeof d.additionalNotes === 'string') setAdditionalNotes(d.additionalNotes)
  }, [])

  const { hasDraft, clearDraft, dismissDraft } = useFormDraft(
    'jha',
    () => ({ jobTitle, dateOfAnalysis, validUntil, department, location, referenceDoc, ppe, steps, additionalNotes }),
    restore,
    submittedId !== null
  )

  const filledSteps = steps.filter((s) => s.taskActivity.trim().length > 0)
  const canSubmit = jobTitle.trim().length > 0 && filledSteps.length > 0
  const canAskSage = filledSteps.length > 0

  function updateStep(id: string, patch: Partial<JhaStep>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  function addStep() {
    setSteps((prev) => [...prev, blankStep()])
  }

  function removeStep(id: string) {
    setSteps((prev) => (prev.length === 1 ? [blankStep()] : prev.filter((s) => s.id !== id)))
  }

  async function handleDocUpload(file: File) {
    setDocLoading(true)
    setDocError(null)
    setDocName(file.name)

    try {
      if (file.size > 3 * 1024 * 1024) {
        setDocError('File too large — keep it under 3 MB.')
        setDocLoading(false)
        return
      }

      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
      const payload: { documentText?: string; documentBase64?: string; fileName: string } = {
        fileName: file.name,
      }

      if (isPdf) {
        payload.documentBase64 = await fileToBase64(file)
      } else {
        const text = await file.text()
        if (text.trim().length < 20) {
          setDocError('Document appears empty or too short to extract steps from.')
          setDocLoading(false)
          return
        }
        payload.documentText = text.slice(0, 50_000)
      }

      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 55000)
      const res = await fetch('/api/safety/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to parse document' }))
        setDocError(data.error || 'Failed to parse document')
        return
      }
      const data = await res.json()

      if (data.suggestedTitle && !jobTitle.trim()) setJobTitle(data.suggestedTitle)
      if (data.suggestedLocation && !location.trim()) setLocation(data.suggestedLocation)
      if (data.suggestedDepartment && !department.trim()) setDepartment(data.suggestedDepartment)
      if (Array.isArray(data.suggestedPpe) && data.suggestedPpe.length > 0 && ppe.length === 0) {
        setPpe(data.suggestedPpe)
      }
      if (!referenceDoc.trim()) setReferenceDoc(file.name)

      if (Array.isArray(data.steps) && data.steps.length > 0) {
        const parsed: JhaStep[] = data.steps.map((s: { taskActivity: string; hazards: string; riskLevel: RiskLevel; controls: string; residualRiskLevel: RiskLevel }) => ({
          id: cryptoRandomId(),
          taskActivity: s.taskActivity,
          hazards: s.hazards,
          riskLevel: s.riskLevel,
          controls: s.controls,
          residualRiskLevel: s.residualRiskLevel,
          responsible: '',
          source: 'sage' as const,
        }))
        // Functional update: the parse takes many seconds — don't clobber
        // steps the user typed while Sage was reading the document.
        setSteps((prev) =>
          prev.some((s) => s.taskActivity.trim().length > 0) ? [...prev, ...parsed] : parsed
        )
      }
    } catch (err) {
      setDocError(
        err instanceof DOMException && err.name === 'AbortError'
          ? 'Request timed out — try a smaller document'
          : 'Network error — check your connection'
      )
    } finally {
      setDocLoading(false)
    }
  }

  async function askSage() {
    setSageLoading(true)
    setSageError(null)
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 55000)
      // Only analyse steps that have a task activity, preserving their order.
      const indexed = steps
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.taskActivity.trim().length > 0)
      const res = await fetch('/api/safety/suggest-jha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobTitle, steps: indexed.map(({ s }) => s.taskActivity) }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        setSageError(data.error ?? `Request failed (${res.status})`)
        return
      }
      const data = await res.json()
      if (data?.error) {
        setSageError(data.error)
        return
      }
      const analysed: { hazards: string; riskLevel: RiskLevel; controls: string; residualRiskLevel?: RiskLevel }[] = Array.isArray(data?.steps)
        ? data.steps
        : []
      setSteps((prev) => {
        const next = [...prev]
        indexed.forEach(({ i }, k) => {
          const a = analysed[k]
          if (!a) return
          next[i] = {
            ...next[i],
            hazards: next[i].hazards.trim() ? next[i].hazards : a.hazards,
            riskLevel: next[i].riskLevel !== 'medium' ? next[i].riskLevel : (a.riskLevel ?? next[i].riskLevel),
            controls: next[i].controls.trim() ? next[i].controls : a.controls,
            residualRiskLevel: next[i].residualRiskLevel ? next[i].residualRiskLevel : (a.residualRiskLevel ?? next[i].residualRiskLevel),
            source: 'sage',
          }
        })
        return next
      })
    } catch (err) {
      setSageError(
        err instanceof DOMException && err.name === 'AbortError'
          ? 'Request timed out — try again'
          : 'Network error — check your connection'
      )
    } finally {
      setSageLoading(false)
    }
  }

  const submitGuard = useRef(false)
  function handleSubmit() {
    if (!canSubmit || submitGuard.current) return
    submitGuard.current = true
    setSaveError(null)
    let record: ReturnType<typeof createJobHazardAnalysis>
    try {
      record = createJobHazardAnalysis({
        jobTitle,
        dateOfAnalysis,
        validUntil: validUntil || undefined,
        department,
        location,
        projectName: jobTitle,
        referenceDoc,
        ppeRequired: ppe,
        steps: filledSteps,
        additionalNotes,
        signatures: [],
        preparedBySignatureId: null,
      })
    } catch (e) {
      submitGuard.current = false
      setSaveError(e instanceof Error ? e.message : 'Failed to save — device storage may be full.')
      return
    }
    void trySyncRecord(record.id)
    clearDraft()
    setWasOffline(!navigator.onLine)
    setSubmittedId(record.id)
  }

  function resetNew() {
    clearDraft()
    setWasOffline(false)
    setJobTitle('')
    setDateOfAnalysis(todayStr())
    setValidUntil('')
    setDepartment('')
    setLocation('')
    setReferenceDoc('')
    setPpe([])
    setSteps([blankStep()])
    setAdditionalNotes('')
    setSubmittedId(null)
  }

  // ── DONE ──────────────────────────────────────────────────
  if (submittedId) {
    return <JhaDone submittedId={submittedId} stepCount={filledSteps.length} wasOffline={wasOffline} onNew={resetNew} />
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

      {/* Document upload */}
      {SAGE_ENABLED && !submittedId && (
        <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 shadow-card space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-mytra-purple" />
            <h3 className="text-sm font-semibold text-fg">Import from document</h3>
            <span className="text-xs bg-mytra-purple/15 text-mytra-purple px-1.5 py-0.5 rounded font-medium">Optional</span>
          </div>
          <p className="text-xs text-fg-3">
            Upload a task plan, method statement, or scope of work and Sage will extract the steps,
            hazards, and controls to pre-fill your JHA.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.csv,.tsv,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleDocUpload(file)
              e.target.value = ''
            }}
          />
          {docName && !docLoading && !docError && (
            <div className="flex items-center gap-2 bg-ok/10 border border-ok/20 rounded-lg px-3 py-2 animate-fadeIn">
              <FileText className="w-4 h-4 text-ok shrink-0" />
              <p className="text-xs text-ok flex-1 truncate">Imported from {docName}</p>
              <button
                type="button"
                onClick={() => setDocName(null)}
                className="text-ok/60 hover:text-ok"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {docError && (
            <div className="flex items-start gap-2 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 animate-fadeIn">
              <span className="text-xs text-danger">{docError}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={docLoading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium
                       bg-mytra-purple-glow border border-mytra-purple/30 text-mytra-purple
                       hover:border-mytra-purple/60 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {docLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Sage is reading your document…</>
            ) : (
              <><Upload className="w-4 h-4" /> Upload a document</>
            )}
          </button>
          <p className="text-xs text-fg-4 text-center">
            Supports .txt, .md, .csv, and .pdf (up to 3MB)
          </p>
        </div>
      )}

      {/* Job / task information */}
      <div data-tour-module="jha-info" className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-4 shadow-card">
        <div className="flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-mytra-purple" />
          <h3 className="text-sm font-semibold text-fg">Job / Task Information</h3>
        </div>
        <div>
          <label htmlFor="jha-title" className={labelCls}>Job / Task title</label>
          <input id="jha-title" type="text" maxLength={200} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Install conveyor drive unit on Line 3" className={inputCls} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="jha-date" className={labelCls}>Date of analysis</label>
            <input id="jha-date" type="date" value={dateOfAnalysis} onChange={(e) => { setDateOfAnalysis(e.target.value); if (validUntil && e.target.value > validUntil) setValidUntil('') }} className={inputCls} />
          </div>
          <div>
            <label htmlFor="jha-valid-until" className={labelCls}>Valid through</label>
            <input id="jha-valid-until" type="date" value={validUntil} min={dateOfAnalysis} max={dateOfAnalysis ? (() => { const d = new Date(dateOfAnalysis + 'T00:00:00'); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10) })() : undefined} onChange={(e) => setValidUntil(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="jha-dept" className={labelCls}>Department / Team</label>
            <input id="jha-dept" type="text" maxLength={120} value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Field Install" className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="jha-location" className={labelCls}>Location / Area</label>
            <input id="jha-location" type="text" maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Bay 4, grid C2" className={inputCls} />
          </div>
          <div>
            <label htmlFor="jha-ref" className={labelCls}>Reference doc (WO, drawing #)</label>
            <input id="jha-ref" type="text" maxLength={120} value={referenceDoc} onChange={(e) => setReferenceDoc(e.target.value)} placeholder="Optional" className={inputCls} />
          </div>
        </div>
      </div>

      {/* PPE */}
      <section className="space-y-2">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold px-1">PPE Required</h4>
        <PPESelector selected={ppe} onChange={setPpe} />
      </section>

      {/* Risk matrix guide */}
      <RiskMatrixGuide />

      {/* Task steps */}
      <section data-tour-module="jha-steps" className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">Task Steps</h4>
          <span className="text-xs text-fg-4">{filledSteps.length} step{filledSteps.length === 1 ? '' : 's'}</span>
        </div>
        <p className="text-xs text-fg-4 px-1">
          Break the job into the order you&apos;ll actually do it. List each step first — then let Sage
          help identify the hazards and controls for every step.
        </p>

        {steps.map((step, i) => (
          <div key={step.id} className="bg-mytra-card border border-mytra-border rounded-lg p-3 space-y-3 shadow-card">
            <div className="flex items-start gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-mytra-purple/15 text-mytra-purple text-xs font-semibold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <textarea
                  rows={2}
                  maxLength={300}
                  value={step.taskActivity}
                  onChange={(e) => updateStep(step.id, { taskActivity: e.target.value })}
                  placeholder={`Step ${i + 1} — what is done in this part of the job?`}
                  aria-label={`Step ${i + 1} task or activity`}
                  className={textareaCls}
                />
              </div>
              <button
                type="button"
                onClick={() => removeStep(step.id)}
                aria-label={`Remove step ${i + 1}`}
                className="shrink-0 w-11 h-11 flex items-center justify-center rounded-lg text-fg-4 hover:text-danger hover:bg-danger/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Hazard / risk / control detail — always accessible for manual entry */}
            {(step.hazards || step.controls || step.responsible || step.source === 'sage' || step.showDetail) ? (
              <div className="pl-8 space-y-3 animate-fadeIn">
                <div>
                  <label className={labelCls}>
                    Hazard(s) identified
                    {step.source === 'sage' && <span className="text-mytra-purple ml-1">✨ Sage</span>}
                  </label>
                  <textarea
                    rows={2}
                    maxLength={600}
                    value={step.hazards}
                    onChange={(e) => updateStep(step.id, { hazards: e.target.value, source: 'manual' })}
                    placeholder="One hazard per line"
                    className={textareaCls}
                  />
                </div>
                <div>
                  <span className={labelCls}>Risk level</span>
                  <RiskPillRow
                    before={step.riskLevel}
                    after={step.residualRiskLevel ?? 'low'}
                    onBeforeChange={(lvl) => updateStep(step.id, { riskLevel: lvl })}
                    onAfterChange={(lvl) => updateStep(step.id, { residualRiskLevel: lvl })}
                    stepLabel={`Step ${i + 1}`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Controls / mitigations</label>
                  <textarea
                    rows={2}
                    maxLength={600}
                    value={step.controls}
                    onChange={(e) => updateStep(step.id, { controls: e.target.value, source: 'manual' })}
                    placeholder="Specific controls to reduce risk"
                    className={textareaCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Responsible (DRI)</label>
                  <input
                    type="text"
                    maxLength={120}
                    value={step.responsible}
                    onChange={(e) => updateStep(step.id, { responsible: e.target.value })}
                    placeholder="Who owns this control?"
                    className={inputCls}
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => updateStep(step.id, { showDetail: true })}
                className="ml-8 inline-flex items-center gap-1.5 text-xs text-mytra-purple hover:text-mytra-purple-hover transition-colors py-1"
              >
                <Plus className="w-3 h-3" />
                Add hazards &amp; controls
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addStep}
          className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium
                     bg-mytra-card border border-mytra-border text-fg-2 hover:text-fg hover:bg-mytra-card-hover transition-colors"
        >
          <Plus className="w-4 h-4" /> Add step
        </button>

        {/* Sage analysis */}
        {SAGE_ENABLED && (
          <div className="pt-1">
            <button
              type="button"
              onClick={askSage}
              disabled={!canAskSage || sageLoading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium
                         bg-mytra-purple-glow border border-mytra-purple/30 text-mytra-purple
                         hover:border-mytra-purple/60 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sageLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sage is analyzing each step…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Ask Sage to analyze steps</>
              )}
            </button>
            {!canAskSage && !sageLoading && (
              <p className="text-xs text-fg-4 mt-1 text-center">List at least one task step first</p>
            )}
            {sageError && <p className="text-xs text-danger mt-1 text-center">{sageError}</p>}
            {filledSteps.some((s) => s.source === 'sage') && (
              <p className="text-xs text-fg-4 mt-2 text-center">
                AI analysis is a starting point — review and edit before submitting for EHS review.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Additional notes */}
      <section className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-2 shadow-card">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">Special Conditions / Notes</h4>
        <textarea
          rows={2}
          maxLength={2000}
          value={additionalNotes}
          onChange={(e) => setAdditionalNotes(e.target.value)}
          placeholder="Context from any meetings, special conditions, etc."
          className={textareaCls}
        />
      </section>

      {saveError && (
        <div className="flex items-start gap-2 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 text-xs text-danger">
          <span className="font-semibold shrink-0">Save failed:</span>
          <span>{saveError}</span>
        </div>
      )}

      <div className="sticky bottom-0 pb-4 pt-4 bg-gradient-to-t from-mytra-bg from-60% to-transparent">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-3 rounded-lg text-sm font-semibold transition-colors bg-mytra-purple text-white hover:bg-mytra-purple-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {canSubmit ? 'Save Job Hazard Analysis' : 'Enter a job title and at least one step'}
        </button>
      </div>
    </div>
  )
}

function RiskPillRow({
  before,
  after,
  onBeforeChange,
  onAfterChange,
  stepLabel,
}: {
  before: RiskLevel
  after: RiskLevel
  onBeforeChange: (lvl: RiskLevel) => void
  onAfterChange: (lvl: RiskLevel) => void
  stepLabel: string
}) {
  const [openPicker, setOpenPicker] = useState<'before' | 'after' | null>(null)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <RiskPill
          label="Before"
          value={before}
          open={openPicker === 'before'}
          onToggle={() => setOpenPicker(openPicker === 'before' ? null : 'before')}
          ariaLabel={`${stepLabel} risk before controls`}
        />
        <span className="text-fg-4 text-xs">→</span>
        <RiskPill
          label="After"
          value={after}
          open={openPicker === 'after'}
          onToggle={() => setOpenPicker(openPicker === 'after' ? null : 'after')}
          ariaLabel={`${stepLabel} residual risk after controls`}
        />
      </div>
      {openPicker && (
        <div className="flex gap-1.5 animate-fadeIn" role="radiogroup" aria-label={openPicker === 'before' ? `${stepLabel} risk before controls` : `${stepLabel} risk after controls`}>
          {RISK_ORDER.map((lvl) => {
            const current = openPicker === 'before' ? before : after
            const on = current === lvl
            return (
              <button
                key={lvl}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  if (openPicker === 'before') onBeforeChange(lvl)
                  else onAfterChange(lvl)
                  setOpenPicker(null)
                }}
                className="flex-1 text-xs font-medium py-2 rounded-lg border transition-colors min-h-[44px]"
                style={
                  on
                    ? { backgroundColor: `color-mix(in srgb, ${RISK_COLORS[lvl]} 18%, transparent)`, borderColor: RISK_COLORS[lvl], color: RISK_COLORS[lvl] }
                    : undefined
                }
              >
                {RISK_LABELS[lvl]}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RiskPill({
  label,
  value,
  open,
  onToggle,
  ariaLabel,
}: {
  label: string
  value: RiskLevel
  open: boolean
  onToggle: () => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={ariaLabel}
      aria-expanded={open}
      className="flex-1 flex items-center gap-2 min-h-[44px] px-3 py-2 rounded-lg border transition-colors"
      style={{
        backgroundColor: `color-mix(in srgb, ${RISK_COLORS[value]} 12%, transparent)`,
        borderColor: `color-mix(in srgb, ${RISK_COLORS[value]} 40%, transparent)`,
      }}
    >
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: RISK_COLORS[value] }} />
      <span className="text-xs text-fg-3">{label}:</span>
      <span className="text-xs font-semibold" style={{ color: RISK_COLORS[value] }}>
        {RISK_LABELS[value]}
      </span>
      <ChevronDown className={`w-3 h-3 text-fg-4 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
  )
}

const SEVERITY = ['Negligible', 'Minor', 'Moderate', 'Major', 'Catastrophic'] as const
const LIKELIHOOD = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'] as const

function matrixLevel(s: number, l: number): RiskLevel {
  const score = (s + 1) * (l + 1)
  if (score >= 16) return 'critical'
  if (score >= 10) return 'high'
  if (score >= 5) return 'medium'
  return 'low'
}

function RiskMatrixGuide() {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-mytra-card border border-mytra-border rounded-lg shadow-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-fg hover:bg-mytra-card-hover transition-colors min-h-[44px]"
      >
        <span className="flex items-center gap-2">
          <Info className="w-4 h-4 text-mytra-purple" />
          Risk Matrix Guide
        </span>
        <ChevronDown className={`w-4 h-4 text-fg-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 animate-fadeIn space-y-3">
          <p className="text-xs text-fg-3">
            Rate risk by multiplying <strong>Severity</strong> (how bad) by <strong>Likelihood</strong> (how
            probable). Rate <em>before</em> controls to show inherent risk, then <em>after</em> controls to show
            residual risk.
          </p>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-xs border-collapse min-w-[320px]">
              <thead>
                <tr>
                  <th className="p-1.5 text-left text-fg-4 font-normal" />
                  {SEVERITY.map((s) => (
                    <th key={s} className="p-1.5 text-center text-fg-3 font-medium">{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LIKELIHOOD.map((l, li) => (
                  <tr key={l}>
                    <td className="p-1.5 text-fg-3 font-medium whitespace-nowrap">{l}</td>
                    {SEVERITY.map((_, si) => {
                      const level = matrixLevel(si, li)
                      return (
                        <td key={si} className="p-1">
                          <div
                            className="rounded text-center py-1 font-semibold"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${RISK_COLORS[level]} 20%, transparent)`,
                              color: RISK_COLORS[level],
                            }}
                          >
                            {(si + 1) * (li + 1)}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            {RISK_ORDER.map((lvl) => (
              <span
                key={lvl}
                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded"
                style={{
                  backgroundColor: `color-mix(in srgb, ${RISK_COLORS[lvl]} 18%, transparent)`,
                  color: RISK_COLORS[lvl],
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: RISK_COLORS[lvl] }} />
                {RISK_LABELS[lvl]}
                {lvl === 'low' && ' (1–4)'}
                {lvl === 'medium' && ' (5–9)'}
                {lvl === 'high' && ' (10–15)'}
                {lvl === 'critical' && ' (16–25)'}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function JhaDone({ submittedId, stepCount, wasOffline, onNew }: { submittedId: string; stepCount: number; wasOffline: boolean; onNew: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const ehsEnabled = process.env.NEXT_PUBLIC_EHS_REVIEW === '1'

  useEffect(() => { headingRef.current?.focus(); haptic('success') }, [])

  useEffect(() => {
    if (!ehsEnabled) return
    const identity = getCurrentIdentity()
    const by = { name: identity?.name ?? 'Unknown', email: identity?.email ?? null }
    const rec = getSafetyRecordById(submittedId)
    if (rec) {
      fetch('/api/safety/review/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record: rec, notionPageId: rec.notionPageId }),
      })
        .then((res) => { if (res.ok) markSubmittedForReview(submittedId, by) })
        .catch(() => {})
    }
  }, [ehsEnabled, submittedId])

  return (
    <div className="animate-fadeIn space-y-4">
      <div className="bg-ok/10 border border-ok/20 rounded-lg p-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-ok mx-auto mb-3" />
        <h3 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-ok mb-1 outline-none">JHA Saved</h3>
        <p className="text-sm text-ok">
          {stepCount} step{stepCount === 1 ? '' : 's'} analyzed. Recorded as{' '}
          <span className="font-mono text-fg">{submittedId}</span>.
        </p>
      </div>
      {wasOffline && (
        <div className="flex items-center gap-2 bg-warn/10 border border-warn/20 rounded-lg px-4 py-2.5">
          <WifiOff className="w-4 h-4 text-warn shrink-0" />
          <p className="text-xs text-warn">Saved locally. Will sync automatically when connection returns.</p>
        </div>
      )}
      {ehsEnabled && (
        <div className="flex items-center gap-2 bg-mytra-purple-glow border border-mytra-purple/20 rounded-lg px-4 py-2.5">
          <Send className="w-4 h-4 text-mytra-purple shrink-0" />
          <p className="text-xs text-mytra-purple">Automatically submitted for EHS review</p>
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
        Start new JHA
      </button>
      <Link href="/safety" className="block text-center text-sm text-fg-2 hover:text-fg">
        Back to Home
      </Link>
    </div>
  )
}
