'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { PackageOpen, RotateCcw, AlertTriangle, CheckCircle2, Info, Sparkles, ChevronDown, Loader2 } from 'lucide-react'
import { analyzeAtmosphere, type AtmoAlert } from '@/lib/atmo-check'
import ConfirmDialog from '@/components/ConfirmDialog'
import { createConfinedSpacePermit, saveSignatures } from '@/lib/safety-records'
import { trySyncRecord } from '@/lib/safety-sync'
import { isReviewEnabled, submitForReview, type ReviewSubmitState } from '@/lib/review-submit'
import { useFormDraft } from '@/lib/use-draft'
import { getLastContext, saveLastContext } from '@/lib/use-last-context'
import LastUsedChip from './LastUsedChip'
import { buildPermitItems, CONFINED_SPACE_HAZARDS } from '@/data/safety-checklists'
import type { PermitCheckItem } from '@/lib/safety-types'
import { defaultValidityWindow, toIso, toLocalInput } from '@/lib/datetime'
import PermitChecklist, { criticalRemaining } from './PermitChecklist'
import ChipMultiSelect from './ChipMultiSelect'
import CrewSignatureBlock, { type SignatureData } from './CrewSignatureBlock'
import FormSuccess from './FormSuccess'
import { labelCls, inputCls, textareaCls, btnPrimaryCls } from '@/lib/form-styles'
import { haptic } from '@/lib/haptic'
import FormStepper, { useActiveStep, type FormStep } from './FormStepper'
import ValidationSummary, { type ValidationError } from './ValidationSummary'
import { useT } from '@/lib/i18n'

function outOfRange(value: string, range: { min?: number; max?: number }): boolean {
  if (value.trim() === '') return false
  const n = parseFloat(value)
  if (Number.isNaN(n)) return false
  if (range.min !== undefined && n < range.min) return true
  if (range.max !== undefined && n > range.max) return true
  return false
}

