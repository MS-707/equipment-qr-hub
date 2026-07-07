'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer, RefreshCw, XCircle, Ban, Share2, Check, Copy, Loader2 } from 'lucide-react'
import type {
  SafetyRecord,
  PreTaskPlan,
  JobHazardAnalysis,
  AnyPermit,
  HeightPermit,
  HotWorkPermit,
  ConfinedSpacePermit,
  IncidentReport,
  CrewSignature,
} from '@/lib/safety-types'
import {
  SAFETY_TYPE_LABELS,
  RISK_COLORS,
  RISK_LABELS,
  isPTP,
  isJHA,
  isPermit,
  isIncident,
  INCIDENT_SEVERITY_COLORS,
} from '@/lib/safety-types'
import {
  getSafetyRecordById,
  getBlobs,
  onSafetyChange,
  closePermit,
  revokePermit,
  permitDisplayStatus,
} from '@/lib/safety-records'
import { trySyncRecord, isSyncAvailable } from '@/lib/safety-sync'
import { shareRecord } from '@/lib/record-share'
import { getCurrentIdentity } from '@/lib/identity'
import { ppeLabel } from '@/data/safety-checklists'
import PermitStatusBadge from './PermitStatusBadge'
import ReviewStatusBadge from './ReviewStatusBadge'
import ReviewStatusSection from './ReviewStatusSection'
import ConfirmDialog from '@/components/ConfirmDialog'
import { RecordViewSkeleton } from '@/components/Skeleton'
import { useReviewPoller } from '@/lib/review-poll'

