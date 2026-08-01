'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ClipboardList, CheckCircle2, ArrowLeft, RotateCcw, WifiOff, Send, ChevronDown, ChevronUp, Sparkles, Loader2, Copy, AlertTriangle, AlertCircle, ShieldCheck } from 'lucide-react'
import type { Shift } from '@/lib/types'
import type { HazardEntry, HeatIllnessPlan, PreTaskPlan } from '@/lib/safety-types'
import { createPreTaskPlan, saveSignatures, getLatestPtp, getPtpForDate, cryptoRandomId } from '@/lib/safety-records'
import { trySyncRecord } from '@/lib/safety-sync'
import { useFormDraft } from '@/lib/use-draft'
import { getLastContext, saveLastContext } from '@/lib/use-last-context'
import LastUsedChip from './LastUsedChip'
import HazardTable from './HazardTable'
import PPESelector from './PPESelector'
import SageAssist from './SageAssist'
import CrewSignatureBlock, { type SignatureData } from './CrewSignatureBlock'
import { labelCls, inputCls, textareaCls, btnPrimaryCls, btnSelectedCls } from '@/lib/form-styles'
import { haptic } from '@/lib/haptic'
import { isReviewEnabled, submitForReview, type ReviewSubmitState } from '@/lib/review-submit'
import { localToday } from '@/lib/datetime'
import { useT } from '@/lib/i18n'
import ValidationSummary, { type ValidationError } from './ValidationSummary'

interface AuditFinding {
  category: string
  severity: 'blocker' | 'warning'
  finding: string
  suggestion: string
}

interface AuditResult {
  pass: boolean
  findings: AuditFinding[]
  overallRisk: 'low' | 'medium' | 'high' | 'critical'
}

const SHIFTS: Shift[] = ['Day', 'Swing', 'Night']

const SHIFT_KEYS = {
  Day: 'ptp.shiftDay',
  Swing: 'ptp.shiftSwing',
  Night: 'ptp.shiftNight',
} as const

function todayStr(): string {
  return localToday()
}

