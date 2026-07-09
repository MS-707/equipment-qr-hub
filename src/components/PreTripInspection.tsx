'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  CheckCircle2,
  Wrench,
  Shield,
  AlertTriangle,
  AlertCircle,
  Camera,
  CloudOff,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  RotateCcw,
  Printer,
  LogIn,
} from 'lucide-react'
import {
  EquipmentItem,
  Shift,
  InspectionResult,
  InspectionItemResult,
  InspectionRecord,
  NaReasonCode,
  NA_REASON_LABELS,
  getChecklistType,
} from '@/lib/types'
import { getChecklist } from '@/data/inspection-checklists'
import {
  buildBlankItems,
  getLastInspector,
  submitInspection,
  getInspectionsByEquipment,
  onInspectionChange,
  queueNotifyPayload,
} from '@/lib/inspections'
import { compressPhoto } from '@/lib/media'
import { haptic } from '@/lib/haptic'
import { getCurrentIdentity } from '@/lib/identity'
import SignaturePad from '@/components/SignaturePad'
import { getAuthorization, isUserAuthorized, onShopMgmtChange } from '@/lib/shop-management'
import { formatDateTime } from '@/lib/datetime'
import { btnPrimaryCls, btnSelectedCls } from '@/lib/form-styles'
import Link from 'next/link'

const DRAFT_KEY_PREFIX = 'draft:inspection:'
const DRAFT_SAVE_DELAY = 2000

// ── Shift options ──────────────────────────────────────────

const SHIFTS: Shift[] = ['Day', 'Swing', 'Night']

// ── ChecklistItemRow ───────────────────────────────────────

const NA_REASON_CODES: NaReasonCode[] = ['not-installed', 'cannot-access', 'maintenance-in-progress', 'other']

interface ChecklistItemRowProps {
  item: { id: string; label: string; category: string; critical: boolean }
  state: InspectionItemResult
  notesMissing: boolean
  naMissing: boolean
  onResult: (result: InspectionResult) => void
  onNotes: (notes: string) => void
  onNaReason: (code: NaReasonCode) => void
  onNaJustification: (text: string) => void
  onRemovePhoto: () => void
  onCameraClick: (itemId: string) => void
}