/** True if a saved form draft at this key holds any user-entered content. */
function draftHasContent(draftKey: string): boolean {
  try {
    const raw = localStorage.getItem(draftKey)
    if (!raw) return false
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return Object.values(parsed).some(
      (v) =>
        (typeof v === 'string' && v.trim() !== '') ||
        (Array.isArray(v) && v.length > 0) ||
        (typeof v === 'boolean' && v) ||
        (typeof v === 'number' && v !== 0)
    )
  } catch {
    return false
  }
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function RecordView({ id }: { id: string }) {
  const router = useRouter()
  const [record, setRecord] = useState<SafetyRecord | null | undefined>(undefined)
  const [sigImages, setSigImages] = useState<Record<string, string>>({})
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [shared, setShared] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [pendingReissue, setPendingReissue] = useState<{ draftKey: string; formPath: string; draft: Record<string, unknown> } | null>(null)

  useReviewPoller()

  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    )
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('print') === '1' && !isStandalone) {
      const timer = setTimeout(() => window.print(), 500)
      return () => clearTimeout(timer)
    }
  }, [isStandalone])

  const load = useCallback(() => {
    const r = getSafetyRecordById(id)
    setRecord(r ?? null)
    return r
  }, [id])

  useEffect(() => {
    const r = load()
    const unsub = onSafetyChange(load)
    if (r) {
      // Collect signature slot ids across record shapes.
      const slots: string[] = []
      if (isPTP(r)) r.crewSignatures.forEach((s) => slots.push(s.id))
      if (isPermit(r)) {
        const p = r as AnyPermit
        if ('workers' in p) p.workers.forEach((s) => slots.push(s.id))
        if ('entrants' in p) (p as { entrants?: CrewSignature[] }).entrants?.forEach((s) => slots.push(s.id))
      }
      if (isIncident(r)) {
        r.photoSlots.forEach((slot) => slots.push(slot))
        if (r.reporterSignatureId) slots.push(r.reporterSignatureId)
      }
      if (slots.length > 0) getBlobs(r.id, slots).then(setSigImages).catch(() => {})
    }
    return unsub
  }, [id, load])

  if (record === undefined) return <RecordViewSkeleton />
  if (record === null)
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <p className="text-sm text-fg-2">Record not found.</p>
        <Link href="/safety/history" className="text-sm text-mytra-purple hover:underline">Back to history</Link>
      </div>
    )

  const r = record
  const identity = getCurrentIdentity()

  function handleClose(note?: string) {
    closePermit(r.id, { name: identity?.name ?? 'Unknown', email: identity?.email ?? null }, note ?? '')
    setCloseOpen(false)
  }
  function handleRevoke(note?: string) {
    revokePermit(r.id, { name: identity?.name ?? 'Unknown', email: identity?.email ?? null }, note ?? '')
    setRevokeOpen(false)
  }
  async function handleShare() {
    setSharing(true)
    try {
      const outcome = await shareRecord(r)
      if (outcome === 'shared' || outcome === 'mailto') {
        setShared(true)
        setTimeout(() => setShared(false), 2500)
      }
    } finally {
      setSharing(false)
    }
  }

  const permitStatus = isPermit(r) ? permitDisplayStatus(r as AnyPermit) : null
  const permitOpen = isPermit(r) && permitStatus !== 'closed' && permitStatus !== 'revoked'
  const permitClosed = isPermit(r) && !permitOpen

  function handleReissue() {
    if (!isPermit(r)) return
    const p = r as AnyPermit
    const draftKey =
      p.type === 'height-permit' ? 'draft:height-permit'
        : p.type === 'hot-work-permit' ? 'draft:hot-work-permit'
          : 'draft:confined-space-permit'
    const formPath =
      p.type === 'height-permit' ? '/safety/permits/height'
        : p.type === 'hot-work-permit' ? '/safety/permits/hot-work'
          : '/safety/permits/confined-space'
    // Carry the permit's identity and reusable configuration, but NOT
    // time-specific observations (gas readings) or named people on station
    // (attendant / fire watch) — those must be re-confirmed for the new
    // permit period. The validity window and pre-issue checklist are
    // intentionally left to the form's fresh defaults.
    const draft: Record<string, unknown> = {
      projectName: p.projectName,
      location: p.location,
    }
    if ('workDescription' in p) draft.workDescription = (p as HeightPermit | HotWorkPermit).workDescription
    if (p.type === 'height-permit') {
      const hp = p as HeightPermit
      draft.workingHeight = hp.workingHeight
      draft.accessMethod = hp.accessMethod
      draft.fallProtection = hp.fallProtection
      draft.anchorPoints = hp.anchorPoints
      draft.rescuePlan = hp.rescuePlan
    }
    if (p.type === 'hot-work-permit') {
      const hw = p as HotWorkPermit
      draft.hotWorkTypes = hw.hotWorkTypes
      draft.fireWatchRequired = hw.fireWatchRequired
      draft.postDuration = hw.fireWatchPostDurationMin
      draft.extinguisherLocation = hw.extinguisherLocation
      draft.extinguisherType = hw.extinguisherType
      draft.sprinklerStatus = hw.sprinklerStatus
      draft.gasTestRequired = hw.gasTestRequired
    }
    if (p.type === 'confined-space-permit') {
      const cs = p as ConfinedSpacePermit
      draft.spaceDescription = cs.spaceDescription
      draft.hazards = cs.hazards
      draft.rescuePlan = cs.rescuePlan
    }
    // Don't silently clobber a permit the user already has in progress.
    if (draftHasContent(draftKey)) {
      setPendingReissue({ draftKey, formPath, draft })
      return
    }
    writeDraftAndGo(draftKey, draft, formPath)
  }

  function writeDraftAndGo(draftKey: string, draft: Record<string, unknown>, formPath: string) {
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft))
    } catch {}
    router.push(formPath)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="no-print flex items-center justify-between">
        <Link href="/safety/history" aria-label="Back to safety history" className="inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> History
        </Link>
        <div className="flex items-center gap-3">
          {r.syncStatus !== 'synced' && (
            <button
              type="button"
              disabled={syncing}
              aria-busy={syncing}
              onClick={async () => {
                setSyncing(true)
                try { await trySyncRecord(r.id) } finally { setSyncing(false) }
              }}
              className="inline-flex items-center gap-1.5 text-sm text-fg-2 bg-mytra-card border border-mytra-border rounded-lg px-3 py-2 min-h-[44px] hover:bg-mytra-card-hover disabled:opacity-50"
            >
              {syncing
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing…</>
                : <><RefreshCw className="w-3.5 h-3.5" /> Retry sync</>}
            </button>
          )}
          <button
            type="button"
            disabled={sharing}
            aria-busy={sharing}
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 text-sm text-fg-2 bg-mytra-card border border-mytra-border rounded-lg px-3 py-2 min-h-[44px] hover:bg-mytra-card-hover disabled:opacity-50"
          >
            {sharing
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sharing…</>
              : shared
                ? <><Check className="w-3.5 h-3.5 text-ok" /> Shared</>
                : <><Share2 className="w-3.5 h-3.5" /> Share</>}
          </button>
          <button
            type="button"
            onClick={() => {
              if (isStandalone) {
                const w = window.open(`${window.location.pathname}?print=1`, '_blank')
                if (!w) window.print()
              } else {
                window.print()
              }
            }}
            className="inline-flex items-center gap-1.5 text-sm text-fg-2 bg-mytra-card border border-mytra-border rounded-lg px-3 py-2 min-h-[44px] hover:bg-mytra-card-hover"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
        </div>
      </div>

      {/* Print-only formal document header (matches the paper template) */}
      <div className="print-only print-doc-header">
        <div className="print-doc-title">
          <span>{SAFETY_TYPE_LABELS[r.type]}</span>
          <span style={{ fontSize: '10pt' }}>{r.id}</span>
        </div>
        <dl className="print-doc-meta">
          <div><dt>Project / Build</dt><dd>{r.projectName || '—'}</dd></div>
          <div><dt>Location / Area</dt><dd>{r.location || '—'}</dd></div>
          {isPTP(r) && <div><dt>Date</dt><dd>{r.date} · {r.shift} shift</dd></div>}
          <div><dt>Prepared by</dt><dd>{r.createdBy}</dd></div>
          <div><dt>Created</dt><dd>{fmt(r.createdAt)}</dd></div>
          {r.reviewStatus && <div><dt>EHS review</dt><dd>{r.reviewStatus}</dd></div>}
        </dl>
      </div>

      {/* Header — screen only; print uses the formal header above */}
      <div className="no-print bg-mytra-card border border-mytra-border rounded-card p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-mono text-fg-3 tabular-nums">{r.id}</span>
          <div className="flex items-center gap-1.5">
            {isPermit(r) && <PermitStatusBadge permit={r as AnyPermit} />}
            <ReviewStatusBadge record={r} />
          </div>
        </div>
        <h1 className="text-lg font-semibold text-fg mt-1">{SAFETY_TYPE_LABELS[r.type]}</h1>
        <dl className="grid grid-cols-2 gap-2 mt-3 text-sm">
          <Field label="Project" value={r.projectName} />
          <Field label="Location" value={r.location} />
          <Field label="Created by" value={r.createdBy} />
          <Field label="Created" value={fmt(r.createdAt)} />
          <Field label="Sync" value={r.syncStatus} />
          {r.notionPageId && <Field label="Notion" value="synced" />}
        </dl>
      </div>

      {/* Type-specific body */}
      {isPTP(r) && <PtpBody ptp={r} sigImages={sigImages} />}
      {isJHA(r) && <JhaBody jha={r} />}
      {isPermit(r) && <PermitBody permit={r as AnyPermit} sigImages={sigImages} />}
      {isIncident(r) && <IncidentBody incident={r} images={sigImages} />}

      {/* EHS Review */}
      <ReviewStatusSection record={r} />

      {/* Permit actions */}
      {isPermit(r) && permitOpen && (
        <div className="no-print flex gap-2">
          <button
            type="button"
            onClick={() => setCloseOpen(true)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold bg-mytra-card border border-mytra-border text-fg hover:bg-mytra-card-hover"
          >
            <XCircle className="w-4 h-4" /> Close permit
          </button>
          <button
            type="button"
            onClick={() => setRevokeOpen(true)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20"
          >
            <Ban className="w-4 h-4" /> Revoke
          </button>
        </div>
      )}
      {permitClosed && (
        <button
          type="button"
          onClick={handleReissue}
          className="no-print w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold bg-mytra-purple/10 border border-mytra-purple/30 text-mytra-purple hover:bg-mytra-purple/20 transition-colors"
        >
          <Copy className="w-4 h-4" /> Reissue as new permit
        </button>
      )}
      <ConfirmDialog
        open={closeOpen}
        title="Close Permit"
        message="Mark this permit as closed. The date and time will be recorded."
        confirmLabel="Close permit"
        inputPrompt="Closing note (optional)"
        onConfirm={handleClose}
        onCancel={() => setCloseOpen(false)}
      />
      <ConfirmDialog
        open={revokeOpen}
        title="Revoke Permit"
        message="This action is recorded with a timestamp and cannot be undone."
        confirmLabel="Revoke"
        variant="danger"
        inputPrompt="Reason for revoking this permit"
        onConfirm={handleRevoke}
        onCancel={() => setRevokeOpen(false)}
      />
      <ConfirmDialog
        open={pendingReissue !== null}
        title="Replace draft in progress?"
        message="You have an unsaved permit of this type in progress. Reissuing will replace it with a copy of this permit."
        confirmLabel="Replace & reissue"
        variant="danger"
        onConfirm={() => {
          if (pendingReissue) writeDraftAndGo(pendingReissue.draftKey, pendingReissue.draft, pendingReissue.formPath)
          setPendingReissue(null)
        }}
        onCancel={() => setPendingReissue(null)}
      />

      {/* Print-only authorization block (matches template Section 5/7) */}
      <div className="print-only">
        <p style={{ fontSize: '8.5pt', marginBottom: '4px' }}>
          By signing, each party confirms they have reviewed this record, understand the identified
          hazards and controls, and agree the work may proceed under the conditions described.
        </p>
        <div className="print-sig-row">
          <div className="print-sig-line">{isPTP(r) ? 'Build Lead' : 'Prepared By'} — Printed Name &amp; Signature</div>
          <div className="print-sig-line">Title / Role</div>
          <div className="print-sig-line">Date</div>
        </div>
        <div className="print-sig-row">
          <div className="print-sig-line">Mytra Representative / EHS — Printed Name &amp; Signature</div>
          <div className="print-sig-line">Title / Role</div>
          <div className="print-sig-line">Date</div>
        </div>
      </div>

      {/* History */}
      <section className="no-print bg-mytra-card border border-mytra-border rounded-card p-4 shadow-card">
        <h2 className="text-xs uppercase tracking-wider text-fg-3 font-semibold mb-2">History</h2>
        <ul className="space-y-1.5">
          {r.events.filter((e) => isSyncAvailable() || e.action !== 'sync-failed').map((e, i) => (
            <li key={i} className="text-xs text-fg-2 flex items-start gap-2">
              <span className="text-mytra-purple font-medium uppercase shrink-0">{e.action}</span>
              <span>
                {e.by} · {fmt(e.at)}
                {e.note ? ` — ${e.note}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-fg-3">{label}</dt>
      <dd className="text-sm text-fg break-words">{value || '—'}</dd>
    </div>
  )
}

function SignatureGrid({ sigs, images }: { sigs: CrewSignature[]; images: Record<string, string> }) {
  if (sigs.length === 0) return <p className="text-xs text-fg-4">No signatures.</p>
  return (
    <div className="grid grid-cols-2 gap-2">
      {sigs.map((s) => (
        <div key={s.id} className="bg-mytra-input border border-mytra-border rounded-lg p-2">
          {images[s.id] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images[s.id]} alt={`${s.name} signature`} className="w-full h-12 object-contain" />
          ) : (
            <div className="h-12 flex items-center justify-center text-xs text-fg-4">signature on device</div>
          )}
          <p className="text-xs text-fg mt-1 truncate">{s.name}</p>
          <p className="text-xs text-fg-3">{s.role ? `${s.role} · ` : ''}{new Date(s.signedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
        </div>
      ))}
    </div>
  )
}

function PtpBody({ ptp, sigImages }: { ptp: PreTaskPlan; sigImages: Record<string, string> }) {
  return (
    <>
      <Section title="Scope of work">
        <p className="text-sm text-fg-2">{ptp.scopeOfWork || '—'}</p>
        <p className="text-xs text-fg-3 mt-1">
          {ptp.date}{ptp.validUntil && ptp.validUntil !== ptp.date ? ` through ${ptp.validUntil}` : ''} · {ptp.shift} shift
        </p>
      </Section>
      {ptp.validUntil && ptp.validUntil !== ptp.date && (
        <div className="flex items-start gap-2 bg-mytra-purple/10 border border-mytra-purple/20 rounded-lg px-4 py-3">
          <p className="text-xs text-mytra-purple">
            This plan covers multiple days. Crew should verbally re-confirm hazards and controls each morning before work begins.
          </p>
        </div>
      )}

      <Section title="Hazards & controls">
        {ptp.hazards.length === 0 ? (
          <p className="text-xs text-fg-4">None recorded.</p>
        ) : (
          <ul className="space-y-2">
            {ptp.hazards.map((h) => (
              <li key={h.id} className="text-sm">
                <span className="text-fg">{h.description}</span>
                <span className="text-xs text-fg-3 ml-1">({h.riskLevel})</span>
                {h.source === 'sage' && <span className="text-xs text-mytra-purple ml-1">✨ Sage</span>}
                <p className="text-xs text-fg-2">{h.controlMeasure}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {ptp.ppeRequired.length > 0 && (
        <Section title="PPE required">
          <div className="flex flex-wrap gap-1.5">
            {ptp.ppeRequired.map((id) => (
              <span key={id} className="text-xs px-2 py-1 rounded-full bg-mytra-bg border border-mytra-border text-fg-2">
                {ppeLabel(id)}
              </span>
            ))}
          </div>
        </Section>
      )}

      {(ptp.emergencyMusterPoint || ptp.nearestHospital || ptp.firstAidEyewashLocation || ptp.weatherNotes || ptp.windSpeed) && (
        <Section title="Site conditions & emergency">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {ptp.emergencyMusterPoint && <Field label="Muster point" value={ptp.emergencyMusterPoint} />}
            {ptp.nearestHospital && <Field label="Nearest hospital" value={ptp.nearestHospital} />}
            {ptp.firstAidEyewashLocation && <Field label="First aid / eyewash" value={ptp.firstAidEyewashLocation} />}
            {ptp.weatherNotes && <Field label="Weather" value={ptp.weatherNotes} />}
            {ptp.windSpeed && <Field label="Wind speed" value={ptp.windSpeed} />}
          </dl>
        </Section>
      )}

      {Object.values(ptp.heatIllnessPlan).some(Boolean) && (
        <Section title="Heat illness prevention">
          <div className="flex flex-wrap gap-2">
            {ptp.heatIllnessPlan.water && <span className="text-xs px-2 py-1 rounded-full bg-ok/10 border border-ok/20 text-ok">Water available</span>}
            {ptp.heatIllnessPlan.shade && <span className="text-xs px-2 py-1 rounded-full bg-ok/10 border border-ok/20 text-ok">Shade available</span>}
            {ptp.heatIllnessPlan.restBreaks && <span className="text-xs px-2 py-1 rounded-full bg-ok/10 border border-ok/20 text-ok">Rest breaks</span>}
            {ptp.heatIllnessPlan.highHeatProcedures && <span className="text-xs px-2 py-1 rounded-full bg-warn/10 border border-warn/20 text-warn">High-heat procedures</span>}
          </div>
        </Section>
      )}

      {(ptp.toolboxTalkTopic || ptp.toolboxTalkNotes) && (
        <Section title="Toolbox talk">
          <p className="text-sm text-fg">{ptp.toolboxTalkTopic}</p>
          {ptp.toolboxTalkNotes && <p className="text-xs text-fg-2 mt-0.5">{ptp.toolboxTalkNotes}</p>}
        </Section>
      )}

      <Section title={`Crew sign-on (${ptp.crewSignatures.length})`}>
        <SignatureGrid sigs={ptp.crewSignatures} images={sigImages} />
      </Section>
    </>
  )
}

function JhaBody({ jha }: { jha: JobHazardAnalysis }) {
  return (
    <>
      <Section title="Job / task">
        <p className="text-sm text-fg">{jha.jobTitle || '—'}</p>
        <dl className="grid grid-cols-2 gap-2 mt-2 text-sm">
          <Field label="Date of analysis" value={jha.validUntil && jha.validUntil !== jha.dateOfAnalysis ? `${jha.dateOfAnalysis} through ${jha.validUntil}` : jha.dateOfAnalysis} />
          {jha.department && <Field label="Department / Team" value={jha.department} />}
          {jha.referenceDoc && <Field label="Reference doc" value={jha.referenceDoc} />}
        </dl>
      </Section>
      {jha.validUntil && jha.validUntil !== jha.dateOfAnalysis && (
        <div className="flex items-start gap-2 bg-mytra-purple/10 border border-mytra-purple/20 rounded-lg px-4 py-3">
          <p className="text-xs text-mytra-purple">
            This JHA covers multiple days. Review hazards and controls daily as site conditions may change.
          </p>
        </div>
      )}

      {jha.ppeRequired.length > 0 && (
        <Section title="PPE required">
          <div className="flex flex-wrap gap-1.5">
            {jha.ppeRequired.map((id) => (
              <span key={id} className="text-xs px-2 py-1 rounded-full bg-mytra-bg border border-mytra-border text-fg-2">
                {ppeLabel(id)}
              </span>
            ))}
          </div>
        </Section>
      )}

      <Section title={`Hazard analysis (${jha.steps.length} steps)`}>
        <ol className="space-y-3">
          {jha.steps.map((s, i) => (
            <li key={s.id} className="border-l-2 border-mytra-border pl-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-fg-3">Step {i + 1}</span>
                <span
                  className="text-xs font-semibold px-1.5 py-0.5 rounded"
                  style={{ color: RISK_COLORS[s.riskLevel], backgroundColor: `color-mix(in srgb, ${RISK_COLORS[s.riskLevel]} 12%, transparent)` }}
                >
                  {RISK_LABELS[s.riskLevel]}
                </span>
                {s.residualRiskLevel && (
                  <span className="text-xs text-fg-4">→</span>
                )}
                {s.residualRiskLevel && (
                  <span
                    className="text-xs font-semibold px-1.5 py-0.5 rounded"
                    style={{ color: RISK_COLORS[s.residualRiskLevel], backgroundColor: `color-mix(in srgb, ${RISK_COLORS[s.residualRiskLevel]} 12%, transparent)` }}
                  >
                    {RISK_LABELS[s.residualRiskLevel]}
                  </span>
                )}
                {s.source === 'sage' && <span className="text-xs text-mytra-purple">✨ Sage</span>}
              </div>
              <p className="text-sm text-fg mt-1">{s.taskActivity}</p>
              {s.hazards && (
                <p className="text-xs text-fg-2 mt-1 whitespace-pre-line">
                  <span className="text-fg-3 uppercase tracking-wider">Hazards: </span>{s.hazards}
                </p>
              )}
              {s.controls && (
                <p className="text-xs text-fg-2 mt-0.5 whitespace-pre-line">
                  <span className="text-fg-3 uppercase tracking-wider">Controls: </span>{s.controls}
                </p>
              )}
              {s.responsible && (
                <p className="text-xs text-fg-3 mt-0.5">Responsible: {s.responsible}</p>
              )}
            </li>
          ))}
        </ol>
      </Section>

      {jha.additionalNotes && (
        <Section title="Special conditions / notes">
          <p className="text-sm text-fg-2 whitespace-pre-line">{jha.additionalNotes}</p>
        </Section>
      )}
    </>
  )
}

function PermitBody({ permit, sigImages }: { permit: AnyPermit; sigImages: Record<string, string> }) {
  const workers = 'workers' in permit ? permit.workers : []
  const entrants = 'entrants' in permit ? (permit as { entrants?: CrewSignature[] }).entrants ?? [] : []
  const sigs = [...workers, ...entrants]
  return (
    <>
      <Section title="Permit details">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <Field label="Valid from" value={fmt(permit.validFrom)} />
          <Field label="Valid until" value={fmt(permit.validUntil)} />
          {'workDescription' in permit && <Field label="Work" value={(permit as { workDescription: string }).workDescription} />}
        </dl>
      </Section>

      {permit.type === 'height-permit' && <HeightDetails permit={permit as HeightPermit} />}
      {permit.type === 'hot-work-permit' && <HotWorkDetails permit={permit as HotWorkPermit} />}
      {permit.type === 'confined-space-permit' && <ConfinedSpaceDetails permit={permit as ConfinedSpacePermit} />}

      <Section title="Checklist">
        <ul className="space-y-1">
          {permit.checklist.map((c) => (
            <li key={c.id} className="text-xs flex items-start gap-2">
              <span className={c.checked ? 'text-ok' : 'text-fg-4'}>{c.checked ? '✓' : '○'}</span>
              <span className={c.checked ? 'text-fg-2' : 'text-fg-3'}>
                {c.label}
                {c.notes ? ` — ${c.notes}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={`Crew sign-on (${sigs.length})`}>
        <SignatureGrid sigs={sigs} images={sigImages} />
      </Section>
    </>
  )
}

function HeightDetails({ permit }: { permit: HeightPermit }) {
  return (
    <Section title="Height work details">
      <dl className="grid grid-cols-2 gap-2 text-sm">
        {permit.workingHeight && <Field label="Working height" value={permit.workingHeight} />}
        {permit.anchorPoints && <Field label="Anchor points" value={permit.anchorPoints} />}
      </dl>
      {permit.accessMethod.length > 0 && (
        <div className="mt-2">
          <dt className="text-xs uppercase tracking-wider text-fg-3">Access method</dt>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {permit.accessMethod.map((m) => (
              <span key={m} className="text-xs px-2 py-1 rounded-full bg-mytra-bg border border-mytra-border text-fg-2">{m}</span>
            ))}
          </div>
        </div>
      )}
      {permit.fallProtection.length > 0 && (
        <div className="mt-2">
          <dt className="text-xs uppercase tracking-wider text-fg-3">Fall protection</dt>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {permit.fallProtection.map((m) => (
              <span key={m} className="text-xs px-2 py-1 rounded-full bg-mytra-bg border border-mytra-border text-fg-2">{m}</span>
            ))}
          </div>
        </div>
      )}
      {permit.rescuePlan && (
        <div className="mt-2">
          <dt className="text-xs uppercase tracking-wider text-fg-3">Rescue plan</dt>
          <dd className="text-sm text-fg-2 mt-0.5">{permit.rescuePlan}</dd>
        </div>
      )}
    </Section>
  )
}

function HotWorkDetails({ permit }: { permit: HotWorkPermit }) {
  return (
    <Section title="Hot work details">
      {permit.hotWorkTypes.length > 0 && (
        <div className="mb-2">
          <dt className="text-xs uppercase tracking-wider text-fg-3">Type of work</dt>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {permit.hotWorkTypes.map((t) => (
              <span key={t} className="text-xs px-2 py-1 rounded-full bg-mytra-bg border border-mytra-border text-fg-2">{t}</span>
            ))}
          </div>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <Field label="Fire watch" value={permit.fireWatchRequired ? `Yes — ${permit.fireWatchName || 'unassigned'}` : 'No'} />
        {permit.fireWatchRequired && <Field label="Post-work monitoring" value={`${permit.fireWatchPostDurationMin} min`} />}
        {permit.extinguisherLocation && <Field label="Extinguisher" value={`${permit.extinguisherType} at ${permit.extinguisherLocation}`} />}
        {permit.sprinklerStatus && <Field label="Sprinkler status" value={permit.sprinklerStatus} />}
      </dl>
      {permit.gasTestRequired && (
        <div className="mt-2">
          <dt className="text-xs uppercase tracking-wider text-fg-3">Atmosphere test</dt>
          <dd className="text-sm text-fg-2 mt-0.5">{permit.gasTestNotes || 'Required — no notes'}</dd>
        </div>
      )}
    </Section>
  )
}

function ConfinedSpaceDetails({ permit }: { permit: ConfinedSpacePermit }) {
  const atmo = permit.atmospheric
  return (
    <Section title="Confined space details">
      {permit.spaceDescription && (
        <div className="mb-2">
          <dt className="text-xs uppercase tracking-wider text-fg-3">Space description</dt>
          <dd className="text-sm text-fg-2 mt-0.5">{permit.spaceDescription}</dd>
        </div>
      )}
      {permit.hazards.length > 0 && (
        <div className="mb-2">
          <dt className="text-xs uppercase tracking-wider text-fg-3">Hazards present</dt>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {permit.hazards.map((h) => (
              <span key={h} className="text-xs px-2 py-1 rounded-full bg-mytra-bg border border-mytra-border text-fg-2">{h}</span>
            ))}
          </div>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-2 text-sm mb-2 tabular-nums">
        <Field label="O₂ %" value={atmo.oxygenPct || '—'} />
        <Field label="LEL %" value={atmo.lelPct || '—'} />
        <Field label="CO ppm" value={atmo.coPpm || '—'} />
        <Field label="H₂S ppm" value={atmo.h2sPpm || '—'} />
        {atmo.testedBy && <Field label="Tested by" value={atmo.testedBy} />}
        {atmo.testedAt && <Field label="Tested at" value={fmt(atmo.testedAt)} />}
      </dl>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <Field label="Attendant" value={permit.attendantName || '—'} />
        <Field label="Continuous monitoring" value={permit.continuousMonitoring ? 'Yes' : 'No'} />
        <Field label="Ventilation" value={permit.ventilationInUse ? 'In use' : 'No'} />
      </dl>
      {permit.rescuePlan && (
        <div className="mt-2">
          <dt className="text-xs uppercase tracking-wider text-fg-3">Rescue plan</dt>
          <dd className="text-sm text-fg-2 mt-0.5">{permit.rescuePlan}</dd>
        </div>
      )}
    </Section>
  )
}

function IncidentBody({ incident, images }: { incident: IncidentReport; images: Record<string, string> }) {
  return (
    <>
      <Section title="Incident">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-xs font-semibold uppercase px-2 py-0.5 rounded"
            style={{ color: INCIDENT_SEVERITY_COLORS[incident.severity], backgroundColor: `color-mix(in srgb, ${INCIDENT_SEVERITY_COLORS[incident.severity]} 10%, transparent)` }}
          >
            {incident.severity}
          </span>
          <span className="text-xs text-fg-2">{incident.incidentType}</span>
          <span className="text-xs text-fg-3">· {fmt(incident.occurredAt)}</span>
        </div>
        <p className="text-sm text-fg-2">{incident.description}</p>
        {incident.immediateActions && (
          <p className="text-xs text-fg-2 mt-2">
            <span className="text-fg-3">Immediate actions: </span>
            {incident.immediateActions}
          </p>
        )}
        {incident.witnesses.length > 0 && (
          <p className="text-xs text-fg-2 mt-1">
            <span className="text-fg-3">Witnesses: </span>
            {incident.witnesses.join(', ')}
          </p>
        )}
        {incident.reportedToCalOsha && (
          <p className="text-xs text-warn mt-1">Reported to authorities</p>
        )}
        {incident.injuredPerson && (
          <div className="mt-3 pt-3 border-t border-mytra-border space-y-1">
            <p className="text-xs uppercase tracking-wider text-fg-3 font-semibold">Injured person</p>
            <p className="text-sm text-fg-2">{incident.injuredPerson.name}</p>
            {incident.injuredPerson.jobTitle && <p className="text-xs text-fg-3">Title: {incident.injuredPerson.jobTitle}</p>}
            {incident.injuredPerson.employer && <p className="text-xs text-fg-3">Employer: {incident.injuredPerson.employer}</p>}
            {incident.injuredPerson.bodyPartAffected && <p className="text-xs text-fg-3">Body part: {incident.injuredPerson.bodyPartAffected}</p>}
          </div>
        )}
      </Section>

      {incident.photoSlots.length > 0 && (
        <Section title="Photos">
          <div className="flex flex-wrap gap-2">
            {incident.photoSlots.map((slot) =>
              images[slot] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={slot} src={images[slot]} alt="Incident photo" className="w-24 h-24 object-cover rounded-lg border border-mytra-border" />
              ) : (
                <div key={slot} className="w-24 h-24 rounded-lg border border-mytra-border flex items-center justify-center text-xs text-fg-4">
                  on device
                </div>
              )
            )}
          </div>
        </Section>
      )}

      {(incident.rootCause || incident.correctiveActions) && (
        <Section title="Analysis">
          {incident.rootCause && (
            <p className="text-sm text-fg-2">
              <span className="text-fg-3 text-xs uppercase tracking-wider">Root cause</span>
              <br />
              {incident.rootCause}
            </p>
          )}
          {incident.correctiveActions && (
            <p className="text-sm text-fg-2 mt-2">
              <span className="text-fg-3 text-xs uppercase tracking-wider">Corrective actions</span>
              <br />
              {incident.correctiveActions}
            </p>
          )}
        </Section>
      )}

      {incident.reporterSignatureId && images[incident.reporterSignatureId] && (
        <Section title="Reporter">
          <div className="bg-mytra-input border border-mytra-border rounded-lg p-2 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[incident.reporterSignatureId]} alt="Reporter signature" className="h-12 object-contain" />
            <p className="text-xs text-fg mt-1">{incident.createdBy}</p>
          </div>
        </Section>
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-mytra-card border border-mytra-border rounded-card p-4 shadow-card">
      <h2 className="text-xs uppercase tracking-wider text-fg-3 font-semibold mb-2">{title}</h2>
      {children}
    </section>
  )
}
