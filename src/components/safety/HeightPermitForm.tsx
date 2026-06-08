'use client'

import { useState, useCallback } from 'react'
import { ArrowUpFromLine, RotateCcw } from 'lucide-react'
import { createHeightPermit, saveSignatures, markSubmittedForReview, getSafetyRecordById } from '@/lib/safety-records'
import { trySyncRecord } from '@/lib/safety-sync'
import { useFormDraft } from '@/lib/use-draft'
import { getLastContext, saveLastContext } from '@/lib/use-last-context'
import LastUsedChip from './LastUsedChip'
import { getCurrentIdentity } from '@/lib/identity'
import {
  buildPermitItems,
  getPermitChecklistDef,
  HEIGHT_ACCESS_METHODS,
  HEIGHT_FALL_PROTECTION,
} from '@/data/safety-checklists'
import type { PermitCheckItem } from '@/lib/safety-types'
import { defaultValidityWindow, toIso } from '@/lib/datetime'
import PermitChecklist, { criticalRemaining } from './PermitChecklist'
import ChipMultiSelect from './ChipMultiSelect'
import CrewSignatureBlock, { type SignatureData } from './CrewSignatureBlock'
import FormSuccess from './FormSuccess'

const labelCls = 'block text-xs text-fg-2 mb-1'
const inputCls =
  'w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple'

const PFAS = 'PFAS (harness + lanyard/SRL)'