function ChecklistItemRow({
  item,
  state,
  notesMissing,
  naMissing,
  onResult,
  onNotes,
  onNaReason,
  onNaJustification,
  onRemovePhoto,
  onCameraClick,
}: ChecklistItemRowProps) {
  const isFail = state.result === 'fail'
  const isCriticalNa = item.critical && state.result === 'na'

  return (
    <div className="bg-mytra-card border border-mytra-border rounded-card p-3">
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
          className={`flex-1 text-sm font-semibold py-2.5 rounded-md transition-colors duration-150 min-h-[44px] ${
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
          className={`flex-1 text-sm font-semibold py-2.5 rounded-md transition-colors duration-150 min-h-[44px] ${
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
          className={`flex-1 text-sm font-semibold py-2.5 rounded-md transition-colors duration-150 min-h-[44px] ${
            state.result === 'na'
              ? 'bg-fg-3 text-white'
              : 'bg-mytra-bg border border-mytra-border text-fg-3 hover:text-fg hover:border-fg-4/50'
          }`}
        >
          N/A
        </button>
      </div>

      {/* Critical N/A justification section */}
      {isCriticalNa && (
        <div className="mt-3 space-y-2 animate-fadeIn">
          <div className="flex items-start gap-2 bg-warn/10 border border-warn/20 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
            <p className="text-sm text-warn-strong leading-relaxed">
              This is a safety-critical item. You must provide a reason for marking it N/A.
            </p>
          </div>

          <div className="space-y-1.5">
            {NA_REASON_CODES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => onNaReason(code)}
                className={`w-full text-left text-xs py-2.5 px-3 rounded-md transition-colors duration-150 min-h-[44px] flex items-center ${
                  state.naReasonCode === code
                    ? 'bg-mytra-purple/15 border border-mytra-purple/30 text-fg font-medium'
                    : 'bg-mytra-bg border border-mytra-border text-fg-3 hover:text-fg hover:border-mytra-purple/30'
                }`}
              >
                {NA_REASON_LABELS[code]}
              </button>
            ))}
          </div>

          {state.naReasonCode && (
            <textarea
              rows={2}
              maxLength={2000}
              value={state.naJustification || ''}
              onChange={(e) => onNaJustification(e.target.value)}
              placeholder={state.naReasonCode === 'other' ? 'Explain why this item is not applicable...' : 'Additional details (optional)...'}
              aria-label="N/A justification"
              className={`w-full bg-mytra-input border rounded-lg py-2.5 px-3
                         text-sm text-fg placeholder:text-fg-4 resize-none
                         focus:outline-none focus:ring-2 focus:ring-mytra-purple focus:border-transparent
                         ${naMissing ? 'border-danger ring-2 ring-danger/50' : 'border-mytra-border'}`}
            />
          )}
        </div>
      )}

      {/* Fail expanded section */}
      {isFail && (
        <div className="mt-3 space-y-2 animate-fadeIn">
          {/* Critical warning banner */}
          {item.critical && (
            <div className="flex items-start gap-2 bg-warn/10 border border-warn/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
              <p className="text-sm text-warn-strong leading-relaxed">
                This is a safety-critical item — flagging it will send this unit to maintenance.
              </p>
            </div>
          )}

          {/* Notes input */}
          <textarea
            rows={2}
            maxLength={2000}
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
          <div data-tour-module="inspection-photo" className="flex items-center gap-2">
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
                  aria-label="Remove photo"
                  className="absolute -top-3 -right-3 w-11 h-11 rounded-full
                             flex items-center justify-center transition-colors group"
                >
                  <span className="w-7 h-7 bg-danger rounded-full flex items-center justify-center group-hover:bg-danger/80 transition-colors">
                    <X className="w-3.5 h-3.5 text-white" />
                  </span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onCameraClick(item.id)}
                className="inline-flex items-center gap-1.5 text-sm text-fg-3 hover:text-fg
                           bg-mytra-bg border border-mytra-border rounded-lg px-3 py-2 min-h-[44px]
                           hover:border-mytra-purple/50 transition-colors duration-150"
              >
                <Camera className="w-4 h-4" />
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
    <div data-tour-module="inspection-history" className="mt-6">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={showHistory}
        className="w-full flex items-center justify-between px-4 py-3
                   bg-mytra-card border border-mytra-border rounded-card
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
                className="bg-mytra-card border border-mytra-border rounded-card px-4 py-3
                           flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-fg truncate">{record.inspectorName}</p>
                  <p className="text-xs text-fg-3">
                    {formatDateTime(record.createdAt)} &middot; {record.shift} shift
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Sync state must never be color-only: icon+text for anything
                      actionable, sr-only text for the quiet synced dot. */}
                  {record.syncStatus === 'failed' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-danger/10 text-danger shrink-0">
                      <AlertCircle className="w-3 h-3" />
                      Sync failed
                    </span>
                  ) : record.syncStatus === 'pending' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-warn/10 text-warn shrink-0">
                      <RefreshCw className="w-3 h-3" />
                      Pending
                    </span>
                  ) : record.syncStatus === 'offline' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-mytra-bg border border-mytra-border text-fg-3 shrink-0">
                      <CloudOff className="w-3 h-3" />
                      Offline
                    </span>
                  ) : (
                    <span className="inline-flex items-center shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-ok" aria-hidden="true" />
                      <span className="sr-only">Synced to cloud</span>
                    </span>
                  )}
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
  /**
   * Fires with true while the operator is mid-checklist. Hosts that support
   * swipe navigation (EquipmentProfile tabs) MUST suspend it during an active
   * inspection — a stray swipe is an SPA navigation that bypasses
   * beforeunload and silently drops un-debounced answers.
   */
  onChecklistActiveChange?: (active: boolean) => void
}

