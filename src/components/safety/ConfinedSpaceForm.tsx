'use client'

import { useState, useCallback } from 'react'
import { PackageOpen, RotateCcw } from 'lucide-react'
import { createConfinedSpacePermit, saveSignatures } from '@/lib/safety-records'
import { trySyncRecord } from '@/lib/safety-sync'
import { useFormDraft } from '@/lib/use-draft'
import { buildPermitItems, getPermitChecklistDef, CONFINED_SPACE_HAZARDS } from '@/data/safety-checklists'
import type { PermitCheckItem } from '@/lib/safety-types'
import { defaultValidityWindow, toIso, toLocalInput } from '@/lib/datetime'
import PermitChecklist, { criticalRemaining } from './PermitChecklist'
import ChipMultiSelect from './ChipMultiSelect'
import CrewSignatureBlock, { type SignatureData } from './CrewSignatureBlock'
import FormSuccess from './FormSuccess'

const labelCls = 'block text-xs text-fg-2 mb-1'
const inputCls =
  'w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple'

function outOfRange(value: string, range: { min?: number; max?: number }): boolean {
  if (value.trim() === '') return false
  const n = parseFloat(value)
  if (Number.isNaN(n)) return false
  if (range.min !== undefined && n < range.min) return true
  if (range.max !== undefined && n > range.max) return true
  return false
}

export default function ConfinedSpaceForm() {
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
    restore
  )

  const critLeft = criticalRemaining(checklist)
  const validWindowOk = new Date(validUntil).getTime() > new Date(validFrom).getTime()
  const canSubmit =
    spaceDescription.trim().length > 0 &&
    location.trim().length > 0 &&
    attendantName.trim().length > 0 &&
    critLeft === 0 &&
    sigData.signatures.length >= 1 &&
    supervisorId !== null &&
    validWindowOk

  function submit() {
    if (!canSubmit) return
    const record = createConfinedSpacePermit({
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
    const blobs = Object.entries(sigData.blobs).map(([id, dataUrl]) => ({ id, dataUrl }))
    saveSignatures(record.id, blobs).catch((e) => console.error('signature save failed', e))
    void trySyncRecord(record.id)
    clearDraft()
    setSubmittedId(record.id)
  }

  function reset() {
    clearDraft()
    const w = defaultValidityWindow(4)
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
  }

  if (submittedId) {
    return (
      <FormSuccess
        id={submittedId}
        title="Permit Issued"
        message="Confined Space Entry permit is active, logged as"
        onNew={reset}
        newLabel="New permit"
      />
    )
  }

  const regRef = getPermitChecklistDef('confined-space').regRef

  const atmoFields: { label: string; value: string; set: (v: string) => void; hint: string; range: { min?: number; max?: number } }[] = [
    { label: 'O₂ %', value: oxygen, set: setOxygen, hint: '19.5–23.5%', range: { min: 19.5, max: 23.5 } },
    { label: 'LEL %', value: lel, set: setLel, hint: '< 10%', range: { max: 10 } },
    { label: 'CO ppm', value: co, set: setCo, hint: '< 35 ppm', range: { max: 35 } },
    { label: 'H₂S ppm', value: h2s, set: setH2s, hint: '< 10 ppm', range: { max: 10 } },
  ]

  return (
    <div className="animate-fadeIn space-y-4">
      {hasDraft && (
        <div className="flex items-center justify-between gap-2 bg-mytra-purple/10 border border-mytra-purple/20 rounded-lg px-4 py-2.5 animate-fadeIn">
          <div className="flex items-center gap-2 text-sm text-mytra-purple">
            <RotateCcw className="w-4 h-4" />
            <span>Draft restored</span>
          </div>
          <button type="button" onClick={dismissDraft} className="text-xs text-fg-3 hover:text-fg-2">
            Dismiss
          </button>
        </div>
      )}
      <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-4 shadow-card">
        <div className="flex items-center gap-2">
          <PackageOpen className="w-5 h-5 text-mytra-purple" />
          <h3 className="text-sm font-semibold text-fg">Confined Space Entry Permit</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Project / Structure</label>
            <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Tower B steel erection" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Location / Area</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Level / grid" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Space description</label>
          <textarea rows={2} value={spaceDescription} onChange={(e) => setSpaceDescription(e.target.value)} placeholder="Tank / vessel / vault…" className={`${inputCls} resize-none`} />
        </div>
      </div>

      <section className="space-y-2">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold px-1">Hazards present</h4>
        <ChipMultiSelect options={CONFINED_SPACE_HAZARDS} selected={hazards} onChange={setHazards} />
      </section>

      <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-3 shadow-card">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">
          Atmospheric test <span className="text-fg-4 normal-case">· test O₂ → flammable → toxic</span>
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {atmoFields.map((f) => {
            const bad = outOfRange(f.value, f.range)
            return (
              <div key={f.label}>
                <label className={labelCls}>
                  {f.label} <span className="text-fg-4">({f.hint})</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  className={`${inputCls} ${bad ? 'border-danger ring-2 ring-danger/30' : ''}`}
                />
                {bad && <p className="text-xs text-danger mt-0.5">Out of acceptable range</p>}
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Tested by</label>
            <input type="text" value={testedBy} onChange={(e) => setTestedBy(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Tested at</label>
            <input type="datetime-local" value={testedAt} onChange={(e) => setTestedAt(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-fg-2">
            <input type="checkbox" checked={continuousMonitoring} onChange={() => setContinuousMonitoring((v) => !v)} className="accent-mytra-purple w-5 h-5" />
            Continuous monitoring
          </label>
          <label className="flex items-center gap-2 text-sm text-fg-2">
            <input type="checkbox" checked={ventilationInUse} onChange={() => setVentilationInUse((v) => !v)} className="accent-mytra-purple w-5 h-5" />
            Ventilation in use
          </label>
        </div>
      </div>

      <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-3 shadow-card">
        <div>
          <label className={labelCls}>Attendant (stationed outside)</label>
          <input
            type="text"
            value={attendantName}
            onChange={(e) => setAttendantName(e.target.value)}
            placeholder="Name"
            className={`${inputCls} ${!attendantName.trim() ? 'border-warn/60' : ''}`}
          />
        </div>
        <div>
          <label className={labelCls}>Rescue plan</label>
          <textarea rows={2} value={rescuePlan} onChange={(e) => setRescuePlan(e.target.value)} placeholder="Non-entry retrieval / emergency services" className={`${inputCls} resize-none`} />
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">Pre-entry checklist</h4>
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
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold mb-1">Entrant sign-on</h4>
        <p className="text-xs text-fg-2 mb-3">Each entrant signs. Mark the entry supervisor.</p>
        <CrewSignatureBlock
          value={sigData}
          onChange={setSigData}
          supervisorId={supervisorId}
          onSupervisorChange={setSupervisorId}
          supervisorLabel="Entry Sup."
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
            : !attendantName.trim()
              ? 'Assign an attendant'
              : sigData.signatures.length === 0
                ? 'Add entrant sign-on'
                : supervisorId === null
                  ? 'Mark the entry supervisor'
                  : !validWindowOk
                    ? 'Fix validity window'
                    : 'Issue Permit'}
        </button>
      </div>
    </div>
  )
}
