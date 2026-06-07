'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  CheckCircle2,
  Wrench,
  Shield,
  AlertTriangle,
  Camera,
  X,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
} from 'lucide-react'
import {
  EquipmentItem,
  Shift,
  InspectionResult,
  InspectionItemResult,
  InspectionRecord,
  getChecklistType,
} from '@/lib/types'
import { getChecklist } from '@/data/inspection-checklists'
import {
  buildBlankItems,
  getLastInspector,
  submitInspection,
  getInspectionsByEquipment,
  onInspectionChange,
} from '@/lib/inspections'
import { compressPhoto } from '@/lib/media'
import { getCurrentIdentity } from '@/lib/identity'
import { getAuthorization, isUserAuthorized, onShopMgmtChange } from '@/lib/shop-management'
import { formatDateTime } from '@/lib/datetime'

// ── Shift options ──────────────────────────────────────────

const SHIFTS: Shift[] = ['Day', 'Swing', 'Night']

// ── ChecklistItemRow ───────────────────────────────────────

interface ChecklistItemRowProps {
  item: { id: string; label: string; category: string; critical: boolean }
  state: InspectionItemResult
  notesMissing: boolean
  onResult: (result: InspectionResult) => void
  onNotes: (notes: string) => void
  onRemovePhoto: () => void
  onCameraClick: (itemId: string) => void
}