export default function PreTripInspection({ equipment, onStatusChange, onChecklistActiveChange }: PreTripInspectionProps) {
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
    id: string
    result: 'pass' | 'fail'
    hasCriticalFail: boolean
    criticalNaCount: number
    workOrderId: string | null
  } | null>(null)

  // EHS email notification outcome — 'skipped' means email isn't configured
  // server-side (nothing to surface); 'queued' means it will auto-send on
  // reconnect; 'failed' must be shown so "EHS knows" is never assumed when
  // nothing was delivered.
  const [notifyStatus, setNotifyStatus] = useState<'idle' | 'pending' | 'sent' | 'skipped' | 'queued' | 'signin-required' | 'failed'>('idle')

  // Local save failure (storage quota/corruption) — the inspection was NOT
  // persisted; keep the operator on the checklist with their answers intact.
  const [saveError, setSaveError] = useState<string | null>(null)

  // Defect photos live only in IndexedDB (records store photo: null) — a
  // failed write means the evidence is gone and the operator must know.
  const [photoSaveFailed, setPhotoSaveFailed] = useState(false)

  // Operator sign-on: touch signature certifying the inspection (same pad as
  // PTP crew sign-on). Required before submit — it's what makes the emailed
  // copy auditable.
  const [signature, setSignature] = useState<string | null>(null)

  // Announce the verdict: move focus to the result heading (screen readers
  // hear "Out of Service" instead of silence) and give glove-friendly haptic
  // feedback matched to severity. Mirrors the PtpDone pattern.
  const resultHeadingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (step !== 'result' || !submittedRecord) return
    resultHeadingRef.current?.focus()
    haptic(
      submittedRecord.hasCriticalFail
        ? 'error'
        : submittedRecord.result === 'fail'
          ? 'warning'
          : 'success'
    )
  }, [step, submittedRecord])

  // Notes / N/A validation
  const [missingNotes, setMissingNotes] = useState<Set<string>>(new Set())
  const [missingNaJustification, setMissingNaJustification] = useState<Set<string>>(new Set())

  // History
  const [history, setHistory] = useState<InspectionRecord[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // File input refs — managed here, not in ChecklistItemRow
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Draft persistence — save checklist progress to localStorage so a locked
  // phone or browser crash mid-inspection doesn't wipe out answered items.
  const draftKey = `${DRAFT_KEY_PREFIX}${equipment.itemNumber}`
  const draftHandled = useRef(false)
  const [draftRestored, setDraftRestored] = useState(false)

  useEffect(() => {
    if (draftHandled.current) return
    draftHandled.current = true
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return
      const d = JSON.parse(raw)
      // Only restore drafts that match the current checklist shape — equipment
      // can change checklist type, which would make stale item ids meaningless.
      const blank = buildBlankItems(checklistType)
      const sameShape =
        Array.isArray(d.items) &&
        d.items.length === blank.length &&
        d.items.every((it: InspectionItemResult, i: number) => it.id === blank[i].id)
      const hasProgress = sameShape && d.items.some((it: InspectionItemResult) => it.result !== null)
      if (hasProgress) {
        setItems(d.items)
        if (typeof d.inspectorName === 'string') setInspectorName(d.inspectorName)
        if (typeof d.shift === 'string') setShift(d.shift as Shift)
        if (typeof d.hourMeter === 'string') setHourMeter(d.hourMeter)
        if (d.step === 'checklist') setStep('checklist')
        setDraftRestored(true)
      } else {
        localStorage.removeItem(draftKey)
      }
    } catch {
      localStorage.removeItem(draftKey)
    }
  }, [draftKey, checklistType])

  // Ref-mirrored snapshot so pagehide/visibilitychange can flush the CURRENT
  // draft synchronously — the 2s debounce alone lost the last answers when
  // the phone was locked or backgrounded right after a tap.
  const draftStateRef = useRef({ step, inspectorName, shift, hourMeter, items })
  draftStateRef.current = { step, inspectorName, shift, hourMeter, items }

  const flushDraft = useCallback(() => {
    const s = draftStateRef.current
    if (s.step === 'result') return
    try {
      const hasProgress = s.items.some((it) => it.result !== null)
      if (!hasProgress) return
      // Strip photo data URLs — they can be megabytes each and would blow
      // the localStorage quota. Pass/fail/notes are what's costly to re-enter;
      // photos can be re-added on the failed items after a restore.
      const lean = s.items.map((it) => ({ ...it, photo: null }))
      localStorage.setItem(
        draftKey,
        JSON.stringify({ step: s.step, inspectorName: s.inspectorName, shift: s.shift, hourMeter: s.hourMeter, items: lean })
      )
    } catch {}
  }, [draftKey])

  useEffect(() => {
    if (step === 'result') {
      localStorage.removeItem(draftKey)
      return
    }
    const timer = setTimeout(flushDraft, DRAFT_SAVE_DELAY)
    return () => clearTimeout(timer)
  })

  // Flush immediately when the app backgrounds (home swipe, screen lock, app
  // switch) — mirrors useFormDraft's pagehide/visibilitychange behavior.
  useEffect(() => {
    const onPageHide = () => flushDraft()
    const onVisibility = () => {
      if (document.hidden) flushDraft()
    }
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [flushDraft])

  function discardDraft() {
    localStorage.removeItem(draftKey)
    setItems(buildBlankItems(checklistType))
    setHourMeter('')
    setStep('identify')
    setDraftRestored(false)
  }

  // Back-navigation guard during checklist
  useEffect(() => {
    if (step !== 'checklist') return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [step])

  // Tell the host when a checklist is in progress (covers draft restore too,
  // which can enter 'checklist' directly on mount). Cleared on unmount.
  useEffect(() => {
    onChecklistActiveChange?.(step === 'checklist')
  }, [step, onChecklistActiveChange])
  useEffect(() => {
    return () => { onChecklistActiveChange?.(false) }
  }, [onChecklistActiveChange])

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
      prev.map((it) => {
        if (it.id !== itemId) return it
        const updated = { ...it, result }
        if (result !== 'na') {
          updated.naReasonCode = null
          updated.naJustification = ''
        }
        return updated
      })
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

  const handleNaReason = useCallback((itemId: string, code: NaReasonCode) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, naReasonCode: code } : it))
    )
    setMissingNaJustification((prev) => {
      if (!prev.has(itemId)) return prev
      const next = new Set(prev)
      next.delete(itemId)
      return next
    })
  }, [])

  const handleNaJustification = useCallback((itemId: string, text: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, naJustification: text } : it))
    )
    if (text.trim()) {
      setMissingNaJustification((prev) => {
        if (!prev.has(itemId)) return prev
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    }
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
  const criticalNaCount = items.filter(
    (it) => it.critical && it.result === 'na'
  ).length
  const allAnswered = answeredItems === totalItems
  const remaining = totalItems - answeredItems

  // ── Submit ───────────────────────────────────────────────

  function handleSubmit() {
    if (!allAnswered || !signature) return

    // Validate notes on failed items
    const failedWithoutNotes = items
      .filter((it) => it.result === 'fail' && !it.notes.trim())
      .map((it) => it.id)
    if (failedWithoutNotes.length > 0) {
      setMissingNotes(new Set(failedWithoutNotes))
      return
    }

    // Validate N/A justification on critical items
    const criticalNaWithoutReason = items
      .filter((it) => it.critical && it.result === 'na' && !it.naReasonCode)
      .map((it) => it.id)
    const criticalNaOtherWithoutText = items
      .filter((it) => it.critical && it.result === 'na' && it.naReasonCode === 'other' && !(it.naJustification || '').trim())
      .map((it) => it.id)
    const allNaMissing = [...criticalNaWithoutReason, ...criticalNaOtherWithoutText]
    if (allNaMissing.length > 0) {
      setMissingNaJustification(new Set(allNaMissing))
      return
    }

    let record: InspectionRecord
    try {
      setPhotoSaveFailed(false)
      record = submitInspection(
        {
          equipmentId: equipment.itemNumber,
          inspectorName,
          shift,
          hourMeterReading: hourMeter ? parseFloat(hourMeter) : null,
          checklistType,
          items,
          signatureDataUrl: signature,
        },
        { onPhotoSaveError: () => setPhotoSaveFailed(true) }
      )
      setSaveError(null)
    } catch (e) {
      // Storage full or corrupt — the record was NOT saved. Stay on the
      // checklist (answers + draft intact) and tell the operator plainly.
      setSaveError(
        e instanceof Error
          ? e.message
          : 'The inspection could not be saved to this device. Try again.'
      )
      return
    }

    setSubmittedRecord({
      id: record.id,
      result: record.result,
      hasCriticalFail: record.hasCriticalFail,
      criticalNaCount: record.criticalNaCount,
      workOrderId: record.workOrderId,
    })
    setStep('result')

    // Email the completed inspection to EHS. Non-blocking, but the outcome is
    // tracked so the result screen never claims a notification that failed.
    // Retryable failures (offline, 5xx) queue for the reconnect flush; a 400
    // is permanently invalid and reports failed rather than poisoning the
    // queue. Strip photos to keep the payload small.
    const notifyPayload = {
      record: { ...record, items: record.items.map((i) => ({ ...i, photo: null })) },
      equipmentName: equipment.name,
      equipmentCategory: equipment.category,
      // The touch signature rides along so the emailed audit copy carries
      // proof of sign-on (attached as a PNG server-side).
      signatureDataUrl: signature,
    }
    setNotifyStatus('pending')
    fetch('/api/inspections/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notifyPayload),
    })
      .then(async (res) => {
        if (!res.ok) {
          // 401 = not signed in. The record is queued and WILL send once the
          // operator signs in (the queue flushes on the next foreground), so
          // tell them that honestly instead of blaming their connection.
          if (res.status === 401) setNotifyStatus(queueNotifyPayload(notifyPayload) ? 'signin-required' : 'failed')
          else if (res.status === 400) setNotifyStatus('failed')
          else setNotifyStatus(queueNotifyPayload(notifyPayload) ? 'queued' : 'failed')
          return
        }
        const data = await res.json()
        if (data.emailed) setNotifyStatus('sent')
        else if (data.reason === 'not-configured') setNotifyStatus('skipped')
        else setNotifyStatus(queueNotifyPayload(notifyPayload) ? 'queued' : 'failed')
      })
      .catch(() => setNotifyStatus(queueNotifyPayload(notifyPayload) ? 'queued' : 'failed'))

    // Notify parent if status changed (critical fail sets Out of Service)
    if (record.hasCriticalFail && onStatusChange) {
      onStatusChange()
    }
  }

  // ── Reset to new inspection ──────────────────────────────

  function handleReset() {
    localStorage.removeItem(draftKey)
    setStep('identify')
    setItems(buildBlankItems(checklistType))
    setSubmittedRecord(null)
    setNotifyStatus('idle')
    setPhotoSaveFailed(false)
    setSignature(null)
    setHourMeter('')
    setDraftRestored(false)
  }

  // ── RENDER ───────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Draft restored notice */}
      {draftRestored && step !== 'result' && (
        <div className="flex items-center justify-between gap-2 bg-mytra-purple/10 border border-mytra-purple/20 rounded-lg px-4 py-2.5 animate-fadeIn">
          <div className="flex items-center gap-2 text-sm text-mytra-purple">
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>In-progress inspection restored</span>
          </div>
          <button
            type="button"
            onClick={discardDraft}
            className="text-xs text-fg-3 hover:text-fg-2 min-h-[44px] px-3 inline-flex items-center shrink-0"
          >
            Start fresh
          </button>
        </div>
      )}

      {/* ── IDENTIFY STEP ──────────────────────────────────── */}
      {step === 'identify' && (
        <div className="animate-fadeIn space-y-4">
          <div data-tour-module="inspector-form" className="bg-mytra-card border border-mytra-border rounded-card p-4 space-y-4">
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
                autoCapitalize="words"
                autoComplete="name"
                maxLength={100}
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
                    className={`flex-1 text-sm font-medium py-2 min-h-[44px] rounded-lg transition-colors duration-150 ${
                      shift === s
                        ? `${btnSelectedCls}`
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
              data-tour-module="start-inspection"
              type="button"
              onClick={() => setStep('checklist')}
              disabled={!inspectorName.trim() || !operatorAuthorized}
              className={`${btnPrimaryCls} w-full py-3 text-sm font-semibold duration-150 disabled:hover:bg-mytra-purple`}
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
      {/* data-no-swipe: structural guard — swipes over an active checklist
          must never trigger host tab/back navigation (see useSwipe). */}
      {step === 'checklist' && (
        <div className="animate-fadeIn space-y-4" data-no-swipe>
          {/* Progress bar */}
          <div className="bg-mytra-card border border-mytra-border rounded-card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-fg-3">
                {answeredItems}/{totalItems} items checked
              </span>
              {(criticalFailCount > 0 || criticalNaCount > 0) && (
                <span className="text-xs font-medium flex items-center gap-2">
                  {criticalFailCount > 0 && (
                    <span className="text-danger">
                      {criticalFailCount} critical {criticalFailCount === 1 ? 'fail' : 'fails'}
                    </span>
                  )}
                  {criticalNaCount > 0 && (
                    <span className="text-warn">
                      {criticalNaCount} critical N/A
                    </span>
                  )}
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
              <div data-tour-module="checklist-items" className="space-y-2">
                {section.items.map((checkItem) => {
                  const itemState = items.find((it) => it.id === checkItem.id)
                  if (!itemState) return null
                  return (
                    <div key={checkItem.id}>
                      <ChecklistItemRow
                        item={checkItem}
                        state={itemState}
                        notesMissing={missingNotes.has(checkItem.id)}
                        naMissing={missingNaJustification.has(checkItem.id)}
                        onResult={(result) => handleResult(checkItem.id, result)}
                        onNotes={(notes) => handleNotes(checkItem.id, notes)}
                        onNaReason={(code) => handleNaReason(checkItem.id, code)}
                        onNaJustification={(text) => handleNaJustification(checkItem.id, text)}
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

          {/* Operator sign-on — appears once every item is answered */}
          {allAnswered && (
            <div className="bg-mytra-card border border-mytra-border rounded-card p-4 space-y-2 animate-fadeIn">
              <h4 className="text-sm font-semibold text-fg">Operator sign-on</h4>
              <p className="text-xs text-fg-2 leading-relaxed">
                Sign with your finger to certify you performed this inspection. Your signature
                is attached to the record and the EHS copy.
              </p>
              <SignaturePad onChange={(url) => setSignature(url)} />
              <p className="text-xs text-fg-4">Signing as <span className="text-fg-2 font-medium">{inspectorName}</span></p>
            </div>
          )}

          {/* Sticky submit button */}
          <div data-tour-module="inspection-submit" className="sticky bottom-0 pb-4 pt-2 bg-gradient-to-t from-mytra-bg via-mytra-bg to-transparent">
            {saveError && (
              <div role="alert" className="flex items-start gap-2 bg-danger/10 border border-danger/30 rounded-lg px-3 py-2.5 mb-2">
                <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                <p className="text-sm text-danger-strong">
                  Inspection NOT saved: {saveError} Your answers are still here — fix the issue and submit again.
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!allAnswered || !signature}
              className={`${btnPrimaryCls} w-full py-3 text-sm font-semibold duration-150 disabled:hover:bg-mytra-purple`}
            >
              {missingNotes.size > 0
                ? 'Add notes to failed items'
                : missingNaJustification.size > 0
                  ? 'Provide N/A justification for critical items'
                  : !allAnswered
                    ? `${remaining} item${remaining === 1 ? '' : 's'} remaining`
                    : !signature
                      ? 'Sign on to submit'
                      : 'Submit Inspection'}
            </button>
          </div>
        </div>
      )}

      {/* ── RESULT STEP ────────────────────────────────────── */}
      {step === 'result' && submittedRecord && (
        <div role="status" className="animate-fadeIn space-y-4">
          {/* Pass */}
          {submittedRecord.result === 'pass' && (
            <div className="bg-ok/10 border border-ok/20 rounded-lg p-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-ok mx-auto mb-3" />
              <h3 ref={resultHeadingRef} tabIndex={-1} className="text-lg font-semibold text-ok mb-1 outline-none">All Clear</h3>
              <p className="text-sm text-ok-strong">
                You&apos;re good to go. Inspection logged.
              </p>
              {submittedRecord.criticalNaCount > 0 && (
                <p className="text-sm text-warn-strong mt-3">
                  {submittedRecord.criticalNaCount} safety-critical {submittedRecord.criticalNaCount === 1 ? 'item was' : 'items were'} marked N/A — flagged for EHS review.
                </p>
              )}
            </div>
          )}

          {/* Non-critical fail */}
          {submittedRecord.result === 'fail' && !submittedRecord.hasCriticalFail && (
            <div className="bg-warn/10 border border-warn/20 rounded-lg p-6 text-center">
              <Wrench className="w-12 h-12 text-warn mx-auto mb-3" />
              <h3 ref={resultHeadingRef} tabIndex={-1} className="text-lg font-semibold text-warn mb-1 outline-none">Issues Noted</h3>
              <p className="text-sm text-warn-strong mb-3">
                Maintenance has been notified. You may operate with caution.
              </p>
              {submittedRecord.criticalNaCount > 0 && (
                <p className="text-sm text-warn-strong mb-3">
                  {submittedRecord.criticalNaCount} safety-critical {submittedRecord.criticalNaCount === 1 ? 'item was' : 'items were'} marked N/A — flagged for EHS review.
                </p>
              )}
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
              <h3 ref={resultHeadingRef} tabIndex={-1} className="text-lg font-semibold text-danger mb-1 outline-none">Out of Service</h3>
              <p className="text-sm text-danger-strong mb-3">
                This unit has been taken out of service for maintenance. Thanks for keeping everyone safe.
              </p>
              {submittedRecord.criticalNaCount > 0 && (
                <p className="text-sm text-warn-strong mb-3">
                  {submittedRecord.criticalNaCount} additional safety-critical {submittedRecord.criticalNaCount === 1 ? 'item was' : 'items were'} marked N/A.
                </p>
              )}
              {submittedRecord.workOrderId && (
                <p className="text-xs text-fg-3">
                  Work Order: <span className="text-fg font-mono">{submittedRecord.workOrderId}</span>
                </p>
              )}
            </div>
          )}

          {/* EHS email outcome — every terminal state gets a line so demos and the
              rehearsal script can assert the notify result (DM-10) */}
          {photoSaveFailed && (
            <div className="flex items-start gap-2 bg-warn/10 border border-warn/20 rounded-lg px-4 py-3">
              <Camera className="w-4 h-4 text-warn shrink-0 mt-0.5" />
              <p className="text-sm text-warn-strong">
                Defect photos could not be saved to this device (storage may be full).
                The inspection record itself is saved — retake photos for the work order if needed.
              </p>
            </div>
          )}
          {submittedRecord && (
            <Link
              href={`/inspections/record/${encodeURIComponent(submittedRecord.id)}`}
              className="no-print w-full inline-flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] rounded-lg text-sm font-semibold bg-mytra-purple/10 border border-mytra-purple/30 text-mytra-purple hover:bg-mytra-purple/20 transition-colors"
            >
              <Printer className="w-4 h-4" /> View / print signed record
            </Link>
          )}
          {notifyStatus === 'sent' && (
            <p className="text-sm text-ok-strong text-center">EHS has been notified by email.</p>
          )}
          {notifyStatus === 'skipped' && (
            <p data-notify-outcome="skipped" className="text-sm text-fg-3 text-center">
              EHS email isn&apos;t configured — the signed record is saved on this device.
            </p>
          )}
          {notifyStatus === 'queued' && (
            <div className="flex items-start gap-2 bg-warn/10 border border-warn/20 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
              <p className="text-sm text-warn-strong">
                The EHS email is queued and will send automatically when your connection returns.
              </p>
            </div>
          )}
          {notifyStatus === 'signin-required' && (
            <div className="flex items-start gap-2 bg-mytra-purple/10 border border-mytra-purple/30 rounded-lg px-4 py-3">
              <LogIn className="w-4 h-4 text-mytra-purple shrink-0 mt-0.5" />
              <p className="text-sm text-fg">
                The signed record is saved on this device. Sign in to send the EHS email —
                it will send automatically once you do.
              </p>
            </div>
          )}
          {notifyStatus === 'failed' && (
            <div className="flex items-start gap-2 bg-warn/10 border border-warn/20 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
              <p className="text-sm text-warn-strong">
                The EHS email notification could not be sent (offline or server issue).
                Your inspection is saved on this device — let your EHS contact know directly if this involved a safety-critical item.
              </p>
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
