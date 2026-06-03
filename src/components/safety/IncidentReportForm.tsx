'use client'

import { useState, useRef, useEffect } from 'react'
import { AlertTriangle, Camera, X, Plus } from 'lucide-react'
import type { IncidentType, IncidentSeverity } from '@/lib/safety-types'
import { INCIDENT_SEVERITY_COLORS } from '@/lib/safety-types'
import { createIncidentReport, saveSignatures, savePhotosForRecord, cryptoRandomId } from '@/lib/safety-records'
import { trySyncRecord } from '@/lib/safety-sync'
import { compressPhoto } from '@/lib/media'
import { getCurrentIdentity } from '@/lib/identity'
import { toLocalInput, toIso } from '@/lib/datetime'
import SignaturePad from '@/components/SignaturePad'
import FormSuccess from './FormSuccess'

const labelCls = 'block text-xs text-gray-400 mb-1'
const inputCls =
  'w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-mytra-purple focus:border-transparent'

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
  const [photos, setPhotos] = useState<{ id: string; dataUrl: string }[]>([])
  const [reporterName, setReporterName] = useState('')
  const [reporterSig, setReporterSig] = useState<string | null>(null)
  const [submittedId, setSubmittedId] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

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

  function submit() {
    if (!canSubmit) return
    const reporterSignatureId = reporterSig ? cryptoRandomId() : null
    const record = createIncidentReport({
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
      photoSlots: photos.map((p) => p.id),
      reporterSignatureId,
    })
    if (photos.length > 0) savePhotosForRecord(record.id, photos).catch((e) => console.error('photo save failed', e))
    if (reporterSignatureId && reporterSig) {
      saveSignatures(record.id, [{ id: reporterSignatureId, dataUrl: reporterSig }]).catch((e) =>
        console.error('signature save failed', e)
      )
    }
    void trySyncRecord(record.id)
    setSubmittedId(record.id)
  }

  function reset() {
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
  }

  if (submittedId) {
    return (
      <FormSuccess
        id={submittedId}
        title="Report Filed"
        message="Incident report recorded as"
        onNew={reset}
        newLabel="New report"
      />
    )
  }

  return (
    <div className="animate-fadeIn space-y-4">
      <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-mytra-purple" />
          <h3 className="text-sm font-semibold text-white">Incident / Near-Miss Report</h3>
        </div>

        <div>
          <label className={labelCls}>Type</label>
          <div className="grid grid-cols-4 gap-1.5">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setIncidentType(t.value)}
                className={`text-xs font-medium py-2 rounded-lg transition-colors ${
                  incidentType === t.value
                    ? 'bg-mytra-purple text-white'
                    : 'bg-mytra-bg border border-mytra-border text-gray-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Severity</label>
          <div className="grid grid-cols-4 gap-1.5">
            {SEVERITIES.map((s) => {
              const on = severity === s
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  className="text-xs font-medium py-2 rounded-lg border capitalize transition-colors"
                  style={
                    on
                      ? { backgroundColor: INCIDENT_SEVERITY_COLORS[s], color: '#fff', borderColor: INCIDENT_SEVERITY_COLORS[s] }
                      : { backgroundColor: 'transparent', color: '#9CA3AF', borderColor: '#232323' }
                  }
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>

        {isSerious && (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-300 leading-relaxed">
              Serious injuries must be reported to Cal/OSHA within 8 hours (T8 §342 / LC §6409.1).
              <label className="flex items-center gap-2 mt-1.5 text-amber-200">
                <input type="checkbox" checked={reportedToCalOsha} onChange={() => setReportedToCalOsha((v) => !v)} className="accent-mytra-purple w-4 h-4" />
                Reported to Cal/OSHA
              </label>
            </div>
          </div>
        )}

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
          <label className={labelCls}>When did it occur?</label>
          <input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>What happened?</label>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the incident…" className={`${inputCls} resize-none`} />
        </div>
        <div>
          <label className={labelCls}>Immediate actions taken</label>
          <textarea rows={2} value={immediateActions} onChange={(e) => setImmediateActions(e.target.value)} className={`${inputCls} resize-none`} />
        </div>
      </div>

      {/* Witnesses */}
      <section className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-2">
        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Witnesses</h4>
        <div className="flex gap-2">
          <input
            type="text"
            value={witnessInput}
            onChange={(e) => setWitnessInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addWitness()
              }
            }}
            placeholder="Add a name"
            className={inputCls}
          />
          <button type="button" onClick={addWitness} className="shrink-0 px-3 rounded-lg bg-mytra-bg border border-mytra-border text-gray-300 hover:text-white">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {witnesses.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {witnesses.map((w, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-mytra-bg border border-mytra-border rounded-full pl-2.5 pr-1 py-1 text-gray-300">
                {w}
                <button type="button" onClick={() => setWitnesses((arr) => arr.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Photos */}
      <section className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-2">
        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Photos</h4>
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.dataUrl} alt="Incident photo" className="w-16 h-16 object-cover rounded-lg border border-mytra-border" />
              <button
                type="button"
                onClick={() => setPhotos((arr) => arr.filter((x) => x.id !== p.id))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-500"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-16 h-16 rounded-lg border border-dashed border-mytra-border text-gray-500 hover:text-white hover:border-mytra-purple/50 flex flex-col items-center justify-center gap-1 transition-colors"
          >
            <Camera className="w-4 h-4" />
            <span className="text-[9px]">Add</span>
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
      <section className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-3">
        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Analysis</h4>
        <div>
          <label className={labelCls}>Root cause</label>
          <textarea rows={2} value={rootCause} onChange={(e) => setRootCause(e.target.value)} className={`${inputCls} resize-none`} />
        </div>
        <div>
          <label className={labelCls}>Corrective actions</label>
          <textarea rows={2} value={correctiveActions} onChange={(e) => setCorrectiveActions(e.target.value)} className={`${inputCls} resize-none`} />
        </div>
      </section>

      {/* Reporter signature */}
      <section className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-3">
        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Reporter</h4>
        <div>
          <label className={labelCls}>Name</label>
          <input type="text" value={reporterName} onChange={(e) => setReporterName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Signature (optional)</label>
          <SignaturePad onChange={(url) => setReporterSig(url)} />
        </div>
      </section>

      <div className="sticky bottom-0 pb-4 pt-2 bg-gradient-to-t from-mytra-bg via-mytra-bg to-transparent">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="w-full py-3 rounded-lg text-sm font-semibold transition-colors bg-mytra-purple text-white hover:bg-mytra-purple-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {canSubmit ? 'File Report' : 'Add a description and location'}
        </button>
      </div>
    </div>
  )
}
