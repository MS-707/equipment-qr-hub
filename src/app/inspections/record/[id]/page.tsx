'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer, CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import { getAllInspections, getSignature } from '@/lib/inspections'
import { getEquipmentById } from '@/lib/equipment'
import type { InspectionRecord } from '@/lib/types'

/**
 * Printable record of a completed, signed pre-trip inspection (DS-9).
 * Screen shows a token-styled summary; print renders the formal paper
 * template via the shared print-doc / print-sig classes, including the
 * operator's touch signature from IndexedDB.
 */
export default function InspectionRecordPage({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id)
  const [record, setRecord] = useState<InspectionRecord | null | undefined>(undefined)
  const [signature, setSignature] = useState<string | null>(null)

  useEffect(() => {
    const r = getAllInspections().find((x) => x.id === id) ?? null
    setRecord(r)
    if (r?.hasSignature) {
      getSignature(r.id).then(setSignature).catch(() => setSignature(null))
    }
  }, [id])

  const equipment = record ? getEquipmentById(record.equipmentId) : undefined
  const fmt = (iso: string) => new Date(iso).toLocaleString()
  const resultLabel = !record
    ? ''
    : record.hasCriticalFail
      ? 'CRITICAL FAIL — DO NOT OPERATE'
      : record.result === 'fail'
        ? 'Issues found'
        : 'Pass'

  if (record === undefined || record === null) {
    return (
      <RecordShell centered>
        {record === undefined ? (
          <p className="text-sm text-fg-3">Loading record…</p>
        ) : (
          <>
            <h1 className="text-xl font-bold text-fg">Record not found</h1>
            <p className="text-sm text-fg-2">
              This inspection isn&apos;t on this device — records live where they were captured.
            </p>
            <Link href="/inspections" className="text-sm text-mytra-purple hover:underline">
              Back to inspections
            </Link>
          </>
        )}
      </RecordShell>
    )
  }

  return (
    <RecordShell>
      {/* Screen chrome */}
      <div className="no-print flex items-center justify-between gap-2">
        <Link
          href="/inspections"
          className="inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" /> Inspections
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 text-sm text-fg-2 bg-mytra-card border border-mytra-border rounded-lg px-3 py-2 min-h-[44px] hover:bg-mytra-card-hover"
        >
          <Printer className="w-3.5 h-3.5" /> Print
        </button>
      </div>

      {/* Print-only formal document header (paper template) */}
      <div className="print-only print-doc-header">
        <div className="print-doc-title">
          <span>Pre-Trip Inspection</span>
          <span style={{ fontSize: '10pt' }}>{record.id}</span>
        </div>
        <dl className="print-doc-meta">
          <div><dt>Equipment</dt><dd>{equipment?.name ?? `Unit #${record.equipmentId}`}</dd></div>
          <div><dt>Unit #</dt><dd>{record.equipmentId}</dd></div>
          <div><dt>Inspector</dt><dd>{record.inspectorName}</dd></div>
          <div><dt>Shift</dt><dd>{record.shift}</dd></div>
          <div><dt>Hour meter</dt><dd>{record.hourMeterReading ?? '—'}</dd></div>
          <div><dt>Completed</dt><dd>{fmt(record.createdAt)}</dd></div>
          <div><dt>Result</dt><dd>{resultLabel}</dd></div>
          <div><dt>Work order</dt><dd>{record.workOrderId ?? '—'}</dd></div>
        </dl>
      </div>

      {/* Screen header */}
      <div className="no-print bg-mytra-card border border-mytra-border rounded-card p-4 shadow-card">
        <h1 className="text-xl font-bold text-fg leading-tight">
          {equipment?.name ?? `Unit #${record.equipmentId}`}
        </h1>
        <p className="text-sm text-fg-3 mt-1">
          {record.id} · {record.inspectorName} · {record.shift} shift · {fmt(record.createdAt)}
        </p>
        <p className={`text-sm font-semibold mt-2 ${record.hasCriticalFail || record.result === 'fail' ? 'text-danger' : 'text-ok'}`}>
          {resultLabel}
        </p>
      </div>

      {/* Checklist results */}
      <section className="bg-mytra-card border border-mytra-border rounded-card p-4 shadow-card">
        <h2 className="text-xs uppercase tracking-wider text-fg-3 font-semibold mb-2">
          Checklist ({record.items.length} items)
        </h2>
        <ul className="divide-y divide-mytra-border">
          {record.items.map((item) => (
            <li key={item.id} className="py-2 flex items-start gap-2 text-sm">
              {item.result === 'pass' && <CheckCircle2 className="w-4 h-4 text-ok shrink-0 mt-0.5" />}
              {item.result === 'fail' && <XCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />}
              {item.result === 'na' && <MinusCircle className="w-4 h-4 text-fg-4 shrink-0 mt-0.5" />}
              <div className="min-w-0 flex-1">
                <p className="text-fg">{item.label}</p>
                {item.notes && <p className="text-xs text-fg-2 mt-0.5">{item.notes}</p>}
                {item.naReasonCode && (
                  <p className="text-xs text-fg-3 mt-0.5">N/A — {item.naReasonCode}{item.naJustification ? `: ${item.naJustification}` : ''}</p>
                )}
              </div>
              <span className="text-xs uppercase font-semibold text-fg-3 shrink-0">{item.result}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Operator sign-on */}
      <section className="bg-mytra-card border border-mytra-border rounded-card p-4 shadow-card">
        <h2 className="text-xs uppercase tracking-wider text-fg-3 font-semibold mb-2">Operator Sign-On</h2>
        <p className="text-sm text-fg-2">
          Signed by <span className="font-medium text-fg">{record.inspectorName}</span> certifying this
          inspection was performed on {fmt(record.createdAt)}.
        </p>
        {signature ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signature}
            alt={`Operator signature — ${record.inspectorName}`}
            className="mt-2 h-20 w-auto bg-white rounded border border-mytra-border"
          />
        ) : (
          <p className="text-xs text-fg-4 mt-2">
            {record.hasSignature ? 'Signature image is stored on the capturing device.' : 'Captured before sign-on was introduced.'}
          </p>
        )}
        <div className="print-only">
          <div className="print-sig-row">
            <div className="print-sig-line">Operator — Printed Name &amp; Signature</div>
            <div className="print-sig-line">Title / Role</div>
            <div className="print-sig-line">Date</div>
          </div>
          <div className="print-sig-row">
            <div className="print-sig-line">Supervisor / EHS Review — Printed Name &amp; Signature</div>
            <div className="print-sig-line">Title / Role</div>
            <div className="print-sig-line">Date</div>
          </div>
        </div>
      </section>
    </RecordShell>
  )
}

/** Single main landmark shared by every branch (UX-8: one landmark per route). */
function RecordShell({ centered, children }: { centered?: boolean; children: React.ReactNode }) {
  return (
    <main
      id="main"
      className={centered ? 'max-w-2xl mx-auto px-4 py-10 text-center space-y-2' : 'max-w-2xl mx-auto px-4 pt-6 pb-10 space-y-4'}
    >
      {children}
    </main>
  )
}
