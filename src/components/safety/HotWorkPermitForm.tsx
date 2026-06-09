'use client'

import { useState, useCallback } from 'react'
import { Flame, RotateCcw } from 'lucide-react'
import { createHotWorkPermit, saveSignatures, markSubmittedForReview } from '@/lib/safety-records'
import { trySyncRecord } from '@/lib/safety-sync'
import { useFormDraft } from '@/lib/use-draft'
import { getLastContext, saveLastContext } from '@/lib/use-last-context'
import LastUsedChip from './LastUsedChip'
import { getCurrentIdentity } from '@/lib/identity'
import { buildPermitItems, HOT_WORK_TYPES } from '@/data/safety-checklists'
import type { PermitCheckItem } from '@/lib/safety-types'
import { defaultValidityWindow, toIso } from '@/lib/datetime'
import PermitChecklist, { criticalRemaining } from './PermitChecklist'
import ChipMultiSelect from './ChipMultiSelect'
import CrewSignatureBlock, { type SignatureData } from './CrewSignatureBlock'
import FormSuccess from './FormSuccess'

const labelCls = 'block text-xs text-fg-2 mb-1'
const inputCls =
  'w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple'

export default function HotWorkPermitForm() {
  const win = defaultValidityWindow(8)
  const [projectName, setProjectName] = useState('')
  const [location, setLocation] = useState('')
  const [workDescription, setWorkDescription] = useState('')
  const [hotWorkTypes, setHotWorkTypes] = useState<string[]>([])
  const [checklist, setChecklist] = useState<PermitCheckItem[]>(() => buildPermitItems('hot-work'))
  const [fireWatchRequired, setFireWatchRequired] = useState(true)
  const [fireWatchName, setFireWatchName] = useState('')
  const [postDuration, setPostDuration] = useState(30)
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
  const [wasOffline, setWasOffline] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
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
    restore
  )

  const critLeft = criticalRemaining(checklist)
  const validWindowOk = new Date(validUntil).getTime() > new Date(validFrom).getTime()
  const fireWatchOk = !fireWatchRequired || fireWatchName.trim().length > 0
  const canSubmit =
    workDescription.trim().length > 0 &&
    location.trim().length > 0 &&
    critLeft === 0 &&
    fireWatchOk &&
    sigData.signatures.length >= 1 &&
    issuerId !== null &&
    validWindowOk

  function submit() {
    if (!canSubmit) return
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
      setSaveError(e instanceof Error ? e.message : 'Failed to save record — device storage may be full.')
      return
    }
    const blobs = Object.entries(sigData.blobs).map(([id, dataUrl]) => ({ id, dataUrl }))
    saveSignatures(record.id, blobs).catch((e) => console.error('signature save failed', e))
    void trySyncRecord(record.id)
    if (process.env.NEXT_PUBLIC_EHS_REVIEW === '1') {
      const identity = getCurrentIdentity()
      markSubmittedForReview(record.id, { name: identity?.name ?? 'Unknown', email: identity?.email ?? null })
      fetch('/api/safety/review/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ record, notionPageId: record.notionPageId }) }).catch(() => {})
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
    setWorkDescription('')
    setHotWorkTypes([])
    setChecklist(buildPermitItems('hot-work'))
    setFireWatchRequired(true)
    setFireWatchName('')
    setPostDuration(30)
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
  }

  if (submittedId) {
    return (
      <FormSuccess
        id={submittedId}
        title="Permit Issued"
        message="Hot Work permit is active, logged as"
        onNew={reset}
        newLabel="New permit"
        offline={wasOffline}
        reviewAutoSubmitted={process.env.NEXT_PUBLIC_EHS_REVIEW === '1'}
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
      <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-4 shadow-card">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-mytra-purple" />
          <h3 className="text-sm font-semibold text-fg">Hot Work Permit</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Project / Structure</label>
            <input type="text" maxLength={200} value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Tower B steel erection" className={inputCls} />
            {lastCtx.projectName && <LastUsedChip label="Last" value={lastCtx.projectName} currentValue={projectName} onApply={setProjectName} />}
          </div>
          <div>
            <label className={labelCls}>Location / Area</label>
            <input type="text" maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Level / grid" className={inputCls} />
            {lastCtx.location && <LastUsedChip label="Last" value={lastCtx.location} currentValue={location} onApply={setLocation} />}
          </div>
        </div>
        <div>
          <label className={labelCls}>Work description</label>
          <textarea rows={2} maxLength={2000} value={workDescription} onChange={(e) => setWorkDescription(e.target.value)} placeholder="Describe the hot work to be performed" className={`${inputCls} resize-none`} />
        </div>
      </div>

      <section className="space-y-2">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold px-1">Type of hot work</h4>
        <ChipMultiSelect options={HOT_WORK_TYPES} selected={hotWorkTypes} onChange={setHotWorkTypes} />
      </section>

      <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-3 shadow-card">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">Fire watch & suppression</h4>
        <label className="flex items-center gap-2 text-sm text-fg-2">
          <input type="checkbox" checked={fireWatchRequired} onChange={() => setFireWatchRequired((v) => !v)} className="accent-mytra-purple w-5 h-5" />
          Fire watch required
        </label>
        {fireWatchRequired && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fire watch assigned</label>
              <input
                type="text"
                value={fireWatchName}
                maxLength={100}
                onChange={(e) => setFireWatchName(e.target.value)}
                placeholder="Name"
                className={`${inputCls} ${!fireWatchName.trim() ? 'border-warn/60' : ''}`}
              />
            </div>
            <div>
              <label className={labelCls}>Post-work monitoring (min)</label>
              <input type="number" inputMode="decimal" value={postDuration} onChange={(e) => setPostDuration(parseInt(e.target.value) || 0)} className={inputCls} />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Extinguisher location</label>
            <input type="text" maxLength={200} value={extinguisherLocation} onChange={(e) => setExtinguisherLocation(e.target.value)} placeholder="Nearest station / bay" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Extinguisher type</label>
            <input type="text" maxLength={100} value={extinguisherType} onChange={(e) => setExtinguisherType(e.target.value)} placeholder="ABC / CO₂" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Sprinkler status</label>
          <input type="text" maxLength={100} value={sprinklerStatus} onChange={(e) => setSprinklerStatus(e.target.value)} placeholder="In service / impaired / N/A" className={inputCls} />
        </div>
        <label className="flex items-center gap-2 text-sm text-fg-2">
          <input type="checkbox" checked={gasTestRequired} onChange={() => setGasTestRequired((v) => !v)} className="accent-mytra-purple w-5 h-5" />
          Atmosphere / gas test required
        </label>
        {gasTestRequired && (
          <input type="text" maxLength={500} value={gasTestNotes} onChange={(e) => setGasTestNotes(e.target.value)} placeholder="LEL reading / notes" className={inputCls} />
        )}
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">Pre-issue checklist</h4>
          {critLeft > 0 && <span className="text-xs text-warn">{critLeft} required left</span>}
        </div>
        <PermitChecklist items={checklist} onChange={setChecklist} />
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
        <p className="text-xs text-fg-2 mb-3">Each worker acknowledges. Mark the issuer.</p>
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
            : !fireWatchOk
              ? 'Assign a fire watch'
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