export default function HeightPermitForm() {
  const win = defaultValidityWindow(8)
  const [projectName, setProjectName] = useState('')
  const [location, setLocation] = useState('')
  const [workDescription, setWorkDescription] = useState('')
  const [workingHeight, setWorkingHeight] = useState('')
  const [accessMethod, setAccessMethod] = useState<string[]>([])
  const [fallProtection, setFallProtection] = useState<string[]>([])
  const [anchorPoints, setAnchorPoints] = useState('')
  const [rescuePlan, setRescuePlan] = useState('')
  const [checklist, setChecklist] = useState<PermitCheckItem[]>(() => buildPermitItems('height'))
  const [validFrom, setValidFrom] = useState(win.from)
  const [validUntil, setValidUntil] = useState(win.until)
  const [sigData, setSigData] = useState<SignatureData>({ signatures: [], blobs: {} })
  const [issuerId, setIssuerId] = useState<string | null>(null)
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [wasOffline, setWasOffline] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastCtx] = useState(getLastContext)

  const restore = useCallback((d: Record<string, unknown>) => {
    if (typeof d.projectName === 'string') setProjectName(d.projectName)
    if (typeof d.location === 'string') setLocation(d.location)
    if (typeof d.workDescription === 'string') setWorkDescription(d.workDescription)
    if (typeof d.workingHeight === 'string') setWorkingHeight(d.workingHeight)
    if (Array.isArray(d.accessMethod)) setAccessMethod(d.accessMethod)
    if (Array.isArray(d.fallProtection)) setFallProtection(d.fallProtection)
    if (typeof d.anchorPoints === 'string') setAnchorPoints(d.anchorPoints)
    if (typeof d.rescuePlan === 'string') setRescuePlan(d.rescuePlan)
  }, [])

  const { hasDraft, clearDraft, dismissDraft } = useFormDraft(
    'height-permit',
    () => ({ projectName, location, workDescription, workingHeight, accessMethod, fallProtection, anchorPoints, rescuePlan }),
    restore
  )

  const pfasSelected = fallProtection.includes(PFAS)
  const critLeft = criticalRemaining(checklist)
  const validWindowOk = new Date(validUntil).getTime() > new Date(validFrom).getTime()
  const canSubmit =
    workDescription.trim().length > 0 &&
    location.trim().length > 0 &&
    critLeft === 0 &&
    sigData.signatures.length >= 1 &&
    issuerId !== null &&
    validWindowOk &&
    (!pfasSelected || rescuePlan.trim().length > 0)

  function submit() {
    if (!canSubmit) return
    setSaveError(null)
    let record: ReturnType<typeof createHeightPermit>
    try {
      record = createHeightPermit({
        projectName,
        location,
        workDescription,
        workingHeight,
        accessMethod,
        fallProtection,
        anchorPoints,
        rescuePlan,
        checklist,
        validFrom: toIso(validFrom),
        validUntil: toIso(validUntil),
        workers: sigData.signatures,
        issuerSignatureId: issuerId,
      })
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save record — device storage may be full.')
      return
    }
    const blobs = Object.entries(sigData.blobs).map(([id, dataUrl]) => ({ id, dataUrl }))
    saveSignatures(record.id, blobs).catch((e) => console.error('signature save failed', e))
    void trySyncRecord(record.id)
    saveLastContext({ projectName, location })
    clearDraft()
    setWasOffline(!navigator.onLine)
    setSubmittedId(record.id)
  }

  function reset() {
    clearDraft()
    setWasOffline(false)
    const w = defaultValidityWindow(8)
    setWorkDescription('')
    setWorkingHeight('')
    setAccessMethod([])
    setFallProtection([])
    setAnchorPoints('')
    setRescuePlan('')
    setChecklist(buildPermitItems('height'))
    setValidFrom(w.from)
    setValidUntil(w.until)
    setSigData({ signatures: [], blobs: {} })
    setIssuerId(null)
    setSubmittedId(null)
  }

  if (submittedId) {
    return (
      <FormSuccess
        id={submittedId}
        title="Permit Issued"
        message="Work-at-Height permit is active, logged as"
        onNew={reset}
        newLabel="New permit"
        offline={wasOffline}
        onSubmitForReview={process.env.NEXT_PUBLIC_EHS_REVIEW === '1' ? async () => {
          const identity = getCurrentIdentity()
          markSubmittedForReview(submittedId, { name: identity?.name ?? 'Unknown', email: identity?.email ?? null })
          const rec = getSafetyRecordById(submittedId)
          if (rec) fetch('/api/safety/review/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ record: rec, notionPageId: rec.notionPageId }) }).catch(() => {})
        } : undefined}
      />
    )
  }

  const regRef = getPermitChecklistDef('height').regRef

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
          <ArrowUpFromLine className="w-5 h-5 text-mytra-purple" />
          <h3 className="text-sm font-semibold text-fg">Work-at-Height Permit</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Project / Structure</label>
            <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Tower B steel erection" className={inputCls} />
            {lastCtx.projectName && <LastUsedChip label="Last" value={lastCtx.projectName} currentValue={projectName} onApply={setProjectName} />}
          </div>
          <div>
            <label className={labelCls}>Location / Area</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Level / grid" className={inputCls} />
            {lastCtx.location && <LastUsedChip label="Last" value={lastCtx.location} currentValue={location} onApply={setLocation} />}
          </div>
        </div>
        <div>
          <label className={labelCls}>Work description</label>
          <textarea rows={2} value={workDescription} onChange={(e) => setWorkDescription(e.target.value)} placeholder="Describe the work to be done at height" className={`${inputCls} resize-none`} />
        </div>
        <div>
          <label className={labelCls}>Working height</label>
          <input type="text" inputMode="decimal" value={workingHeight} onChange={(e) => setWorkingHeight(e.target.value)} placeholder="e.g. 8 m / 26 ft" className={inputCls} />
        </div>
      </div>

      <section className="space-y-2">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold px-1">Access method</h4>
        <ChipMultiSelect options={HEIGHT_ACCESS_METHODS} selected={accessMethod} onChange={setAccessMethod} />
      </section>

      <section className="space-y-2">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold px-1">Fall protection</h4>
        <ChipMultiSelect options={HEIGHT_FALL_PROTECTION} selected={fallProtection} onChange={setFallProtection} />
      </section>

      <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-3 shadow-card">
        <div>
          <label className={labelCls}>Anchor points (location + rating)</label>
          <input type="text" value={anchorPoints} onChange={(e) => setAnchorPoints(e.target.value)} placeholder="≥5,000 lb / engineered" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>
            Rescue plan {pfasSelected && <span className="text-warn">— required for PFAS</span>}
          </label>
          <textarea
            rows={2}
            value={rescuePlan}
            onChange={(e) => setRescuePlan(e.target.value)}
            placeholder="Suspension-trauma rescue / prompt rescue means"
            className={`${inputCls} resize-none ${pfasSelected && !rescuePlan.trim() ? 'border-warn/60' : ''}`}
          />
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">Pre-issue checklist</h4>
          {critLeft > 0 && <span className="text-xs text-warn">{critLeft} required left</span>}
        </div>
        <PermitChecklist items={checklist} onChange={setChecklist} />
        <p className="text-xs text-fg-4 px-1">{regRef}</p>
      </section>

      <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-3 shadow-card">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">Validity window</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Valid from</label>
            <input type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Valid until</label>
            <input
              type="datetime-local"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className={`${inputCls} ${!validWindowOk ? 'border-danger/60' : ''}`}
            />
          </div>
        </div>
      </div>

      <section className="bg-mytra-card border border-mytra-border rounded-lg p-4 shadow-card">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold mb-1">Sign-on</h4>
        <p className="text-xs text-fg-2 mb-3">Each worker acknowledges. Mark the competent person / issuer.</p>
        <CrewSignatureBlock
          value={sigData}
          onChange={setSigData}
          supervisorId={issuerId}
          onSupervisorChange={setIssuerId}
          supervisorLabel="Issuer"
        />
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
          {critLeft > 0
            ? `Check ${critLeft} required item${critLeft === 1 ? '' : 's'}`
            : pfasSelected && !rescuePlan.trim()
              ? 'Add rescue plan'
              : sigData.signatures.length === 0
                ? 'Add worker sign-on'
                : issuerId === null
                  ? 'Mark the issuer'
                  : !validWindowOk
                    ? 'Fix validity window'
                    : 'Issue Permit'}
        </button>
      </div>
    </div>
  )
}