function ChecklistItemRow({
  item,
  state,
  notesMissing,
  onResult,
  onNotes,
  onRemovePhoto,
  onCameraClick,
}: ChecklistItemRowProps) {
  const isFail = state.result === 'fail'

  return (
    <div className="bg-mytra-card border border-mytra-border rounded-lg p-3">
      {/* Item label and critical badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-sm text-fg leading-snug">{item.label}</span>
          {item.critical && (
            <span className="inline-flex items-center gap-0.5 shrink-0 text-xs font-medium text-warn bg-warn/10 px-1.5 py-0.5 rounded">
              <AlertTriangle className="w-2.5 h-2.5" />
              Safety-critical
            </span>
          )}
        </div>
      </div>

      {/* Pass / Fail / N/A toggles */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onResult('pass')}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors duration-150 ${
            state.result === 'pass'
              ? 'bg-ok text-white'
              : 'bg-mytra-bg border border-mytra-border text-fg-3 hover:text-fg hover:border-ok/50'
          }`}
        >
          Pass
        </button>
        <button
          type="button"
          onClick={() => onResult('fail')}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors duration-150 ${
            state.result === 'fail'
              ? 'bg-danger text-white'
              : 'bg-mytra-bg border border-mytra-border text-fg-3 hover:text-fg hover:border-danger/50'
          }`}
        >
          Fail
        </button>
        <button
          type="button"
          onClick={() => onResult('na')}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors duration-150 ${
            state.result === 'na'
              ? 'bg-fg-3 text-white'
              : 'bg-mytra-bg border border-mytra-border text-fg-3 hover:text-fg hover:border-fg-4/50'
          }`}
        >
          N/A
        </button>
      </div>

      {/* Fail expanded section */}
      {isFail && (
        <div className="mt-3 space-y-2 animate-fadeIn">
          {/* Critical warning banner */}
          {item.critical && (
            <div className="flex items-start gap-2 bg-warn/10 border border-warn/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
              <p className="text-xs text-warn/80 leading-relaxed">
                This is a safety-critical item — flagging it will send this unit to maintenance.
              </p>
            </div>
          )}

          {/* Notes input */}
          <textarea
            rows={2}
            value={state.notes}
            onChange={(e) => onNotes(e.target.value)}
            placeholder="Describe the issue..."
            aria-label="Describe the issue"
            className={`w-full bg-mytra-input border rounded-lg py-2.5 px-3
                       text-sm text-fg placeholder:text-fg-4 resize-none
                       focus:outline-none focus:ring-2 focus:ring-mytra-purple focus:border-transparent
                       ${notesMissing ? 'border-danger ring-2 ring-danger/50' : 'border-mytra-border'}`}
          />

          {/* Photo capture or thumbnail */}
          <div className="flex items-center gap-2">
            {state.photo ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={state.photo}
                  alt="Defect photo"
                  className="w-16 h-16 object-cover rounded-lg border border-mytra-border"
                />
                <button
                  type="button"
                  onClick={onRemovePhoto}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-danger rounded-full
                             flex items-center justify-center hover:bg-danger/80 transition-colors"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onCameraClick(item.id)}
                className="inline-flex items-center gap-1.5 text-xs text-fg-3 hover:text-fg
                           bg-mytra-bg border border-mytra-border rounded-lg px-3 py-2
                           hover:border-mytra-purple/50 transition-colors duration-150"
              >
                <Camera className="w-3.5 h-3.5" />
                Add Photo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── InspectionHistory ──────────────────────────────────────

interface InspectionHistoryProps {
  history: InspectionRecord[]
  showHistory: boolean
  onToggle: () => void
}

function InspectionHistory({ history, showHistory, onToggle }: InspectionHistoryProps) {
  if (history.length === 0) return null

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={showHistory}
        className="w-full flex items-center justify-between px-4 py-3
                   bg-mytra-card border border-mytra-border rounded-lg
                   hover:bg-mytra-card-hover active:bg-mytra-border
                   transition-colors duration-150 press-scale"
      >
        <span className="text-sm font-medium text-fg">
          Recent Inspections ({history.length})
        </span>
        {showHistory ? (
          <ChevronUp className="w-4 h-4 text-fg-3" />
        ) : (
          <ChevronDown className="w-4 h-4 text-fg-3" />
        )}
      </button>

      <div className={`accordion-content ${showHistory ? 'open' : ''}`}>
        <div>
          <div className="mt-2 space-y-2">
            {history.slice(0, 5).map((record) => (
              <div
                key={record.id}
                className="bg-mytra-card border border-mytra-border rounded-lg px-4 py-3
                           flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-fg truncate">{record.inspectorName}</p>
                  <p className="text-xs text-fg-3">
                    {formatDateTime(record.createdAt)} &middot; {record.shift} shift
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    record.syncStatus === 'synced' ? 'bg-ok' :
                    record.syncStatus === 'failed' ? 'bg-danger' :
                    record.syncStatus === 'pending' ? 'bg-warn' : 'bg-fg-4'
                  }`} title={`Sync: ${record.syncStatus}`} />
                  <span
                    className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                      record.hasCriticalFail
                        ? 'bg-danger/15 text-danger'
                        : record.result === 'fail'
                          ? 'bg-warn/15 text-warn'
                          : 'bg-ok/15 text-ok'
                    }`}
                  >
                    {record.hasCriticalFail ? 'Critical' : record.result === 'fail' ? 'Issues' : 'Pass'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── PreTripInspection (default export) ─────────────────────

interface PreTripInspectionProps {
  equipment: EquipmentItem
  onStatusChange?: () => void
}

export default function PreTripInspection({ equipment, onStatusChange }: PreTripInspectionProps) {
  const checklistType = getChecklistType(equipment)
  const checklist = getChecklist(checklistType)
  const isManualPalletJack = checklistType === 'manual-pallet-jack'

  // Step state
  const [step, setStep] = useState<'identify' | 'checklist' | 'result'>('identify')

  // Identify step
  const [inspectorName, setInspectorName] = useState('')
  const [shift, setShift] = useState<Shift>('Day')
  const [hourMeter, setHourMeter] = useState('')

  // Checklist step
  const [items, setItems] = useState<InspectionItemResult[]>(() => buildBlankItems(checklistType))

  // Result step
  const [submittedRecord, setSubmittedRecord] = useState<{
    result: 'pass' | 'fail'
    hasCriticalFail: boolean
    workOrderId: string | null
  } | null>(null)

  // Notes validation
  const [missingNotes, setMissingNotes] = useState<Set<string>>(new Set())

  // History
  const [history, setHistory] = useState<InspectionRecord[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // File input refs — managed here, not in ChecklistItemRow
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Back-navigation guard during checklist
  useEffect(() => {
    if (step !== 'checklist') return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [step])

  // Authorization state — only needed during identify step, subscribes to changes
  const [operatorAuthorized, setOperatorAuthorized] = useState(true)
  const [authRestricted, setAuthRestricted] = useState(false)

  useEffect(() => {
    function refresh() {
      const auth = getAuthorization(equipment.itemNumber)
      const id = getCurrentIdentity()
      setAuthRestricted(auth.restricted)
      setOperatorAuthorized(!auth.restricted || isUserAuthorized(equipment.itemNumber, id?.email ?? null))
    }
    refresh()
    return onShopMgmtChange(refresh)
  }, [equipment.itemNumber])

  // Prefill inspector: prefer the signed-in identity, fall back to last-used name.
  useEffect(() => {
    const id = getCurrentIdentity()
    if (id?.name) {
      setInspectorName(id.name)
      return
    }
    const last = getLastInspector()
    if (last) setInspectorName(last)
  }, [])

  // Load history and subscribe to changes
  useEffect(() => {
    function loadHistory() {
      setHistory(getInspectionsByEquipment(equipment.itemNumber))
    }
    loadHistory()
    const unsub = onInspectionChange(loadHistory)
    return unsub
  }, [equipment.itemNumber])

  // ── Item update handlers ─────────────────────────────────

  const handleResult = useCallback((itemId: string, result: InspectionResult) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, result } : it))
    )
  }, [])

  const handleNotes = useCallback((itemId: string, notes: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, notes } : it))
    )
    if (notes.trim()) {
      setMissingNotes((prev) => {
        if (!prev.has(itemId)) return prev
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    }
  }, [])

  const handlePhoto = useCallback((itemId: string, photo: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, photo } : it))
    )
  }, [])

  const handleRemovePhoto = useCallback((itemId: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, photo: null } : it))
    )
  }, [])

  const handleCameraClick = useCallback((itemId: string) => {
    const input = fileInputRefs.current[itemId]
    if (input) input.click()
  }, [])

  const handleFileChange = useCallback(
    async (itemId: string, file: File | null) => {
      if (!file) return
      try {
        const compressed = await compressPhoto(file)
        handlePhoto(itemId, compressed)
      } catch (err) {
        console.error('Photo compression failed:', err)
      }
    },
    [handlePhoto]
  )

  // ── Checklist progress ───────────────────────────────────

  const totalItems = items.length
  const answeredItems = items.filter((it) => it.result !== null).length
  const criticalFailCount = items.filter(
    (it) => it.critical && it.result === 'fail'
  ).length
  const allAnswered = answeredItems === totalItems
  const remaining = totalItems - answeredItems

  // ── Submit ───────────────────────────────────────────────

  function handleSubmit() {
    if (!allAnswered) return

    // Validate notes on failed items
    const failedWithoutNotes = items
      .filter((it) => it.result === 'fail' && !it.notes.trim())
      .map((it) => it.id)
    if (failedWithoutNotes.length > 0) {
      setMissingNotes(new Set(failedWithoutNotes))
      return
    }

    const record = submitInspection({
      equipmentId: equipment.itemNumber,
      inspectorName,
      shift,
      hourMeterReading: hourMeter ? parseFloat(hourMeter) : null,
      checklistType,
      items,
    })

    setSubmittedRecord({
      result: record.result,
      hasCriticalFail: record.hasCriticalFail,
      workOrderId: record.workOrderId,
    })
    setStep('result')

    // Notify parent if status changed (critical fail sets Out of Service)
    if (record.hasCriticalFail && onStatusChange) {
      onStatusChange()
    }
  }

  // ── Reset to new inspection ──────────────────────────────

  function handleReset() {
    setStep('identify')
    setItems(buildBlankItems(checklistType))
    setSubmittedRecord(null)
    setHourMeter('')
    // Keep inspectorName and shift for convenience
  }

  // ── RENDER ───────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── IDENTIFY STEP ──────────────────────────────────── */}
      {step === 'identify' && (
        <div className="animate-fadeIn space-y-4">
          <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardCheck className="w-5 h-5 text-mytra-purple" />
              <h3 className="text-sm font-semibold text-fg">
                {checklist.title} Pre-Trip Inspection
              </h3>
            </div>

            {/* Inspector name */}
            <div>
              <label htmlFor="inspector-name" className="block text-xs text-fg-3 mb-1">
                Inspector Name
              </label>
              <input
                id="inspector-name"
                type="text"
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                placeholder="Your name"
                required
                aria-required="true"
                className="w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3
                           text-sm text-fg placeholder:text-fg-4
                           focus:outline-none focus:ring-2 focus:ring-mytra-purple focus:border-transparent"
              />
            </div>

            {/* Shift toggle */}
            <div>
              <label className="block text-xs text-fg-3 mb-1">Shift</label>
              <div className="flex gap-2" role="radiogroup" aria-label="Shift">
                {SHIFTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={shift === s}
                    onClick={() => setShift(s)}
                    className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors duration-150 ${
                      shift === s
                        ? 'bg-mytra-purple text-white'
                        : 'bg-mytra-bg border border-mytra-border text-fg-3 hover:text-fg hover:border-mytra-purple/50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Hour meter — hidden for manual pallet jack */}
            {!isManualPalletJack && (
              <div>
                <label htmlFor="hour-meter" className="block text-xs text-fg-3 mb-1">
                  Hour Meter Reading
                </label>
                <input
                  id="hour-meter"
                  type="number"
                  inputMode="decimal"
                  value={hourMeter}
                  onChange={(e) => setHourMeter(e.target.value)}
                  placeholder="e.g. 1234.5"
                  className="w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3
                             text-sm text-fg placeholder:text-fg-4
                             focus:outline-none focus:ring-2 focus:ring-mytra-purple focus:border-transparent"
                />
              </div>
            )}

            {/* Authorization check */}
            {authRestricted && operatorAuthorized && (
              <div className="flex items-center gap-2 bg-ok/10 border border-ok/20 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
                <p className="text-xs text-ok">Authorized operator</p>
              </div>
            )}
            {authRestricted && !operatorAuthorized && (
              <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-danger mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-danger">Not Authorized</p>
                  <p className="text-xs text-fg-2 mt-0.5">
                    This equipment requires authorization. You are not on the authorized operator list. Contact your supervisor or EHS.
                  </p>
                </div>
              </div>
            )}

            {/* Start button */}
            <button
              type="button"
              onClick={() => setStep('checklist')}
              disabled={!inspectorName.trim() || !operatorAuthorized}
              className="w-full py-3 rounded-lg text-sm font-semibold transition-colors duration-150
                         bg-mytra-purple text-white hover:bg-mytra-purple-hover
                         disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-mytra-purple"
            >
              Start Inspection
            </button>
          </div>

          {/* History section on identify step */}
          <InspectionHistory
            history={history}
            showHistory={showHistory}
            onToggle={() => setShowHistory((prev) => !prev)}
          />
        </div>
      )}

      {/* ── CHECKLIST STEP ─────────────────────────────────── */}
      {step === 'checklist' && (
        <div className="animate-fadeIn space-y-4">
          {/* Progress bar */}
          <div className="bg-mytra-card border border-mytra-border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-fg-3">
                {answeredItems}/{totalItems} items checked
              </span>
              {criticalFailCount > 0 && (
                <span className="text-xs text-danger font-medium">
                  {criticalFailCount} critical {criticalFailCount === 1 ? 'fail' : 'fails'}
                </span>
              )}
            </div>
            <div className="w-full bg-mytra-bg rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${totalItems > 0 ? (answeredItems / totalItems) * 100 : 0}%`,
                  backgroundColor: criticalFailCount > 0 ? 'var(--danger)' : 'var(--accent)',
                }}
              />
            </div>
          </div>

          {/* Sections with category headers */}
          {checklist.sections.map((section) => (
            <div key={section.category}>
              <h4 className="text-xs uppercase tracking-wider text-fg-4 font-semibold mb-2 px-1">
                {section.category}
              </h4>
              <div className="space-y-2">
                {section.items.map((checkItem) => {
                  const itemState = items.find((it) => it.id === checkItem.id)
                  if (!itemState) return null
                  return (
                    <div key={checkItem.id}>
                      <ChecklistItemRow
                        item={checkItem}
                        state={itemState}
                        notesMissing={missingNotes.has(checkItem.id)}
                        onResult={(result) => handleResult(checkItem.id, result)}
                        onNotes={(notes) => handleNotes(checkItem.id, notes)}
                        onRemovePhoto={() => handleRemovePhoto(checkItem.id)}
                        onCameraClick={handleCameraClick}
                      />
                      {/* Hidden file input — managed in parent */}
                      <input
                        ref={(el) => {
                          fileInputRefs.current[checkItem.id] = el
                        }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null
                          handleFileChange(checkItem.id, file)
                          // Reset so same file can be re-selected
                          e.target.value = ''
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Sticky submit button */}
          <div className="sticky bottom-0 pb-4 pt-2 bg-gradient-to-t from-mytra-bg via-mytra-bg to-transparent">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!allAnswered}
              className="w-full py-3 rounded-lg text-sm font-semibold transition-colors duration-150
                         bg-mytra-purple text-white hover:bg-mytra-purple-hover
                         disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-mytra-purple"
            >
              {missingNotes.size > 0
                ? 'Add notes to failed items'
                : allAnswered
                  ? 'Submit Inspection'
                  : `${remaining} item${remaining === 1 ? '' : 's'} remaining`}
            </button>
          </div>
        </div>
      )}

      {/* ── RESULT STEP ────────────────────────────────────── */}
      {step === 'result' && submittedRecord && (
        <div className="animate-fadeIn space-y-4">
          {/* Pass */}
          {submittedRecord.result === 'pass' && (
            <div className="bg-ok/10 border border-ok/20 rounded-lg p-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-ok mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-ok mb-1">All Clear</h3>
              <p className="text-sm text-ok/80">
                You&apos;re good to go. Inspection logged.
              </p>
            </div>
          )}

          {/* Non-critical fail */}
          {submittedRecord.result === 'fail' && !submittedRecord.hasCriticalFail && (
            <div className="bg-warn/10 border border-warn/20 rounded-lg p-6 text-center">
              <Wrench className="w-12 h-12 text-warn mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-warn mb-1">Issues Noted</h3>
              <p className="text-sm text-warn/80 mb-3">
                Maintenance has been notified. You may operate with caution.
              </p>
              {submittedRecord.workOrderId && (
                <p className="text-xs text-fg-3">
                  Work Order: <span className="text-fg font-mono">{submittedRecord.workOrderId}</span>
                </p>
              )}
            </div>
          )}

          {/* Critical fail */}
          {submittedRecord.result === 'fail' && submittedRecord.hasCriticalFail && (
            <div className="bg-danger/10 border border-danger/20 rounded-lg p-6 text-center">
              <Shield className="w-12 h-12 text-danger mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-danger mb-1">Out of Service</h3>
              <p className="text-sm text-danger/80 mb-3">
                This unit has been taken out of service for maintenance. Thanks for keeping everyone safe.
              </p>
              {submittedRecord.workOrderId && (
                <p className="text-xs text-fg-3">
                  Work Order: <span className="text-fg font-mono">{submittedRecord.workOrderId}</span>
                </p>
              )}
            </div>
          )}

          {/* New Inspection button */}
          <button
            type="button"
            onClick={handleReset}
            className="w-full py-3 rounded-lg text-sm font-semibold transition-colors duration-150
                       bg-mytra-card border border-mytra-border text-fg
                       hover:bg-mytra-card-hover"
          >
            New Inspection
          </button>
        </div>
      )}
    </div>
  )
}
