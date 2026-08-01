'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import { Flame, RotateCcw } from 'lucide-react'
import FormStepper, { useActiveStep } from './FormStepper'
import type { FormStep } from './FormStepper'
import ValidationSummary from './ValidationSummary'
import type { ValidationError } from './ValidationSummary'
import ConfirmDialog from '@/components/ConfirmDialog'
import { createHotWorkPermit, saveSignatures } from '@/lib/safety-records'
import { trySyncRecord } from '@/lib/safety-sync'
import { isReviewEnabled, submitForReview, type ReviewSubmitState } from '@/lib/review-submit'
import { useFormDraft } from '@/lib/use-draft'
import { getLastContext, saveLastContext } from '@/lib/use-last-context'
import LastUsedChip from './LastUsedChip'
import { buildPermitItems, HOT_WORK_TYPES } from '@/data/safety-checklists'
import type { PermitCheckItem } from '@/lib/safety-types'
import { defaultValidityWindow, toIso } from '@/lib/datetime'
import PermitChecklist, { criticalRemaining } from './PermitChecklist'
import ChipMultiSelect from './ChipMultiSelect'
import CrewSignatureBlock, { type SignatureData } from './CrewSignatureBlock'
import FormSuccess from './FormSuccess'
import { labelCls, inputCls, textareaCls, btnPrimaryCls } from '@/lib/form-styles'
import { useT } from '@/lib/i18n'

