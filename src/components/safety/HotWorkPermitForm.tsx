'use client'

import { useState } from 'react'
import { Flame } from 'lucide-react'
import { createHotWorkPermit, saveSignatures } from '@/lib/safety-records'
import { trySyncRecord } from '@/lib/safety-sync'
import { buildPermitItems, getPermitChecklistDef, HOT_WORK_TYPES } from '@/data/safety-checklists'
import type { PermitCheckItem } from '@/lib/safety-types'
import { defaultValidityWindow, toIso } from '@/lib/datetime'
import PermitChecklist, { criticalRemaining } from './PermitChecklist'
import ChipMultiSelect from './ChipMultiSelect'
import CrewSignatureBlock, { type SignatureData } from './CrewSignatureBlock'
import FormSuccess from './FormSuccess'

const labelCls = 'block text-xs text-gray-400 mb-1'
const inputCls =
  'w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-mytra-purple focus:border-transparent'

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
    const record = createHotWorkPermit({
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
    const blobs = Object.entries(sigData.blobs).map(([id, dataUrl]) => ({ id, dataUrl }))
    saveSignatures(record.id, blobs).catch((e) => console.error('signature save failed', e))
    void trySyncRecord(record.id)
    setSubmittedId(record.id)
  }

  function reset() {
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
      />
    )
  }

  const regRef = getPermitChecklistDef('hot-work').regRef

  return (
    <div className="animate-fadeIn space-y-4">
      <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-mytra-purple" />
          <h3 className="text-sm font-semibold text-white">Hot Work Permit</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Project / Structure</label>
            <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Location / Area</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Work description</label>
          <textarea rows={2} value={workDescription} onChange={(e) => setWorkDescription(e.target.value)} className={`${inputCls} resize-none`} />
        </div>
      </div>

      <section className="space-y-2">
        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold px-1">Type of hot work</h4>
        <ChipMultiSelect options={HOT_WORK_TYPES} selected={hotWorkTypes} onChange={setHotWorkTypes} />
      </section>

      <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-3">
        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Fire watch & suppression</h4>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={fireWatchRequired} onChange={() => setFireWatchRequired((v) => !v)} className="accent-mytra-purple w-4 h-4" />
          Fire watch required
        </label>
        {fireWatchRequired && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fire watch assigned</label>
              <input
                type="text"
                value={fireWatchName}
                onChange={(e) => setFireWatchName(e.target.value)}
                placeholder="Name"
                className={`${inputCls} ${!fireWatchName.trim() ? 'border-amber-500/60' : ''}`}
              />
            </div>
            <div>
              <label className={labelCls}>Post-work monitoring (min)</label>
              <input type="number" inputMode="numeric" value={postDuration} onChange={(e) => setPostDuration(parseInt(e.target.value) || 0)} className={inputCls} />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Extinguisher location</label>
            <input type="text" value={extinguisherLocation} onChange={(e) => setExtinguisherLocation(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Extinguisher type</label>
            <input type="text" value={extinguisherType} onChange={(e) => setExtinguisherType(e.target.value)} placeholder="ABC / CO₂" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Sprinkler status</label>
          <input type="text" value={sprinklerStatus} onChange={(e) => setSprinklerStatus(e.target.value)} placeholder="In service / impaired / N/A" className={inputCls} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={gasTestRequired} onChange={() => setGasTestRequired((v) => !v)} className="accent-mytra-purple w-4 h-4" />
          Atmosphere / gas test required
        </label>
        {gasTestRequired && (
          <input type="text" value={gasTestNotes} onChange={(e) => setGasTestNotes(e.target.value)} placeholder="LEL reading / notes" className={inputCls} />
        )}
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Pre-issue checklist</h4>
          {critLeft > 0 && <span className="text-[10px] text-amber-400">{critLeft} required left</span>}
        </div>
        <PermitChecklist items={checklist} onChange={setChecklist} />
        <p className="text-[10px] text-gray-600 px-1">{regRef}</p>
      </section>

      <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-3">
        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Validity window</h4>
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
              className={`${inputCls} ${!validWindowOk ? 'border-red-500/60' : ''}`}
            />
          </div>
        </div>
      </div>

      <section className="bg-mytra-card border border-mytra-border rounded-lg p-4">
        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Sign-on</h4>
        <p className="text-xs text-gray-400 mb-3">Each worker acknowledges. Mark the issuer.</p>
        <CrewSignatureBlock
          value={sigData}
          onChange={setSigData}
          supervisorId={issuerId}
          onSupervisorChange={setIssuerId}
          supervisorLabel="Issuer"
        />
      </section>

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