export default function ConfinedSpaceForm() {
  const t = useT()
  const win = defaultValidityWindow(4)
  const [projectName, setProjectName] = useState('')
  const [location, setLocation] = useState('')
  const [spaceDescription, setSpaceDescription] = useState('')
  const [hazards, setHazards] = useState<string[]>([])
  const [oxygen, setOxygen] = useState('')
  const [lel, setLel] = useState('')
  const [co, setCo] = useState('')
  const [h2s, setH2s] = useState('')
  const [testedBy, setTestedBy] = useState('')
  const [testedAt, setTestedAt] = useState(toLocalInput(new Date()))
  const [continuousMonitoring, setContinuousMonitoring] = useState(false)
  const [ventilationInUse, setVentilationInUse] = useState(false)
  const [rescuePlan, setRescuePlan] = useState('')
  const [checklist, setChecklist] = useState<PermitCheckItem[]>(() => buildPermitItems('confined-space'))
  const [attendantName, setAttendantName] = useState('')
  const [validFrom, setValidFrom] = useState(win.from)
  const [validUntil, setValidUntil] = useState(win.until)
  const [sigData, setSigData] = useState<SignatureData>({ signatures: [], blobs: {} })
  const [supervisorId, setSupervisorId] = useState<string | null>(null)
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [reviewState, setReviewState] = useState<ReviewSubmitState | null>(null)
  const [wasOffline, setWasOffline] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastCtx] = useState(getLastContext)
  const [aiAnalysis, setAiAnalysis] = useState<{ safe: boolean; alerts: { gas: string; reading: number; threshold: string; severity: string; guidance: string }[]; recommendations: string[] } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiExpanded, setAiExpanded] = useState(true)

  const restore = useCallback((d: Record<string, unknown>) => {
    if (typeof d.projectName === 'string') setProjectName(d.projectName)
    if (typeof d.location === 'string') setLocation(d.location)
    if (typeof d.spaceDescription === 'string') setSpaceDescription(d.spaceDescription)
    if (Array.isArray(d.hazards)) setHazards(d.hazards)
    if (typeof d.oxygen === 'string') setOxygen(d.oxygen)
    if (typeof d.lel === 'string') setLel(d.lel)
    if (typeof d.co === 'string') setCo(d.co)
    if (typeof d.h2s === 'string') setH2s(d.h2s)
    if (typeof d.testedBy === 'string') setTestedBy(d.testedBy)
    if (typeof d.continuousMonitoring === 'boolean') setContinuousMonitoring(d.continuousMonitoring)
    if (typeof d.ventilationInUse === 'boolean') setVentilationInUse(d.ventilationInUse)
    if (typeof d.rescuePlan === 'string') setRescuePlan(d.rescuePlan)
    if (typeof d.attendantName === 'string') setAttendantName(d.attendantName)
  }, [])

  const { hasDraft, clearDraft, dismissDraft } = useFormDraft(
    'confined-space-permit',
    () => ({ projectName, location, spaceDescription, hazards, oxygen, lel, co, h2s, testedBy, continuousMonitoring, ventilationInUse, rescuePlan, attendantName }),
    restore,
    submittedId !== null
  )

  const critLeft = criticalRemaining(checklist)
  const validFromMs = new Date(validFrom).getTime()
  const validUntilMs = new Date(validUntil).getTime()
  const validWindowDuration = validUntilMs - validFromMs
  const validWindowOk =
    !Number.isNaN(validFromMs) &&
    !Number.isNaN(validUntilMs) &&
    validFromMs >= Date.now() - 5 * 60 * 1000 &&
    validWindowDuration >= 30 * 60 * 1000 &&
    validWindowDuration <= 24 * 60 * 60 * 1000
  const atmoUnsafe =
    outOfRange(oxygen, { min: 19.5, max: 23.5 }) ||
    outOfRange(lel, { max: 10 }) ||
    outOfRange(co, { max: 35 }) ||
    outOfRange(h2s, { max: 10 })
  const prevAtmoUnsafe = useRef(false)
  useEffect(() => {
    if (atmoUnsafe && !prevAtmoUnsafe.current) haptic('error')
    prevAtmoUnsafe.current = atmoUnsafe
  }, [atmoUnsafe])
  const atmoAnalysis = useMemo(() => {
    const readings = {
      oxygen: oxygen.trim() ? parseFloat(oxygen) : null,
      lel: lel.trim() ? parseFloat(lel) : null,
      co: co.trim() ? parseFloat(co) : null,
      h2s: h2s.trim() ? parseFloat(h2s) : null,
    }
    if (readings.oxygen === null && readings.lel === null && readings.co === null && readings.h2s === null) return null
    if ((readings.oxygen !== null && Number.isNaN(readings.oxygen)) ||
        (readings.lel !== null && Number.isNaN(readings.lel)) ||
        (readings.co !== null && Number.isNaN(readings.co)) ||
        (readings.h2s !== null && Number.isNaN(readings.h2s))) return null
    return analyzeAtmosphere(readings, spaceDescription, hazards)
  }, [oxygen, lel, co, h2s, spaceDescription, hazards])

  const worstSeverity = useMemo(() => {
    if (!atmoAnalysis) return 'safe' as const
    const order = { safe: 0, warning: 1, danger: 2, idlh: 3 } as const
    let worst: AtmoAlert['severity'] = 'safe'
    for (const a of atmoAnalysis.alerts) {
      if (order[a.severity] > order[worst]) worst = a.severity
    }
    return worst
  }, [atmoAnalysis])

  const worstAlert = useMemo(() => {
    if (!atmoAnalysis) return null
    const order = { safe: 0, warning: 1, danger: 2, idlh: 3 } as const
    let worst: AtmoAlert | null = null
    for (const a of atmoAnalysis.alerts) {
      if (!worst || order[a.severity] > order[worst.severity]) worst = a
    }
    return worst && worst.severity !== 'safe' ? worst : null
  }, [atmoAnalysis])

  async function fetchAiAnalysis() {
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch('/api/safety/analyze-atmosphere', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readings: {
            oxygen: oxygen.trim() ? parseFloat(oxygen) : null,
            lel: lel.trim() ? parseFloat(lel) : null,
            co: co.trim() ? parseFloat(co) : null,
            h2s: h2s.trim() ? parseFloat(h2s) : null,
          },
          spaceDescription,
          hazards,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: t('permits.confinedSpace.requestFailed', undefined, 'Request failed') }))
        setAiError(data.error ?? t('permits.confinedSpace.requestFailed', undefined, 'Request failed'))
        return
      }
      const data = await res.json()
      setAiAnalysis(data.analysis)
    } catch {
      setAiError(t('permits.confinedSpace.networkError', undefined, 'Network error — check your connection'))
    } finally {
      setAiLoading(false)
    }
  }

  function alertForGas(gas: string): AtmoAlert | undefined {
    if (!atmoAnalysis) return undefined
    return atmoAnalysis.alerts.find((a) => a.gas === gas)
  }

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [showValidation, setShowValidation] = useState(false)
  const dismissValidation = useCallback(() => setShowValidation(false), [])
  const canSubmit =
    spaceDescription.trim().length > 0 &&
    location.trim().length > 0 &&
    hazards.length > 0 &&
    attendantName.trim().length > 0 &&
    rescuePlan.trim().length > 0 &&
    critLeft === 0 &&
    !atmoUnsafe &&
    sigData.signatures.length >= 1 &&
    supervisorId !== null &&
    validWindowOk

  const stepIds = ['details', 'hazards', 'atmospheric', 'rescue', 'checklist', 'validity', 'signatures'] as const
  const steps: FormStep[] = [
    { id: 'details', label: t('permits.confinedSpace.stepDetails', undefined, 'Details'), complete: spaceDescription.trim().length > 0 && location.trim().length > 0 },
    { id: 'hazards', label: t('permits.confinedSpace.stepHazards', undefined, 'Hazards'), complete: hazards.length > 0 },
    { id: 'atmospheric', label: t('permits.confinedSpace.stepAtmoTest', undefined, 'Atmo Test'), complete: !atmoUnsafe && oxygen.trim() !== '' },
    { id: 'rescue', label: t('permits.confinedSpace.stepRescue', undefined, 'Rescue'), complete: attendantName.trim().length > 0 && rescuePlan.trim().length > 0 },
    { id: 'checklist', label: t('permits.confinedSpace.stepChecklist', undefined, 'Checklist'), complete: critLeft === 0 },
    { id: 'validity', label: t('permits.confinedSpace.stepValidity', undefined, 'Validity'), complete: validWindowOk },
    { id: 'signatures', label: t('permits.confinedSpace.stepSignatures', undefined, 'Signatures'), complete: sigData.signatures.length >= 1 && supervisorId !== null },
  ]
  const activeStepId = useActiveStep([...stepIds])

  const validationErrors = useMemo((): ValidationError[] => {
    const errs: ValidationError[] = []
    if (!spaceDescription.trim()) errs.push({ label: t('permits.confinedSpace.errDescribeSpace', undefined, 'Describe the confined space'), fieldId: 'cs-space' })
    if (!location.trim()) errs.push({ label: t('permits.confinedSpace.errLocationRequired', undefined, 'Location is required'), fieldId: 'cs-location' })
    if (hazards.length === 0) errs.push({ label: t('permits.confinedSpace.errIdentifyHazard', undefined, 'Identify at least one hazard'), fieldId: 'cs-hazards' })
    if (!attendantName.trim()) errs.push({ label: t('permits.confinedSpace.errAssignAttendant', undefined, 'Assign an attendant'), fieldId: 'cs-attendant' })
    if (!rescuePlan.trim()) errs.push({ label: t('permits.confinedSpace.errAddRescuePlan', undefined, 'Add a rescue plan'), fieldId: 'cs-rescue' })
    if (atmoUnsafe) errs.push({ label: t('permits.confinedSpace.errAtmoUnsafe', undefined, 'Atmosphere outside safe limits'), fieldId: 'cs-atmo-o' })
    if (critLeft > 0) errs.push({ label: t('permits.confinedSpace.errCompleteChecklistItems', { count: critLeft, critLeft }), fieldId: 'cs-checklist' })
    if (Number.isNaN(validFromMs) || Number.isNaN(validUntilMs))
      errs.push({ label: t('permits.confinedSpace.errEnterValidDates', undefined, 'Enter valid dates for "Valid from" and "Valid until"'), fieldId: 'cs-valid-from' })
    else if (validFromMs < Date.now() - 5 * 60 * 1000)
      errs.push({ label: t('permits.confinedSpace.errValidFromPast', undefined, '"Valid from" cannot be in the past'), fieldId: 'cs-valid-from' })
    else if (validWindowDuration < 30 * 60 * 1000)
      errs.push({ label: t('permits.confinedSpace.errMinDuration', undefined, 'Permit must be valid for at least 30 minutes'), fieldId: 'cs-valid-until' })
    else if (validWindowDuration > 24 * 60 * 60 * 1000)
      errs.push({ label: t('permits.confinedSpace.errMaxDuration', undefined, 'Confined space permit cannot exceed 24 hours'), fieldId: 'cs-valid-until' })
    if (supervisorId === null) errs.push({ label: t('permits.confinedSpace.errDesignateSupervisor', undefined, 'Designate the entry supervisor'), fieldId: 'cs-signatures' })
    if (sigData.signatures.length === 0) errs.push({ label: t('permits.confinedSpace.errEntrantMustSign', undefined, 'At least one entrant must sign on'), fieldId: 'cs-signatures' })
    return errs
  }, [spaceDescription, location, hazards.length, attendantName, rescuePlan, atmoUnsafe, critLeft, validWindowOk, validFromMs, validUntilMs, validWindowDuration, supervisorId, sigData.signatures.length, t])

  const submitGuard = useRef(false)
  function submit() {
    if (!canSubmit || submitGuard.current) return
    submitGuard.current = true
    setSaveError(null)
    let record: ReturnType<typeof createConfinedSpacePermit>
    try {
      record = createConfinedSpacePermit({
        projectName,
        location,
        spaceDescription,
        hazards,
        atmospheric: {
          oxygenPct: oxygen,
          lelPct: lel,
          coPpm: co,
          h2sPpm: h2s,
          testedBy,
          testedAt: toIso(testedAt),
        },
        continuousMonitoring,
        ventilationInUse,
        rescuePlan,
        checklist,
        entrySupervisorSignatureId: supervisorId,
        attendantName,
        entrants: sigData.signatures,
        validFrom: toIso(validFrom),
        validUntil: toIso(validUntil),
      })
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t('permits.confinedSpace.saveRecordFailed', undefined, 'Failed to save record — device storage may be full.'))
      return
    }
    const blobs = Object.entries(sigData.blobs).map(([id, dataUrl]) => ({ id, dataUrl }))
    saveSignatures(record.id, blobs).catch((e) => console.error('signature save failed', e))
    void trySyncRecord(record.id)
    if (isReviewEnabled()) {
      setReviewState('pending')
      void submitForReview(record.id).then(setReviewState)
    }
    saveLastContext({ projectName, location })
    clearDraft()
    setWasOffline(!navigator.onLine)
    setSubmittedId(record.id)
  }

  function reset() {
    clearDraft()
    setWasOffline(false)
    const w = defaultValidityWindow(4)
    setProjectName('')
    setLocation('')
    setSpaceDescription('')
    setHazards([])
    setOxygen('')
    setLel('')
    setCo('')
    setH2s('')
    setTestedBy('')
    setTestedAt(toLocalInput(new Date()))
    setContinuousMonitoring(false)
    setVentilationInUse(false)
    setRescuePlan('')
    setChecklist(buildPermitItems('confined-space'))
    setAttendantName('')
    setValidFrom(w.from)
    setValidUntil(w.until)
    setSigData({ signatures: [], blobs: {} })
    setSupervisorId(null)
    setSubmittedId(null)
    setReviewState(null)
  }

  if (submittedId) {
    return (
      <FormSuccess
        id={submittedId}
        title={t('permits.confinedSpace.successTitle', undefined, 'Permit Issued')}
        message={t('permits.confinedSpace.successMessage', undefined, 'Confined Space Entry permit is active, logged as')}
        onNew={reset}
        newLabel={t('permits.confinedSpace.startNewPermit', undefined, 'Start new permit')}
        offline={wasOffline}
        reviewAutoSubmitted={reviewState}
        onRetryReview={() => {
          setReviewState('pending')
          void submitForReview(submittedId).then(setReviewState)
        }}
      />
    )
  }

  const atmoFields: { gas: string; fieldId: string; label: string; value: string; set: (v: string) => void; hint: string; range: { min?: number; max?: number } }[] = [
    { gas: 'O2', fieldId: 'cs-atmo-o', label: t('permits.confinedSpace.gasO2Label', undefined, 'O₂ %'), value: oxygen, set: setOxygen, hint: t('permits.confinedSpace.gasO2Hint', undefined, '19.5–23.5%'), range: { min: 19.5, max: 23.5 } },
    { gas: 'LEL', fieldId: 'cs-atmo-lel', label: t('permits.confinedSpace.gasLelLabel', undefined, 'LEL %'), value: lel, set: setLel, hint: t('permits.confinedSpace.gasLelHint', undefined, '< 10%'), range: { max: 10 } },
    { gas: 'CO', fieldId: 'cs-atmo-co-ppm', label: t('permits.confinedSpace.gasCoLabel', undefined, 'CO ppm'), value: co, set: setCo, hint: t('permits.confinedSpace.gasCoHint', undefined, '< 35 ppm'), range: { max: 35 } },
    { gas: 'H2S', fieldId: 'cs-atmo-h-s-ppm', label: t('permits.confinedSpace.gasH2sLabel', undefined, 'H₂S ppm'), value: h2s, set: setH2s, hint: t('permits.confinedSpace.gasH2sHint', undefined, '< 10 ppm'), range: { max: 10 } },
  ]

  return (
    <div className="animate-fadeIn space-y-4">
      <FormStepper steps={steps} activeStepId={activeStepId} />
      {hasDraft && (
        <div className="flex items-center justify-between gap-2 bg-mytra-purple/10 border border-mytra-purple/20 rounded-lg px-4 py-2.5 animate-fadeIn">
          <div className="flex items-center gap-2 text-sm text-mytra-purple">
            <RotateCcw className="w-4 h-4" />
            <span>{t('common.draftRestored', undefined, 'Draft restored')}</span>
          </div>
          <button type="button" onClick={dismissDraft} className="text-xs text-fg-3 hover:text-fg-2 min-h-[44px] px-3 inline-flex items-center">
            {t('common.dismiss', undefined, 'Dismiss')}
          </button>
        </div>
      )}
      <div data-step="details" className="bg-mytra-card border border-mytra-border rounded-card p-4 space-y-4 shadow-card">
        <div className="flex items-center gap-2">
          <PackageOpen className="w-5 h-5 text-mytra-purple" />
          <h3 className="text-sm font-semibold text-fg">{t('permits.confinedSpace.title', undefined, 'Confined Space Entry Permit')}</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cs-project" className={labelCls}>{t('permits.confinedSpace.projectLabel', undefined, 'Project / Structure')}</label>
            <input id="cs-project" type="text" maxLength={200} value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder={t('permits.confinedSpace.projectPlaceholder', undefined, 'e.g. Tower B steel erection')} className={inputCls} />
            {lastCtx.projectName && <LastUsedChip label={t('permits.confinedSpace.lastUsedLabel', undefined, 'Last')} value={lastCtx.projectName} currentValue={projectName} onApply={setProjectName} />}
          </div>
          <div>
            <label htmlFor="cs-location" className={labelCls}>{t('permits.confinedSpace.locationLabel', undefined, 'Location / Area')}</label>
            <input id="cs-location" type="text" maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('permits.confinedSpace.locationPlaceholder', undefined, 'Level / grid')} className={inputCls} />
            {lastCtx.location && <LastUsedChip label={t('permits.confinedSpace.lastUsedLabel', undefined, 'Last')} value={lastCtx.location} currentValue={location} onApply={setLocation} />}
          </div>
        </div>
        <div>
          <label htmlFor="cs-description" className={labelCls}>{t('permits.confinedSpace.spaceDescriptionLabel', undefined, 'Space description')}</label>
          <textarea id="cs-description" rows={2} maxLength={2000} value={spaceDescription} onChange={(e) => setSpaceDescription(e.target.value)} placeholder={t('permits.confinedSpace.spaceDescriptionPlaceholder', undefined, 'Tank / vessel / vault…')} className={textareaCls} />
        </div>
      </div>

      <section id="cs-hazards" data-step="hazards" className="space-y-2">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold px-1">{t('permits.confinedSpace.hazardsPresent', undefined, 'Hazards present')}</h4>
        <ChipMultiSelect options={CONFINED_SPACE_HAZARDS} selected={hazards} onChange={setHazards} />
      </section>

      {worstAlert && (worstSeverity === 'danger' || worstSeverity === 'idlh') && (
        <div
          role="alert"
          aria-live="assertive"
          className={`sticky top-[56px] z-30 flex items-start gap-3 rounded-lg px-4 py-3 text-white font-semibold text-sm shadow-lg animate-fadeIn ${worstSeverity === 'idlh' ? 'bg-danger' : 'bg-danger/95 backdrop-blur-sm'}`}
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{t('permits.confinedSpace.bannerExceedsSafeLimit', {
            action: worstSeverity === 'idlh' ? t('permits.confinedSpace.bannerEvacuate', undefined, 'EVACUATE') : t('permits.confinedSpace.bannerStop', undefined, 'STOP'),
            gas: worstAlert.gas,
            reading: worstAlert.reading,
            unit: worstAlert.gas === 'O2' || worstAlert.gas === 'LEL' ? '%' : ' ppm',
            threshold: worstAlert.threshold,
            guidance: worstAlert.guidance.split(' — ').slice(1).join(' — '),
          }, '{action} — {gas} {reading}{unit} exceeds safe limit ({threshold}). {guidance}')}</span>
        </div>
      )}

      <div data-step="atmospheric" className="bg-mytra-card border border-mytra-border rounded-card p-4 space-y-3 shadow-card">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">
          {t('permits.confinedSpace.atmosphericTest', undefined, 'Atmospheric test')} <span className="text-fg-4 normal-case">{'·'} {t('permits.confinedSpace.atmoTestOrder', undefined, 'test O₂ → flammable → toxic')}</span>
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {atmoFields.map((f) => {
            const alert = alertForGas(f.gas)
            const sev = alert?.severity ?? 'safe'
            const bad = sev === 'danger' || sev === 'idlh'
            const warn = sev === 'warning'
            const fieldId = f.fieldId
            return (
              <div key={f.gas}>
                <label htmlFor={fieldId} className={labelCls}>
                  {f.label} <span className="text-fg-4">({f.hint})</span>
                </label>
                <input
                  id={fieldId}
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="next"
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  className={`${inputCls} ${bad ? 'border-danger ring-2 ring-danger/30' : warn ? 'border-warn ring-2 ring-warn/30' : ''}`}
                />
                {alert && sev === 'safe' && f.value.trim() !== '' && (
                  <p className="flex items-center gap-1 text-sm text-ok-strong mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    {t('permits.confinedSpace.withinLimits', undefined, 'Within limits')}
                  </p>
                )}
                {alert && sev === 'warning' && (
                  <p className="flex items-start gap-1 text-sm text-warn-strong mt-0.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {alert.guidance}
                  </p>
                )}
                {alert && (sev === 'danger' || sev === 'idlh') && (
                  <p className="flex items-start gap-1 text-sm text-danger-strong mt-0.5 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {alert.guidance}
                  </p>
                )}
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cs-tested-by" className={labelCls}>{t('permits.confinedSpace.testedByLabel', undefined, 'Tested by')}</label>
            <input id="cs-tested-by" type="text" maxLength={100} value={testedBy} onChange={(e) => setTestedBy(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="cs-tested-at" className={labelCls}>{t('permits.confinedSpace.testedAtLabel', undefined, 'Tested at')}</label>
            <input id="cs-tested-at" type="datetime-local" value={testedAt} onChange={(e) => setTestedAt(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-fg-2">
            <input type="checkbox" checked={continuousMonitoring} onChange={() => setContinuousMonitoring((v) => !v)} className="accent-mytra-purple w-5 h-5" />
            {t('permits.confinedSpace.continuousMonitoring', undefined, 'Continuous monitoring')}
          </label>
          <label className="flex items-center gap-2 text-sm text-fg-2">
            <input type="checkbox" checked={ventilationInUse} onChange={() => setVentilationInUse((v) => !v)} className="accent-mytra-purple w-5 h-5" />
            {t('permits.confinedSpace.ventilationInUse', undefined, 'Ventilation in use')}
          </label>
        </div>
      </div>

      {atmoAnalysis && atmoAnalysis.recommendations.length > 0 && (
        <div className="space-y-2 animate-fadeIn">
          {atmoAnalysis.recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-2 bg-warn/10 border border-warn/20 rounded-lg px-3 py-2">
              <Info className="w-4 h-4 text-warn shrink-0 mt-0.5" />
              <p className="text-xs text-fg-2">{rec}</p>
            </div>
          ))}
        </div>
      )}

      {process.env.NEXT_PUBLIC_AI_ASSIST === '1' && atmoAnalysis && !atmoAnalysis.safe && (
        <div className="animate-fadeIn">
          <div className="flex items-start gap-2 bg-warn/10 border border-warn/20 rounded-lg px-3 py-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
            <p className="text-xs text-fg-2">
              {t('permits.confinedSpace.aiAdvisory', undefined, 'AI analysis is advisory only and does not replace atmospheric monitoring by a competent person with calibrated instruments. Always follow your site-specific confined space entry procedures.')}
            </p>
          </div>
          {!aiAnalysis && !aiLoading && (
            <button
              type="button"
              onClick={fetchAiAnalysis}
              className="flex items-center gap-2 text-sm text-mytra-purple hover:text-mytra-purple-hover font-medium px-1 py-1 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              {t('permits.confinedSpace.deepAnalysisWithSage', undefined, 'Deep analysis with Sage')}
            </button>
          )}
          {aiLoading && (
            <div className="flex items-center gap-2 text-sm text-fg-3 px-1 py-1">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('permits.confinedSpace.sageAnalyzing', undefined, 'Sage is analyzing cross-gas interactions...')}
            </div>
          )}
          {aiError && (
            <div className="flex items-start gap-2 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 text-xs text-danger">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{aiError}</span>
            </div>
          )}
          {aiAnalysis && (
            <div className="bg-mytra-card border border-mytra-border rounded-card shadow-card overflow-hidden">
              <button
                type="button"
                onClick={() => setAiExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-fg hover:bg-mytra-border/20 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-mytra-purple" />
                  {t('permits.confinedSpace.sageAiAnalysis', undefined, 'Sage AI Analysis')}
                </span>
                <ChevronDown className={`w-4 h-4 text-fg-3 transition-transform ${aiExpanded ? 'rotate-180' : ''}`} />
              </button>
              {aiExpanded && (
                <div className="px-4 pb-3 space-y-2 border-t border-mytra-border pt-3">
                  {aiAnalysis.alerts.filter((a) => a.severity !== 'safe').map((a, i) => (
                    <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${a.severity === 'idlh' ? 'bg-danger/10 border border-danger/20 text-danger font-semibold' : a.severity === 'danger' ? 'bg-danger/10 border border-danger/20 text-danger' : 'bg-warn/10 border border-warn/20 text-warn'}`}>
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span><strong>{t('permits.confinedSpace.aiAlertLine', { gas: a.gas, reading: a.reading, unit: a.gas === 'O2' || a.gas === 'LEL' ? '%' : ' ppm', guidance: '' }, '{gas} {reading}{unit}: {guidance}').trimEnd()}</strong> {a.guidance}</span>
                    </div>
                  ))}
                  {aiAnalysis.recommendations.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-xs font-semibold text-fg-3 uppercase tracking-wider">{t('permits.confinedSpace.recommendations', undefined, 'Recommendations')}</p>
                      {aiAnalysis.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-2 bg-mytra-purple/5 border border-mytra-purple/10 rounded-lg px-3 py-2">
                          <Info className="w-3.5 h-3.5 text-mytra-purple shrink-0 mt-0.5" />
                          <p className="text-xs text-fg-2">{rec}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div data-step="rescue" className="bg-mytra-card border border-mytra-border rounded-card p-4 space-y-3 shadow-card">
        <div>
          <label htmlFor="cs-attendant" className={labelCls}>{t('permits.confinedSpace.attendantLabel', undefined, 'Attendant (stationed outside)')}</label>
          <input
            id="cs-attendant"
            type="text"
            value={attendantName}
            maxLength={100}
            onChange={(e) => setAttendantName(e.target.value)}
            autoCapitalize="words"
            placeholder={t('signature.name', undefined, 'Name')}
            className={`${inputCls} ${!attendantName.trim() ? 'border-warn/60' : ''}`}
          />
        </div>
        <div>
          <label htmlFor="cs-rescue" className={labelCls}>{t('permits.confinedSpace.rescuePlanLabel', undefined, 'Rescue plan')} <span className="text-danger">*</span></label>
          <textarea id="cs-rescue" rows={2} maxLength={2000} value={rescuePlan} onChange={(e) => setRescuePlan(e.target.value)} placeholder={t('permits.confinedSpace.rescuePlanPlaceholder', undefined, 'Non-entry retrieval / emergency services (required)')} className={`${textareaCls} ${!rescuePlan.trim() ? 'border-warn/60' : ''}`} />
        </div>
      </div>

      <section id="cs-checklist" data-step="checklist" className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">{t('permits.confinedSpace.preEntryChecklist', undefined, 'Pre-entry checklist')}</h4>
          {critLeft > 0 && <span className="text-xs text-warn">{t('permits.confinedSpace.requiredLeft', { count: critLeft, critLeft })}</span>}
        </div>
        <PermitChecklist items={checklist} onChange={setChecklist} />
      </section>

      <div data-step="validity" className="bg-mytra-card border border-mytra-border rounded-card p-4 space-y-3 shadow-card">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">{t('permits.confinedSpace.validityWindow', undefined, 'Validity window')}</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cs-valid-from" className={labelCls}>{t('permits.confinedSpace.validFromLabel', undefined, 'Valid from')}</label>
            <input id="cs-valid-from" type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="cs-valid-until" className={labelCls}>{t('permits.confinedSpace.validUntilLabel', undefined, 'Valid until')}</label>
            <input
              id="cs-valid-until"
              type="datetime-local"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className={`${inputCls} ${!validWindowOk ? 'border-danger/60' : ''}`}
            />
          </div>
        </div>
      </div>

      <section id="cs-signatures" data-step="signatures" className="bg-mytra-card border border-mytra-border rounded-card p-4 shadow-card">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold mb-1">{t('permits.confinedSpace.entrantSignOn', undefined, 'Entrant sign-on')}</h4>
        <p className="text-xs text-fg-2 mb-3">{t('permits.confinedSpace.entrantSignOnHint', undefined, 'Each entrant confirms understanding. Designate the entry supervisor.')}</p>
        <CrewSignatureBlock
          value={sigData}
          onChange={setSigData}
          supervisorId={supervisorId}
          onSupervisorChange={setSupervisorId}
          supervisorLabel={t('permits.confinedSpace.entrySupervisorShort', undefined, 'Entry Sup.')}
        />
      </section>

      {saveError && (
        <div className="flex items-start gap-2 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 text-xs text-danger">
          <span className="font-semibold shrink-0">{t('common.saveFailed', undefined, 'Save failed:')}</span>
          <span>{saveError}</span>
        </div>
      )}
      <ValidationSummary errors={validationErrors} show={showValidation} onDismiss={dismissValidation} />
      <div className="sticky bottom-0 pb-4 pt-2 bg-gradient-to-t from-mytra-bg via-mytra-bg to-transparent">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => { if (canSubmit) { setConfirmOpen(true) } else { setShowValidation(true) } }}
          className={`${btnPrimaryCls} w-full py-3 text-sm font-semibold`}
        >
          {!spaceDescription.trim() || !location.trim()
            ? t('permits.confinedSpace.btnDescribeSpaceLocation', undefined, 'Describe the space and location')
            : hazards.length === 0
              ? t('permits.confinedSpace.errIdentifyHazard', undefined, 'Identify at least one hazard')
              : critLeft > 0
                ? t('permits.confinedSpace.btnCompleteItems', { count: critLeft, critLeft })
                : atmoUnsafe
                  ? t('permits.confinedSpace.errAtmoUnsafe', undefined, 'Atmosphere outside safe limits')
                  : !attendantName.trim()
                    ? t('permits.confinedSpace.errAssignAttendant', undefined, 'Assign an attendant')
                    : !rescuePlan.trim()
                      ? t('permits.confinedSpace.errAddRescuePlan', undefined, 'Add a rescue plan')
                      : sigData.signatures.length === 0
                        ? t('permits.confinedSpace.btnEntrantsMustSign', undefined, 'Entrants must sign on')
                        : supervisorId === null
                          ? t('permits.confinedSpace.errDesignateSupervisor', undefined, 'Designate the entry supervisor')
                          : !validWindowOk
                            ? t('permits.confinedSpace.btnFixValidity', undefined, 'Fix validity window')
                            : t('permits.confinedSpace.issuePermit', undefined, 'Issue Permit')}
        </button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title={t('permits.confinedSpace.confirmTitle', undefined, 'Issue confined space entry permit?')}
        message={t('permits.confinedSpace.confirmMessage', { location: location || t('permits.confinedSpace.confirmLocationFallback', undefined, 'this location') })}
        confirmLabel={t('permits.confinedSpace.issuePermit', undefined, 'Issue Permit')}
        onConfirm={() => { setConfirmOpen(false); submit() }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
