'use client'

import { useState } from 'react'
import { PackageOpen } from 'lucide-react'
import { createConfinedSpacePermit, saveSignatures } from '@/lib/safety-records'
import { trySyncRecord } from '@/lib/safety-sync'
import { buildPermitItems, getPermitChecklistDef, CONFINED_SPACE_HAZARDS } from '@/data/safety-checklists'
import type { PermitCheckItem } from '@/lib/safety-types'
import { defaultValidityWindow, toIso, toLocalInput } from '@/lib/datetime'
import PermitChecklist, { criticalRemaining } from './PermitChecklist'
import ChipMultiSelect from './ChipMultiSelect'
import CrewSignatureBlock, { type SignatureData } from './CrewSignatureBlock'
import FormSuccess from './FormSuccess'

const labelCls = 'block text-xs text-gray-400 mb-1'
const inputCls =
  'w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-mytra-purple focus:border-transparent'

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
    setSubmittedId(record.id)
  }

  function reset() {
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
      <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <PackageOpen className="w-5 h-5 text-mytra-purple" />
          <h3 className="text-sm font-semibold text-white">Confined Space Entry Permit</h3>
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
          <label className={labelCls}>Space description</label>
          <textarea rows={2} value={spaceDescription} onChange={(e) => setSpaceDescription(e.target.value)} placeholder="Tank / vessel / vault…" className={`${inputCls} resize-none`} />
        </div>
      </div>

      <section className="space-y-2">
        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold px-1">Hazards present</h4>
        <ChipMultiSelect options={CONFINED_SPACE_HAZARDS} selected={hazards} onChange={setHazards} />
      </section>

      <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-3">
        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
          Atmospheric test <span className="text-gray-600 normal-case">· test O₂ → flammable → toxic</span>
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {atmoFields.map((f) => {
            const bad = outOfRange(f.value, f.range)
            return (
              <div key={f.label}>
                <label className={labelCls}>
                  {f.label} <span className="text-gray-600">({f.hint})</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  className={`${inputCls} ${bad ? 'border-red-500 ring-2 ring-red-500/40' : ''}`}
                />
                {bad && <p className="text-[10px] text-red-400 mt-0.5">Out of acceptable range</p>}
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
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={continuousMonitoring} onChange={() => setContinuousMonitoring((v) => !v)} className="accent-mytra-purple w-4 h-4" />
            Continuous monitoring
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={ventilationInUse} onChange={() => setVentilationInUse((v) => !v)} className="accent-mytra-purple w-4 h-4" />
            Ventilation in use
          </label>
        </div>
      </div>

      <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-3">
        <div>
          <label className={labelCls}>Attendant (stationed outside)</label>
          <input
            type="text"
            value={attendantName}
            onChange={(e) => setAttendantName(e.target.value)}
            placeholder="Name"
            className={`${inputCls} ${!attendantName.trim() ? 'border-amber-500/60' : ''}`}
          />
        </div>
        <div>
          <label className={labelCls}>Rescue plan</label>
          <textarea rows={2} value={rescuePlan} onChange={(e) => setRescuePlan(e.target.value)} placeholder="Non-entry retrieval / emergency services" className={`${inputCls} resize-none`} />
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Pre-entry checklist</h4>
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
        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Entrant sign-on</h4>
        <p className="text-xs text-gray-400 mb-3">Each entrant signs. Mark the entry supervisor.</p>
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