export default function PreTaskPlanForm() {
  const t = useT()
  const [step, setStep] = useState<'plan' | 'signon' | 'done'>('plan')

  const [date, setDate] = useState(todayStr())
  const [validUntil, setValidUntil] = useState('')
  const [shift, setShift] = useState<Shift>('Day')
  const [projectName, setProjectName] = useState('')
  const [location, setLocation] = useState('')
  const [scopeOfWork, setScopeOfWork] = useState('')
  const [hazards, setHazards] = useState<HazardEntry[]>([])
  const [ppe, setPpe] = useState<string[]>([])
  const [musterPoint, setMusterPoint] = useState('')
  const [hospital, setHospital] = useState('')
  const [firstAid, setFirstAid] = useState('')
  const [weather, setWeather] = useState('')
  const [wind, setWind] = useState('')
  const [heat, setHeat] = useState<HeatIllnessPlan>({
    water: false,
    shade: false,
    restBreaks: false,
    highHeatProcedures: false,
  })
  const [toolboxTopic, setToolboxTopic] = useState('')
  const [toolboxNotes, setToolboxNotes] = useState('')
  const [heatOpen, setHeatOpen] = useState(false)
  const [toolboxOpen, setToolboxOpen] = useState(false)

  const [toolboxLoading, setToolboxLoading] = useState(false)
  const [toolboxError, setToolboxError] = useState<string | null>(null)

  const [sigData, setSigData] = useState<SignatureData>({ signatures: [], blobs: {} })
  const [supervisorId, setSupervisorId] = useState<string | null>(null)
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [wasOffline, setWasOffline] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastCtx] = useState(getLastContext)
  const [carryForwardDismissed, setCarryForwardDismissed] = useState(false)
  const [activePtp] = useState(() => getPtpForDate(todayStr()))
  const [prevPtp] = useState(() => {
    if (activePtp) return null
    const ptp = getLatestPtp()
    if (!ptp || ptp.date === todayStr()) return null
    const age = Date.now() - new Date(ptp.createdAt).getTime()
    if (age > 7 * 24 * 60 * 60 * 1000) return null
    return ptp
  })

  const [showValidation, setShowValidation] = useState(false)
  const [showSignonValidation, setShowSignonValidation] = useState(false)

  const [auditResult, setAuditResult] = useState<AuditResult | null>(null)
  const [auditing, setAuditing] = useState(false)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [acknowledgedWarnings, setAcknowledgedWarnings] = useState(false)

  function applyCarryForward() {
    if (!prevPtp) return
    if (prevPtp.hazards.length > 0) setHazards(prevPtp.hazards.map(h => ({ ...h, id: cryptoRandomId() })))
    if (prevPtp.ppeRequired.length > 0) setPpe(prevPtp.ppeRequired)
    if (prevPtp.emergencyMusterPoint) setMusterPoint(prevPtp.emergencyMusterPoint)
    if (prevPtp.nearestHospital) setHospital(prevPtp.nearestHospital)
    if (prevPtp.firstAidEyewashLocation) setFirstAid(prevPtp.firstAidEyewashLocation)
    const h = prevPtp.heatIllnessPlan
    if (Object.values(h).some(Boolean)) {
      setHeat(h)
      setHeatOpen(true)
    }
    setCarryForwardDismissed(true)
  }

  const restore = useCallback((d: Record<string, unknown>) => {
    if (typeof d.date === 'string') setDate(d.date)
    if (typeof d.validUntil === 'string') setValidUntil(d.validUntil)
    if (typeof d.shift === 'string') setShift(d.shift as Shift)
    if (typeof d.projectName === 'string') setProjectName(d.projectName)
    if (typeof d.location === 'string') setLocation(d.location)
    if (typeof d.scopeOfWork === 'string') setScopeOfWork(d.scopeOfWork)
    if (Array.isArray(d.hazards)) setHazards(d.hazards)
    if (Array.isArray(d.ppe)) setPpe(d.ppe)
    if (typeof d.musterPoint === 'string') setMusterPoint(d.musterPoint)
    if (typeof d.hospital === 'string') setHospital(d.hospital)
    if (typeof d.firstAid === 'string') setFirstAid(d.firstAid)
    if (typeof d.weather === 'string') setWeather(d.weather)
    if (typeof d.wind === 'string') setWind(d.wind)
    if (d.heat && typeof d.heat === 'object') {
      const h = d.heat as HeatIllnessPlan
      setHeat(h)
      // Auto-expand collapsed sections so restored data isn't hidden.
      if (Object.values(h).some(Boolean)) setHeatOpen(true)
    }
    if (typeof d.toolboxTopic === 'string') setToolboxTopic(d.toolboxTopic)
    if (typeof d.toolboxNotes === 'string') setToolboxNotes(d.toolboxNotes)
    if ((typeof d.toolboxTopic === 'string' && d.toolboxTopic) || (typeof d.toolboxNotes === 'string' && d.toolboxNotes)) {
      setToolboxOpen(true)
    }
  }, [])

  const { hasDraft, clearDraft, dismissDraft } = useFormDraft(
    'ptp',
    () => ({ date, validUntil, shift, projectName, location, scopeOfWork, hazards, ppe, musterPoint, hospital, firstAid, weather, wind, heat, toolboxTopic, toolboxNotes }),
    restore,
    submittedId !== null
  )

  const canContinue = scopeOfWork.trim().length > 0 && location.trim().length > 0 && musterPoint.trim().length > 0
  const canSubmit = sigData.signatures.length >= 1 && supervisorId !== null

  const planErrors: ValidationError[] = [
    ...(scopeOfWork.trim().length === 0 ? [{ label: t('ptp.errScopeOfWork', undefined, 'Scope of work'), fieldId: 'ptp-scope' }] : []),
    ...(location.trim().length === 0 ? [{ label: t('ptp.errLocation', undefined, 'Location'), fieldId: 'ptp-location' }] : []),
    ...(musterPoint.trim().length === 0 ? [{ label: t('ptp.errMusterPoint', undefined, 'Muster point'), fieldId: 'ptp-muster' }] : []),
  ]

  const signonErrors: ValidationError[] = [
    ...(sigData.signatures.length < 1 ? [{ label: t('ptp.errCrewSignature', undefined, 'At least one crew signature'), fieldId: 'crew-signatures' }] : []),
    ...(supervisorId === null ? [{ label: t('ptp.errDesignateSupervisor', undefined, 'Designate a supervisor'), fieldId: 'crew-signatures' }] : []),
  ]

  function toggleHeat(key: keyof HeatIllnessPlan) {
    setHeat((h) => ({ ...h, [key]: !h[key] }))
  }

  const sageEnabled = process.env.NEXT_PUBLIC_AI_ASSIST === '1'
  const canGenerateTalk = scopeOfWork.trim().split(/\s+/).filter(Boolean).length >= 3

  async function generateToolboxTalk() {
    setToolboxLoading(true)
    setToolboxError(null)
    setToolboxOpen(true)
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 28000)
      const res = await fetch('/api/safety/suggest-toolbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scopeOfWork,
          location,
          hazards: hazards.map((h) => h.description),
          weather: weather || undefined,
        }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: t('ptp.requestFailed', undefined, 'Request failed') }))
        setToolboxError(data.error ?? t('ptp.requestFailedStatus', { status: res.status }, 'Request failed ({status})'))
        return
      }
      const data = await res.json()
      if (data?.error) {
        setToolboxError(data.error)
      } else {
        setToolboxTopic(data.title ?? '')
        const points = Array.isArray(data.talking_points)
          ? data.talking_points.map((p: string) => `• ${p}`).join('\n')
          : ''
        const question = data.discussion_question
          ? '\n' + t('ptp.discussionPrefix', { discussionQuestion: data.discussion_question }, 'Discussion: {discussionQuestion}')
          : ''
        setToolboxNotes(points + question)
      }
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'AbortError'
          ? t('ptp.requestTimedOut', undefined, 'Request timed out — try again')
          : t('ptp.networkError', undefined, 'Network error — check your connection')
      setToolboxError(msg)
    } finally {
      setToolboxLoading(false)
    }
  }

  function buildPtpSnapshot(): PreTaskPlan {
    return {
      id: '',
      type: 'ptp',
      createdBy: '',
      createdByEmail: null,
      createdAt: new Date().toISOString(),
      location,
      projectName,
      syncStatus: 'pending',
      notionPageId: null,
      events: [],
      date,
      shift,
      scopeOfWork,
      hazards,
      ppeRequired: ppe,
      emergencyMusterPoint: musterPoint,
      nearestHospital: hospital,
      firstAidEyewashLocation: firstAid,
      weatherNotes: weather,
      windSpeed: wind,
      heatIllnessPlan: heat,
      toolboxTalkTopic: toolboxTopic,
      toolboxTalkNotes: toolboxNotes,
      crewSignatures: sigData.signatures,
      supervisorSignatureId: supervisorId,
    }
  }

  async function runAudit() {
    setAuditing(true)
    setAuditError(null)
    setAuditResult(null)
    setAcknowledgedWarnings(false)
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 55000)
      const res = await fetch('/api/safety/audit-ptp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ptp: buildPtpSnapshot() }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: t('ptp.requestFailed', undefined, 'Request failed') }))
        setAuditError(data.error ?? t('ptp.requestFailedStatus', { status: res.status }, 'Request failed ({status})'))
        return
      }
      const data = await res.json()
      if (data?.error) {
        setAuditError(data.error)
      } else {
        setAuditResult(data as AuditResult)
      }
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'AbortError'
          ? t('ptp.requestTimedOut', undefined, 'Request timed out — try again')
          : t('ptp.networkError', undefined, 'Network error — check your connection')
      setAuditError(msg)
    } finally {
      setAuditing(false)
    }
  }

  const hasBlockers = auditResult?.findings.some((f) => f.severity === 'blocker') ?? false
  const hasWarnings = auditResult?.findings.some((f) => f.severity === 'warning') ?? false
  const auditBlocksSubmit = hasBlockers || (hasWarnings && !acknowledgedWarnings)

  const submitGuard = useRef(false)
  function handleSubmit() {
    if (!canSubmit || submitGuard.current) return
    submitGuard.current = true
    setSaveError(null)
    let record: ReturnType<typeof createPreTaskPlan>
    try {
      record = createPreTaskPlan({
        date,
        validUntil: validUntil || undefined,
        shift,
        projectName,
        location,
        scopeOfWork,
        hazards,
        ppeRequired: ppe,
        emergencyMusterPoint: musterPoint,
        nearestHospital: hospital,
        firstAidEyewashLocation: firstAid,
        weatherNotes: weather,
        windSpeed: wind,
        heatIllnessPlan: heat,
        toolboxTalkTopic: toolboxTopic,
        toolboxTalkNotes: toolboxNotes,
        crewSignatures: sigData.signatures,
        supervisorSignatureId: supervisorId,
      })
    } catch (e) {
      submitGuard.current = false
      setSaveError(e instanceof Error ? e.message : t('ptp.saveFailedStorage', undefined, 'Failed to save record — device storage may be full.'))
      return
    }

    // Persist signature images to IndexedDB, then attempt sync (both fire-and-forget).
    const blobs = Object.entries(sigData.blobs).map(([id, dataUrl]) => ({ id, dataUrl }))
    saveSignatures(record.id, blobs).catch((e) => console.error('signature save failed', e))
    void trySyncRecord(record.id)

    saveLastContext({ projectName, location, shift })
    clearDraft()
    setWasOffline(!navigator.onLine)
    setSubmittedId(record.id)
    setStep('done')
  }

  function resetNew() {
    clearDraft()
    setWasOffline(false)
    setStep('plan')
    setScopeOfWork('')
    setHazards([])
    setPpe([])
    setSigData({ signatures: [], blobs: {} })
    setSupervisorId(null)
    setSubmittedId(null)
    setToolboxTopic('')
    setToolboxNotes('')
    setAuditResult(null)
    setAuditError(null)
    setAcknowledgedWarnings(false)
  }

  // ── DONE ──────────────────────────────────────────────────
  if (step === 'done' && submittedId) {
    return <PtpDone submittedId={submittedId} sigCount={sigData.signatures.length} wasOffline={wasOffline} onNew={resetNew} />
  }

  // ── SIGN-ON ───────────────────────────────────────────────
  if (step === 'signon') {
    return (
      <div className="animate-fadeIn space-y-4">
        <button
          type="button"
          onClick={() => setStep('plan')}
          className="inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" /> {t('ptp.backToPlan', undefined, 'Back to plan')}
        </button>

        <div id="crew-signatures" className="bg-mytra-card border border-mytra-border rounded-card p-4 shadow-card">
          <h3 className="text-sm font-semibold text-fg mb-1">{t('ptp.crewSignonHeading', undefined, 'Crew sign-on')}</h3>
          <p className="text-xs text-fg-2 mb-3">
            {t('ptp.crewSignonHelp')}
          </p>
          <CrewSignatureBlock
            value={sigData}
            onChange={setSigData}
            supervisorId={supervisorId}
            onSupervisorChange={setSupervisorId}
            supervisorLabel={t('signature.supervisor', undefined, 'Supervisor')}
          />
        </div>

        {sageEnabled && (
          <div className="space-y-3">
            {!auditResult && !auditing && (
              <button
                type="button"
                onClick={runAudit}
                disabled={auditing}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium
                           bg-mytra-purple-glow border border-mytra-purple/30 text-mytra-purple
                           hover:border-mytra-purple/60 transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-4 h-4" /> {t('ptp.auditWithSage', undefined, 'Audit with Sage')}
              </button>
            )}

            {auditing && (
              <div className="bg-mytra-card border border-mytra-purple/30 rounded-card p-4 shadow-card">
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-mytra-purple">
                  <Loader2 className="w-4 h-4 animate-spin" /> {t('ptp.sageAuditing', undefined, 'Sage is auditing your plan...')}
                </div>
              </div>
            )}

            {auditError && (
              <div className="flex items-start gap-2 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 text-xs text-danger">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{auditError}</span>
              </div>
            )}

            {auditResult && (
              <div className="bg-mytra-card border border-mytra-border rounded-card shadow-card overflow-hidden animate-fadeIn">
                {auditResult.pass && auditResult.findings.length === 0 ? (
                  <div className="flex items-center gap-2 px-4 py-3 bg-ok/10 border-b border-ok/20">
                    <ShieldCheck className="w-5 h-5 text-ok" />
                    <span className="text-sm font-medium text-ok">{t('ptp.sagePlanComplete', undefined, 'Sage: Plan looks complete')}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-mytra-border">
                      <Sparkles className="w-4 h-4 text-mytra-purple" />
                      <span className="text-sm font-medium text-fg">{t('ptp.sageAuditHeading', undefined, 'Sage audit')}</span>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ml-auto ${
                        auditResult.overallRisk === 'critical' ? 'bg-danger/10 text-danger'
                        : auditResult.overallRisk === 'high' ? 'bg-danger/10 text-danger'
                        : auditResult.overallRisk === 'medium' ? 'bg-warn/10 text-warn'
                        : 'bg-ok/10 text-ok'
                      }`}>
                        {t('ptp.riskBadge', { risk: t(`hazard.risk.${auditResult.overallRisk}`) }, '{risk} risk')}
                      </span>
                    </div>
                    <div className="p-3 space-y-2">
                      {auditResult.findings.map((f, i) => (
                        <div
                          key={i}
                          className={`rounded-lg p-3 border ${
                            f.severity === 'blocker'
                              ? 'bg-danger/5 border-danger/20'
                              : 'bg-warn/5 border-warn/20'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {f.severity === 'blocker' ? (
                              <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                                  f.severity === 'blocker'
                                    ? 'bg-danger/10 text-danger'
                                    : 'bg-warn/10 text-warn'
                                }`}>
                                  {f.severity === 'blocker' ? t('ptp.severityBlocker', undefined, 'Blocker') : t('ptp.severityWarning', undefined, 'Warning')}
                                </span>
                                <span className="text-xs text-fg-3">{f.category}</span>
                              </div>
                              <p className="text-sm text-fg">{f.finding}</p>
                              <p className="text-xs text-fg-2 mt-1">{f.suggestion}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-fg-4 mt-2">
                      {t('ptp.aiAdvisory', undefined, 'AI findings are advisory and not a substitute for a competent safety assessment.')}
                    </p>
                    {hasBlockers && (
                      <div className="px-4 pb-3">
                        <p className="text-xs text-danger">{t('ptp.resolveBlockersNote', undefined, 'Resolve blockers before submitting.')}</p>
                      </div>
                    )}
                    {!hasBlockers && hasWarnings && !acknowledgedWarnings && (
                      <div className="px-4 pb-3">
                        <button
                          type="button"
                          onClick={() => setAcknowledgedWarnings(true)}
                          className="w-full py-2 rounded-lg text-xs font-medium bg-warn/10 border border-warn/20 text-warn hover:bg-warn/20 transition-colors"
                        >
                          {t('ptp.acknowledgeWarnings', undefined, 'Acknowledge warnings and proceed')}
                        </button>
                      </div>
                    )}
                  </>
                )}
                <div className="px-4 pb-3 pt-1">
                  <button
                    type="button"
                    onClick={() => { setAuditResult(null); setAcknowledgedWarnings(false) }}
                    className="text-xs text-fg-4 hover:text-fg-2 transition-colors"
                  >
                    {t('ptp.reAudit', undefined, 'Re-audit')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {saveError && (
          <div className="flex items-start gap-2 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 text-xs text-danger">
            <span className="font-semibold shrink-0">{t('common.saveFailed', undefined, 'Save failed:')}</span>
            <span>{saveError}</span>
          </div>
        )}
        <div className="sticky bottom-0 pb-4 pt-2 bg-gradient-to-t from-mytra-bg via-mytra-bg to-transparent space-y-3">
          <ValidationSummary
            errors={signonErrors}
            show={showSignonValidation}
            onDismiss={() => setShowSignonValidation(false)}
          />
          <button
            type="button"
            onClick={() => {
              if (!canSubmit) { setShowSignonValidation(true); return }
              handleSubmit()
            }}
            disabled={canSubmit && sageEnabled && auditResult !== null && auditBlocksSubmit}
            className={`${btnPrimaryCls} w-full py-3 text-sm font-semibold`}
          >
            {sigData.signatures.length === 0
              ? t('ptp.submitMustSign', undefined, 'At least one crew member must sign')
              : supervisorId === null
                ? t('ptp.submitDesignateSupervisor', undefined, 'Designate the supervisor')
                : hasBlockers
                  ? t('ptp.submitResolveBlockers', undefined, 'Resolve blockers to submit')
                  : t('ptp.submitPtp', undefined, 'Submit Pre-Task Plan')}
          </button>
        </div>
      </div>
    )
  }

  // ── PLAN ──────────────────────────────────────────────────
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
      {activePtp && (
        <Link
          href={`/safety/record/${activePtp.id}`}
          className="flex items-center gap-3 bg-ok/10 border border-ok/20 rounded-lg px-4 py-3 min-h-[44px] hover:bg-ok/15 transition-colors animate-fadeIn"
        >
          <CheckCircle2 className="w-5 h-5 text-ok shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ok font-medium">{activePtp.validUntil ? t('ptp.activePtpThrough', { validUntil: activePtp.validUntil }, 'Active PTP through {validUntil}') : t('ptp.activePtp', undefined, 'Active PTP')}</p>
            <p className="text-xs text-ok/80 mt-0.5 truncate">{activePtp.scopeOfWork || t('ptp.viewCurrentPlan', undefined, 'View current plan')}</p>
          </div>
        </Link>
      )}
      {!hasDraft && prevPtp && !carryForwardDismissed && (
        <div className="flex items-center justify-between gap-2 bg-ok/10 border border-ok/20 rounded-lg px-4 py-2.5 animate-fadeIn">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ok font-medium flex items-center gap-1.5">
              <Copy className="w-4 h-4 shrink-0" />
              {t('ptp.carryForwardFrom', { date: prevPtp.date }, 'Carry forward from {date}')}
            </p>
            <p className="text-xs text-ok/80 mt-0.5 truncate">
              {t('ptp.carryForwardSummary', { count: prevPtp.hazards.length })}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={applyCarryForward} className="text-xs font-medium text-ok bg-ok/15 hover:bg-ok/25 rounded-lg px-3 min-h-[44px] inline-flex items-center transition-colors">
              {t('common.apply', undefined, 'Apply')}
            </button>
            <button type="button" onClick={() => setCarryForwardDismissed(true)} className="text-xs text-fg-3 hover:text-fg-2 min-h-[44px] px-2 inline-flex items-center">
              {t('common.skip', undefined, 'Skip')}
            </button>
          </div>
        </div>
      )}
      <div className="bg-mytra-card border border-mytra-border rounded-card p-4 space-y-4 shadow-card">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-mytra-purple" />
          <h3 className="text-sm font-semibold text-fg">{t('ptp.title', undefined, 'Pre-Task / Pre-Build Plan')}</h3>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="ptp-date" className={labelCls}>{t('ptp.dateLabel', undefined, 'Date')}</label>
            <input id="ptp-date" type="date" value={date} onChange={(e) => { setDate(e.target.value); if (validUntil && e.target.value > validUntil) setValidUntil('') }} className={inputCls} />
          </div>
          <div>
            <label htmlFor="ptp-valid-until" className={labelCls}>{t('ptp.validThroughLabel', undefined, 'Valid through')}</label>
            <input id="ptp-valid-until" type="date" value={validUntil} min={date} max={date ? (() => { const d = new Date(date + 'T00:00:00'); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10) })() : undefined} onChange={(e) => setValidUntil(e.target.value)} className={inputCls} placeholder={t('common.sameDay', undefined, 'Same day')} />
          </div>
          <div>
            <label className={labelCls}>{t('ptp.shiftLabel', undefined, 'Shift')}</label>
            <div className="flex gap-1.5" role="radiogroup" aria-label={t('ptp.shiftAria', undefined, 'Shift')}>
              {SHIFTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={shift === s}
                  onClick={() => setShift(s)}
                  className={`flex-1 text-xs font-medium py-2.5 rounded-lg transition-colors min-h-[44px] inline-flex items-center justify-center ${
                    shift === s
                      ? `${btnSelectedCls}`
                      : 'bg-mytra-bg border border-mytra-border text-fg-2 hover:text-fg'
                  }`}
                >
                  {t(SHIFT_KEYS[s], undefined, s)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="ptp-project" className={labelCls}>{t('ptp.projectLabel', undefined, 'Project / Structure')}</label>
          <input id="ptp-project" type="text" maxLength={200} value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder={t('ptp.projectPlaceholder', undefined, 'e.g. Tower B steel erection')} className={inputCls} />
          {lastCtx.projectName && <LastUsedChip label={t('ptp.lastUsedLabel', undefined, 'Last')} value={lastCtx.projectName} currentValue={projectName} onApply={setProjectName} />}
        </div>
        <div>
          <label htmlFor="ptp-location" className={labelCls}>{t('ptp.locationLabel', undefined, 'Location / Area')}</label>
          <input id="ptp-location" type="text" maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('ptp.locationPlaceholder', undefined, 'e.g. Level 3, grid C4')} className={inputCls} />
          {lastCtx.location && <LastUsedChip label={t('ptp.lastUsedLabel', undefined, 'Last')} value={lastCtx.location} currentValue={location} onApply={setLocation} />}
        </div>
        <div data-tour-module="scope-of-work">
          <label htmlFor="ptp-scope" className={labelCls}>{t('ptp.scopeLabel', undefined, 'Scope of work today')}</label>
          <textarea id="ptp-scope" rows={2} maxLength={2000} value={scopeOfWork} onChange={(e) => setScopeOfWork(e.target.value)} placeholder={t('ptp.scopePlaceholder', undefined, 'What is the team working on today?')} className={textareaCls} />
        </div>
      </div>

      {/* Hazards (Sage sits above the table, dormant by default) */}
      <section data-tour-module="hazard-table" className="space-y-2">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold px-1">{t('ptp.hazardsControlsHeading', undefined, 'Hazards & Controls')}</h4>
        <SageAssist
          scopeOfWork={scopeOfWork}
          location={location}
          existingHazards={hazards}
          onAddHazards={(h) => setHazards((prev) => [...prev, ...h])}
          onAddPpe={(ids) => setPpe((prev) => Array.from(new Set([...prev, ...ids])))}
        />
        <HazardTable hazards={hazards} onChange={setHazards} />
      </section>

      {/* PPE */}
      <section data-tour-module="ppe-selector" className="space-y-2">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold px-1">{t('ptp.ppeRequiredHeading', undefined, 'PPE Required')}</h4>
        <PPESelector selected={ppe} onChange={setPpe} />
      </section>

      {/* Site conditions */}
      <section className="bg-mytra-card border border-mytra-border rounded-card p-4 space-y-3 shadow-card">
        <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">{t('ptp.siteConditionsHeading', undefined, 'Site Conditions & Emergency')}</h4>
        <div>
          <label htmlFor="ptp-muster" className={labelCls}>{t('ptp.musterPointLabel', undefined, 'Emergency muster point')} <span className="text-danger">*</span></label>
          <input id="ptp-muster" type="text" maxLength={200} value={musterPoint} onChange={(e) => setMusterPoint(e.target.value)} placeholder={t('common.required', undefined, 'Required')} className={`${inputCls} ${!musterPoint.trim() ? 'border-warn/60' : ''}`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ptp-hospital" className={labelCls}>{t('ptp.nearestHospitalLabel', undefined, 'Nearest hospital')}</label>
            <input id="ptp-hospital" type="text" maxLength={200} value={hospital} onChange={(e) => setHospital(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="ptp-firstaid" className={labelCls}>{t('ptp.firstAidLabel', undefined, 'First aid / eyewash')}</label>
            <input id="ptp-firstaid" type="text" maxLength={200} value={firstAid} onChange={(e) => setFirstAid(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ptp-weather" className={labelCls}>{t('ptp.weatherLabel', undefined, 'Weather')}</label>
            <input id="ptp-weather" type="text" maxLength={100} value={weather} onChange={(e) => setWeather(e.target.value)} placeholder={t('ptp.weatherPlaceholder', undefined, 'Conditions')} className={inputCls} />
          </div>
          <div>
            <label htmlFor="ptp-wind" className={labelCls}>{t('ptp.windSpeedLabel', undefined, 'Wind speed')}</label>
            <input id="ptp-wind" type="text" inputMode="decimal" maxLength={50} value={wind} onChange={(e) => setWind(e.target.value)} placeholder={t('ptp.windSpeedPlaceholder', undefined, 'For MEWP / height')} className={inputCls} />
          </div>
        </div>
      </section>

      {/* Heat illness (T8 §3395) — collapsible for indoor work */}
      <section className="bg-mytra-card border border-mytra-border rounded-card shadow-card overflow-hidden">
        <button
          type="button"
          onClick={() => setHeatOpen((v) => !v)}
          aria-expanded={heatOpen}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-mytra-card-hover transition-colors min-h-[44px]"
        >
          <div>
            <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">
              {t('ptp.heatHeading', undefined, 'Heat Illness Prevention')}
            </h4>
            {!heatOpen && <p className="text-xs text-fg-4 mt-0.5">{t('ptp.heatCollapsedHint', undefined, 'Outdoor / high-temp work — tap to expand')}</p>}
          </div>
          {heatOpen ? <ChevronUp className="w-4 h-4 text-fg-4 shrink-0" /> : <ChevronDown className="w-4 h-4 text-fg-4 shrink-0" />}
        </button>
        {heatOpen && (
          <div className="px-4 pb-4 animate-fadeIn">
            <div className="grid grid-cols-2 gap-2">
              {([
                ['water', t('ptp.heatWater', undefined, 'Water available')],
                ['shade', t('ptp.heatShade', undefined, 'Shade available')],
                ['restBreaks', t('ptp.heatRestBreaks', undefined, 'Rest breaks')],
                ['highHeatProcedures', t('ptp.heatHighHeatProcedures', undefined, 'High-heat procedures (≥95°F)')],
              ] as [keyof HeatIllnessPlan, string][]).map(([key, lbl]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-fg-2 min-h-[44px] cursor-pointer">
                  <input type="checkbox" checked={heat[key]} onChange={() => toggleHeat(key)} className="accent-mytra-purple w-5 h-5" />
                  {lbl}
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Toolbox talk — collapsible for solo work */}
      <section className="bg-mytra-card border border-mytra-border rounded-card shadow-card overflow-hidden">
        <button
          type="button"
          onClick={() => setToolboxOpen((v) => !v)}
          aria-expanded={toolboxOpen}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-mytra-card-hover transition-colors min-h-[44px]"
        >
          <div>
            <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">{t('ptp.toolboxHeading', undefined, 'Toolbox Talk')}</h4>
            {!toolboxOpen && <p className="text-xs text-fg-4 mt-0.5">{t('ptp.toolboxCollapsedHint', undefined, 'Optional — tap to add a safety topic')}</p>}
          </div>
          {toolboxOpen ? <ChevronUp className="w-4 h-4 text-fg-4 shrink-0" /> : <ChevronDown className="w-4 h-4 text-fg-4 shrink-0" />}
        </button>
        {toolboxOpen && (
          <div className="px-4 pb-4 space-y-3 animate-fadeIn">
            <div>
              <label htmlFor="ptp-tbt-topic" className={labelCls}>{t('ptp.toolboxTopicLabel', undefined, 'Topic')}</label>
              <input id="ptp-tbt-topic" type="text" maxLength={200} value={toolboxTopic} onChange={(e) => setToolboxTopic(e.target.value)} placeholder={t('ptp.toolboxTopicPlaceholder', undefined, "Today's safety topic")} className={inputCls} />
            </div>
            {sageEnabled && (
              <div>
                <button
                  type="button"
                  onClick={generateToolboxTalk}
                  disabled={!canGenerateTalk || toolboxLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium
                             bg-mytra-purple-glow border border-mytra-purple/30 text-mytra-purple
                             hover:border-mytra-purple/60 transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {toolboxLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> {t('ptp.sageThinking', undefined, 'Sage is thinking…')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> {t('ptp.generateToolboxTalk', undefined, 'Generate toolbox talk')}
                    </>
                  )}
                </button>
                {!canGenerateTalk && !toolboxLoading && (
                  <p className="text-xs text-fg-4 mt-1 text-center">{t('ptp.addScopeFirst', undefined, 'Add a scope of work first')}</p>
                )}
                {toolboxError && (
                  <p className="text-xs text-danger mt-1 text-center">{toolboxError}</p>
                )}
              </div>
            )}
            <div>
              <label htmlFor="ptp-tbt-notes" className={labelCls}>{t('ptp.toolboxDiscussionLabel', undefined, 'Discussion points')}</label>
              <textarea id="ptp-tbt-notes" rows={2} maxLength={2000} value={toolboxNotes} onChange={(e) => setToolboxNotes(e.target.value)} className={textareaCls} />
            </div>
          </div>
        )}
      </section>

      <div data-tour-module="crew-signon" className="sticky bottom-0 pb-4 pt-4 bg-gradient-to-t from-mytra-bg from-60% to-transparent space-y-3">
        <ValidationSummary
          errors={planErrors}
          show={showValidation}
          onDismiss={() => setShowValidation(false)}
        />
        <button
          type="button"
          onClick={() => {
            if (!canContinue) { setShowValidation(true); return }
            setStep('signon')
          }}
          className={`${btnPrimaryCls} w-full py-3 text-sm font-semibold`}
        >
          {canContinue ? t('ptp.continueToSignon', undefined, 'Continue to crew sign-on') : t('ptp.completeRequiredFields', undefined, 'Complete scope, location & muster point')}
        </button>
      </div>
    </div>
  )
}

function PtpDone({ submittedId, sigCount, wasOffline, onNew }: { submittedId: string; sigCount: number; wasOffline: boolean; onNew: () => void }) {
  const t = useT()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const ehsEnabled = isReviewEnabled()
  const [reviewState, setReviewState] = useState<ReviewSubmitState | null>(null)

  useEffect(() => { headingRef.current?.focus(); haptic('success') }, [])

  useEffect(() => {
    if (!ehsEnabled) return
    setReviewState('pending')
    void submitForReview(submittedId).then(setReviewState)
  }, [ehsEnabled, submittedId])

  const retryReview = () => {
    setReviewState('pending')
    void submitForReview(submittedId).then(setReviewState)
  }

  return (
    <div className="animate-fadeIn space-y-4">
      <div className="bg-ok/10 border border-ok/20 rounded-lg p-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-ok mx-auto mb-3" />
        <h3 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-ok mb-1 outline-none">{t('ptp.doneTitle', undefined, 'PTP Logged')}</h3>
        <p className="text-sm text-ok">
          {t('ptp.doneSigned', { count: sigCount })} {t('ptp.recordedAs', undefined, 'Recorded as')}{' '}
          <span className="font-mono text-fg">{submittedId}</span>.
        </p>
      </div>
      {wasOffline && (
        <div className="flex items-center gap-2 bg-warn/10 border border-warn/20 rounded-lg px-4 py-2.5">
          <WifiOff className="w-4 h-4 text-warn shrink-0" />
          <p className="text-xs text-warn">{t('common.savedLocally', undefined, 'Saved locally. Will sync automatically when connection returns.')}</p>
        </div>
      )}
      {reviewState === 'pending' && (
        <div className="flex items-center gap-2 bg-mytra-purple-glow border border-mytra-purple/20 rounded-lg px-4 py-2.5" role="status">
          <Loader2 className="w-4 h-4 text-mytra-purple shrink-0 animate-spin" />
          <p className="text-xs text-mytra-purple">{t('forms.submittingReview', undefined, 'Submitting for EHS review…')}</p>
        </div>
      )}
      {reviewState === 'submitted' && (
        <div className="flex items-center gap-2 bg-mytra-purple-glow border border-mytra-purple/20 rounded-lg px-4 py-2.5">
          <Send className="w-4 h-4 text-mytra-purple shrink-0" />
          <p className="text-xs text-mytra-purple">{t('forms.submittedReview', undefined, 'Submitted for EHS review')}</p>
        </div>
      )}
      {reviewState === 'failed' && (
        <div className="flex items-center gap-2 bg-warn/10 border border-warn/20 rounded-lg px-4 py-2.5" role="alert">
          <AlertTriangle className="w-4 h-4 text-warn shrink-0" />
          <p className="text-sm text-warn-strong flex-1">
            {t('ptp.reviewFailedPtp')}
          </p>
          <button
            type="button"
            onClick={retryReview}
            className="shrink-0 min-h-[44px] px-3 rounded-lg text-sm font-semibold text-mytra-purple hover:bg-mytra-purple/10 transition-colors"
          >
            {t('common.retry', undefined, 'Retry')}
          </button>
        </div>
      )}
      <Link
        href={`/safety/record/${submittedId}`}
        className={`${btnPrimaryCls} block w-full text-center py-3 text-sm font-semibold`}
      >
        {t('forms.viewPrint', undefined, 'View / Print')}
      </Link>
      <button
        type="button"
        onClick={onNew}
        className="w-full py-3 rounded-lg text-sm font-semibold bg-mytra-card border border-mytra-border text-fg hover:bg-mytra-card-hover transition-colors"
      >
        {t('ptp.startNewPtp', undefined, 'Start new PTP')}
      </button>
      <Link href="/safety" className="block text-center text-sm text-fg-2 hover:text-fg">
        {t('common.backHome', undefined, 'Back to Home')}
      </Link>
    </div>
  )
}