export default function HotWorkPermitForm() {
  const t = useT()
  const win = defaultValidityWindow(8)
  const [projectName, setProjectName] = useState('')
  const [location, setLocation] = useState('')
  const [workDescription, setWorkDescription] = useState('')
  const [hotWorkTypes, setHotWorkTypes] = useState<string[]>([])
  const [checklist, setChecklist] = useState<PermitCheckItem[]>(() => buildPermitItems('hot-work'))
  const [fireWatchRequired, setFireWatchRequired] = useState(true)
  const [fireWatchName, setFireWatchName] = useState('')
  const [postDuration, setPostDuration] = useState(60)
  const [extinguisherLocation, setExtinguisherLocation] = useState('')
  const [extinguisherType, setExtinguisherType] = useState('ABC')
  const [sprinklerStatus, setSprinklerStatus] = useState('In service')
  const [gasTestRequired, setGasTestRequired] = useState(false)
  const [gasTestNotes, setGasTestNotes] = useState('')
  const [validFrom, setValidFrom] = useState(win.from)
  const [validUntil, setValidUntil] = useState(win.until)
  const [sigData, setSigData] = useState<SignatureData>({ signatures: [], blobs: {} })
  const [issuerId, setIssuerId] = useState<string | null>(null)
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [reviewState, setReviewState] = useState<ReviewSubmitState | null>(null)
  const [wasOffline, setWasOffline] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showValidation, setShowValidation] = useState(false)
  const [lastCtx] = useState(getLastContext)

  const restore = useCallback((d: Record<string, unknown>) => {
    if (typeof d.projectName === 'string') setProjectName(d.projectName)
    if (typeof d.location === 'string') setLocation(d.location)
    if (typeof d.workDescription === 'string') setWorkDescription(d.workDescription)
    if (Array.isArray(d.hotWorkTypes)) setHotWorkTypes(d.hotWorkTypes)
    if (typeof d.fireWatchRequired === 'boolean') setFireWatchRequired(d.fireWatchRequired)
    if (typeof d.fireWatchName === 'string') setFireWatchName(d.fireWatchName)
    if (typeof d.postDuration === 'number') setPostDuration(d.postDuration)
    if (typeof d.extinguisherLocation === 'string') setExtinguisherLocation(d.extinguisherLocation)
    if (typeof d.extinguisherType === 'string') setExtinguisherType(d.extinguisherType)
    if (typeof d.sprinklerStatus === 'string') setSprinklerStatus(d.sprinklerStatus)
    if (typeof d.gasTestRequired === 'boolean') setGasTestRequired(d.gasTestRequired)
    if (typeof d.gasTestNotes === 'string') setGasTestNotes(d.gasTestNotes)
  }, [])

  const { hasDraft, clearDraft, dismissDraft } = useFormDraft(
    'hot-work-permit',
    () => ({ projectName, location, workDescription, hotWorkTypes, fireWatchRequired, fireWatchName, postDuration, extinguisherLocation, extinguisherType, sprinklerStatus, gasTestRequired, gasTestNotes }),
    restore,
    submittedId !== null
  )

  const [confirmOpen, setConfirmOpen] = useState(false)
  const critLeft = criticalRemaining(checklist)
  const validFromMs = new Date(validFrom).getTime()
  const validUntilMs = new Date(validUntil).getTime()
  const validWindowOk =
    !Number.isNaN(validFromMs) &&
    !Number.isNaN(validUntilMs) &&
    validFromMs >= Date.now() - 5 * 60 * 1000 &&
    (validUntilMs - validFromMs) >= 30 * 60 * 1000
  const fireWatchOk = !fireWatchRequired || fireWatchName.trim().length > 0
  const canSubmit =
    workDescription.trim().length > 0 &&
    location.trim().length > 0 &&
    hotWorkTypes.length > 0 &&
    critLeft === 0 &&
    fireWatchOk &&
    postDuration >= 60 &&
    sigData.signatures.length >= 1 &&
    issuerId !== null &&
    validWindowOk

  const stepIds = useMemo(() => ['details', 'hot-work-type', 'fire-watch', 'checklist', 'validity', 'signatures'], [])

  const activeStepId = useActiveStep(stepIds)

  const steps: FormStep[] = useMemo(() => [
    { id: 'details', label: t('permits.hotWork.stepDetails', undefined, 'Details'), complete: workDescription.trim().length > 0 && location.trim().length > 0 },
    { id: 'hot-work-type', label: t('permits.hotWork.stepType', undefined, 'Hot Work Type'), complete: hotWorkTypes.length > 0 },
    { id: 'fire-watch', label: t('permits.hotWork.stepFireWatch', undefined, 'Fire Watch'), complete: fireWatchOk },
    { id: 'checklist', label: t('permits.hotWork.stepChecklist', undefined, 'Checklist'), complete: critLeft === 0 },
    { id: 'validity', label: t('permits.hotWork.stepValidity', undefined, 'Validity'), complete: validWindowOk },
    { id: 'signatures', label: t('permits.hotWork.stepSignatures', undefined, 'Signatures'), complete: sigData.signatures.length >= 1 && issuerId !== null },
  ], [t, workDescription, location, hotWorkTypes, fireWatchOk, critLeft, validWindowOk, sigData.signatures.length, issuerId])

  const validationErrors: ValidationError[] = useMemo(() => {
    const errs: ValidationError[] = []
    if (!workDescription.trim()) errs.push({ label: t('permits.hotWork.errDescriptionRequired', undefined, 'Work description is required'), fieldId: 'hw-description' })
    if (!location.trim()) errs.push({ label: t('permits.hotWork.errLocationRequired', undefined, 'Location is required'), fieldId: 'hw-location' })
    if (hotWorkTypes.length === 0) errs.push({ label: t('permits.hotWork.errTypeRequired', undefined, 'Select at least one hot work type'), fieldId: 'hot-work-type-section' })
    if (critLeft > 0) errs.push({ label: t('permits.hotWork.errChecklistRemaining', { count: critLeft, critLeft }), fieldId: 'checklist-section' })
    if (!fireWatchOk) errs.push({ label: t('permits.hotWork.errFireWatchRequired', undefined, 'Fire watch person must be assigned'), fieldId: 'hw-fire-watch' })
    if (sigData.signatures.length === 0) errs.push({ label: t('permits.hotWork.errWorkerSignature', undefined, 'At least one worker must sign on'), fieldId: 'signatures-section' })
    if (issuerId === null && sigData.signatures.length > 0) errs.push({ label: t('permits.hotWork.errIssuerRequired', undefined, 'Designate an issuer'), fieldId: 'signatures-section' })
    if (Number.isNaN(validFromMs) || Number.isNaN(validUntilMs))
      errs.push({ label: t('permits.hotWork.errInvalidDates', undefined, 'Enter valid dates for "Valid from" and "Valid until"'), fieldId: 'hw-valid-from' })
    else if (validFromMs < Date.now() - 5 * 60 * 1000)
      errs.push({ label: t('permits.hotWork.errValidFromPast', undefined, '"Valid from" cannot be in the past'), fieldId: 'hw-valid-from' })
    else if ((validUntilMs - validFromMs) < 30 * 60 * 1000)
      errs.push({ label: t('permits.hotWork.errMinDuration', undefined, 'Permit must be valid for at least 30 minutes'), fieldId: 'hw-valid-until' })
    return errs
  }, [t, workDescription, location, hotWorkTypes, critLeft, fireWatchOk, sigData.signatures.length, issuerId, validWindowOk, validFromMs, validUntilMs])

  const submitGuard = useRef(false)
  function submit() {
    if (!canSubmit || submitGuard.current) return
    submitGuard.current = true
    setSaveError(null)
    let record: ReturnType<typeof createHotWorkPermit>
    try {
      record = createHotWorkPermit({
        projectName,
        location,
        workDescription,
        hotWorkTypes,
        checklist,
        fireWatchRequired,
        fireWatchName,
        fireWatchPostDurationMin: postDuration,
        extinguisherLocation,
        extinguisherType,
        sprinklerStatus,
        gasTestRequired,
        gasTestNotes,
        validFrom: toIso(validFrom),
        validUntil: toIso(validUntil),
        workers: sigData.signatures,
        issuerSignatureId: issuerId,
      })
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t('permits.hotWork.saveFailedStorage', undefined, 'Failed to save record — device storage may be full.'))
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
    const w = defaultValidityWindow(8)
    setProjectName('')
    setLocation('')
    setWorkDescription('')
    setHotWorkTypes([])
    setChecklist(buildPermitItems('hot-work'))
    setFireWatchRequired(true)
    setFireWatchName('')
    setPostDuration(60)
    setExtinguisherLocation('')
    setExtinguisherType('ABC')
    setSprinklerStatus('In service')
    setGasTestRequired(false)
    setGasTestNotes('')
    setValidFrom(w.from)
    setValidUntil(w.until)
    setSigData({ signatures: [], blobs: {} })
    setIssuerId(null)
    setSubmittedId(null)
    setReviewState(null)
  }

  if (submittedId) {
    return (
      <FormSuccess
        id={submittedId}
        title={t('permits.hotWork.successTitle', undefined, 'Permit Issued')}
        message={t('permits.hotWork.successMessage', undefined, 'Hot Work permit is active, logged as')}
        onNew={reset}
        newLabel={t('permits.hotWork.startNewPermit', undefined, 'Start new permit')}
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
            <span>{t('common.draftRestored', undefined, 'Draft restored')}</span>
          </div>
          <button type="button" onClick={dismissDraft} className="text-xs text-fg-3 hover:text-fg-2 min-h-[44px] px-3 inline-flex items-center">
            {t('common.dismiss', undefined, 'Dismiss')}
          </button>
        </div>
      )}
      <FormStepper steps={steps} activeStepId={activeStepId} />
      <div data-step="details" className="bg-mytra-card border border-mytra-border rounded-card p-4 space-y-4 shadow-card">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-mytra-purple" />
          <h3 className="text-sm font-semibold text-fg">{t('permits.hotWork.title', undefined, 'Hot Work Permit')}</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="hw-project" className={labelCls}>{t('permits.hotWork.projectLabel', undefined, 'Project / Structure')}</label>
            <input id="hw-project" type="text" maxLength={200} value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder={t('permits.hotWork.projectPlaceholder', undefined, 'e.g. Tower B steel erection')} className={inputCls} />
            {lastCtx.projectName && <LastUsedChip label={t('permits.hotWork.lastUsed', undefined, 'Last')} value={lastCtx.projectName} currentValue={projectName} onApply={setProjectName} />}
          </div>
          <div>
            <label htmlFor="hw-location" className={labelCls}>{t('permits.hotWork.locationLabel', undefined, 'Location / Area')}</label>
            <input id="hw-location" type="text" maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('permits.hotWork.locationPlaceholder', undefined, 'Level / grid')} className={inputCls} />
            {lastCtx.location && <LastUsedChip label={t('permits.hotWork.lastUsed', undefined, 'Last')} value={lastCtx.location} currentValue={location} onApply={setLocation} />}
          </div>
        </div>
        <div>
          <label htmlFor="hw-description" className={labelCls}>{t('permits.hotWork.descriptionLabel', undefined, 'Work description')}</label>
          <textarea id="hw-description" rows={2} maxLength={2000} value={workDescription} onChange={(e) => setWorkDescription(e.target.value)} placeholder={t('permits.hotWork.descriptionPlaceholder', undefined, 'Describe the hot work to be performed')} className={textareaCls} />
        </div>
      </div>

      <section id="hot-work-type-section" data-step="hot-work-type" className="space-y-2">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold px-1">{t('permits.hotWork.typeHeading', undefined, 'Type of hot work')}</h4>
        <ChipMultiSelect options={HOT_WORK_TYPES} selected={hotWorkTypes} onChange={setHotWorkTypes} />
      </section>

      <div data-step="fire-watch" className="bg-mytra-card border border-mytra-border rounded-card p-4 space-y-3 shadow-card">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">{t('permits.hotWork.fireWatchHeading', undefined, 'Fire watch & suppression')}</h4>
        <label className="flex items-center gap-2 text-sm text-fg-2">
          <input type="checkbox" checked={fireWatchRequired} onChange={() => setFireWatchRequired((v) => !v)} className="accent-mytra-purple w-5 h-5" />
          {t('permits.hotWork.fireWatchRequired', undefined, 'Fire watch required')}
        </label>
        {fireWatchRequired && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="hw-fire-watch" className={labelCls}>{t('permits.hotWork.fireWatchAssignedLabel', undefined, 'Fire watch assigned')}</label>
              <input
                id="hw-fire-watch"
                type="text"
                value={fireWatchName}
                maxLength={100}
                onChange={(e) => setFireWatchName(e.target.value)}
                autoCapitalize="words"
                placeholder={t('permits.hotWork.fireWatchNamePlaceholder', undefined, 'Name')}
                className={`${inputCls} ${!fireWatchName.trim() ? 'border-warn/60' : ''}`}
              />
            </div>
            <div>
              <label htmlFor="hw-post-duration" className={labelCls}>{t('permits.hotWork.postDurationLabel', undefined, 'Post-work monitoring (min)')}</label>
              <input id="hw-post-duration" type="text" inputMode="numeric" value={postDuration} onChange={(e) => setPostDuration(parseInt(e.target.value) || 0)} className={`${inputCls} ${postDuration < 60 ? 'border-warn/60' : ''}`} />
              {postDuration < 60 && (
                <p className="text-xs text-warn mt-0.5">{t('permits.hotWork.nfpaFireWatchWarning', undefined, 'NFPA 51B requires minimum 60-minute fire watch')}</p>
              )}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="hw-extinguisher-loc" className={labelCls}>{t('permits.hotWork.extinguisherLocationLabel', undefined, 'Extinguisher location')}</label>
            <input id="hw-extinguisher-loc" type="text" maxLength={200} value={extinguisherLocation} onChange={(e) => setExtinguisherLocation(e.target.value)} placeholder={t('permits.hotWork.extinguisherLocationPlaceholder', undefined, 'Nearest station / bay')} className={inputCls} />
          </div>
          <div>
            <label htmlFor="hw-extinguisher-type" className={labelCls}>{t('permits.hotWork.extinguisherTypeLabel', undefined, 'Extinguisher type')}</label>
            <input id="hw-extinguisher-type" type="text" maxLength={100} value={extinguisherType} onChange={(e) => setExtinguisherType(e.target.value)} placeholder={t('permits.hotWork.extinguisherTypePlaceholder', undefined, 'ABC / CO₂')} className={inputCls} />
          </div>
        </div>
        <div>
          <label htmlFor="hw-sprinkler" className={labelCls}>{t('permits.hotWork.sprinklerStatusLabel', undefined, 'Sprinkler status')}</label>
          <input id="hw-sprinkler" type="text" maxLength={100} value={sprinklerStatus} onChange={(e) => setSprinklerStatus(e.target.value)} placeholder={t('permits.hotWork.sprinklerStatusPlaceholder', undefined, 'In service / impaired / N/A')} className={inputCls} />
        </div>
        <label className="flex items-center gap-2 text-sm text-fg-2">
          <input type="checkbox" checked={gasTestRequired} onChange={() => setGasTestRequired((v) => !v)} className="accent-mytra-purple w-5 h-5" />
          {t('permits.hotWork.gasTestRequired', undefined, 'Atmosphere / gas test required')}
        </label>
        {gasTestRequired && (
          <div>
            <label htmlFor="hw-gas-notes" className={`${labelCls} sr-only`}>{t('permits.hotWork.gasTestNotesLabel', undefined, 'Gas test notes')}</label>
            <input id="hw-gas-notes" type="text" maxLength={500} value={gasTestNotes} onChange={(e) => setGasTestNotes(e.target.value)} placeholder={t('permits.hotWork.gasTestNotesPlaceholder', undefined, 'LEL reading / notes')} className={inputCls} />
          </div>
        )}
      </div>

      <section id="checklist-section" data-step="checklist" className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">{t('permits.hotWork.checklistHeading', undefined, 'Pre-issue checklist')}</h4>
          {critLeft > 0 && <span className="text-xs text-warn">{t('permits.hotWork.requiredLeft', { critLeft }, '{critLeft} required left')}</span>}
        </div>
        <PermitChecklist items={checklist} onChange={setChecklist} />
      </section>

      <div data-step="validity" className="bg-mytra-card border border-mytra-border rounded-card p-4 space-y-3 shadow-card">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">{t('permits.hotWork.validityHeading', undefined, 'Validity window')}</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="hw-valid-from" className={labelCls}>{t('permits.hotWork.validFromLabel', undefined, 'Valid from')}</label>
            <input id="hw-valid-from" type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="hw-valid-until" className={labelCls}>{t('permits.hotWork.validUntilLabel', undefined, 'Valid until')}</label>
            <input
              id="hw-valid-until"
              type="datetime-local"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className={`${inputCls} ${!validWindowOk ? 'border-danger/60' : ''}`}
            />
          </div>
        </div>
      </div>

      <section id="signatures-section" data-step="signatures" className="bg-mytra-card border border-mytra-border rounded-card p-4 shadow-card">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold mb-1">{t('permits.hotWork.signaturesHeading', undefined, 'Crew sign-on')}</h4>
        <p className="text-xs text-fg-2 mb-3">{t('permits.hotWork.signaturesHint', undefined, 'Each worker confirms understanding. Designate the issuer.')}</p>
        <CrewSignatureBlock
          value={sigData}
          onChange={setSigData}
          supervisorId={issuerId}
          onSupervisorChange={setIssuerId}
          supervisorLabel={t('permits.hotWork.issuerLabel', undefined, 'Issuer')}
        />
      </section>

      {saveError && (
        <div className="flex items-start gap-2 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 text-xs text-danger">
          <span className="font-semibold shrink-0">{t('common.saveFailed', undefined, 'Save failed:')}</span>
          <span>{saveError}</span>
        </div>
      )}
      <div className="sticky bottom-0 pb-4 pt-2 bg-gradient-to-t from-mytra-bg via-mytra-bg to-transparent space-y-3">
        <ValidationSummary errors={validationErrors} show={showValidation} onDismiss={() => setShowValidation(false)} />
        <button
          type="button"
          onClick={() => { if (canSubmit) { setShowValidation(false); setConfirmOpen(true) } else { setShowValidation(true) } }}
          disabled={!canSubmit}
          className={`${btnPrimaryCls} w-full py-3 text-sm font-semibold`}
        >
          {!workDescription.trim() || !location.trim()
            ? t('permits.hotWork.ctaDescribe', undefined, 'Describe the work and location')
            : hotWorkTypes.length === 0
              ? t('permits.hotWork.ctaSelectType', undefined, 'Select hot work type')
              : critLeft > 0
                ? t('permits.hotWork.ctaCompleteItems', { count: critLeft, critLeft })
                : !fireWatchOk
                  ? t('permits.hotWork.ctaAssignFireWatch', undefined, 'Assign a fire watch')
                  : sigData.signatures.length === 0
                    ? t('permits.hotWork.ctaWorkersSign', undefined, 'Workers must sign on')
                    : issuerId === null
                      ? t('permits.hotWork.ctaDesignateIssuer', undefined, 'Designate the issuer')
                      : !validWindowOk
                        ? t('permits.hotWork.ctaFixValidity', undefined, 'Fix validity window')
                        : t('permits.hotWork.issuePermit', undefined, 'Issue Permit')}
        </button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title={t('permits.hotWork.confirmTitle', undefined, 'Issue hot work permit?')}
        message={t('permits.hotWork.confirmMessage', { location: location || t('permits.hotWork.confirmLocationFallback', undefined, 'this location') })}
        confirmLabel={t('permits.hotWork.issuePermit', undefined, 'Issue Permit')}
        onConfirm={() => { setConfirmOpen(false); submit() }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
