'use client'

import { useState } from 'react'
import { Send, RotateCcw, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react'
import type { SafetyRecord } from '@/lib/safety-types'
import { markSubmittedForReview, markReviewRecalled, markSynced } from '@/lib/safety-records'
import { getCurrentIdentity } from '@/lib/identity'
import ConfirmDialog from '@/components/ConfirmDialog'

const EHS_ENABLED = process.env.NEXT_PUBLIC_EHS_REVIEW === '1'

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function ReviewStatusSection({ record }: { record: SafetyRecord }) {
  const [submitting, setSubmitting] = useState(false)
  const [recallOpen, setRecallOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!EHS_ENABLED) return null

  const identity = getCurrentIdentity()
  const by = { name: identity?.name ?? 'Unknown', email: identity?.email ?? null }
  const status = record.reviewStatus

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/safety/review/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record,
          notionPageId: record.notionPageId,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? 'Submit failed — try again')
      } else {
        const data = await res.json().catch(() => ({})) as { notionPageId?: string }
        if (data.notionPageId) {
          markSynced(record.id, data.notionPageId)
        }
        markSubmittedForReview(record.id, by)
      }
    } catch {
      setError('Offline — try again when connection returns')
    } finally {
      setSubmitting(false)
    }
  }

  function handleRecall() {
    markReviewRecalled(record.id, by)
    setRecallOpen(false)
  }

  if (!status || status === 'recalled') {
    return (
      <section className="no-print bg-mytra-card border border-mytra-border rounded-card p-4 shadow-card">
        <h2 className="text-xs uppercase tracking-wider text-fg-3 font-semibold mb-2">EHS Review</h2>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium
                     bg-mytra-purple/10 border border-mytra-purple/30 text-mytra-purple
                     hover:border-mytra-purple/60 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
          ) : (
            <><Send className="w-4 h-4" /> Submit for EHS Review</>
          )}
        </button>
        <p className="text-xs text-fg-4 mt-1.5 text-center">Your EHS manager will be notified</p>
        {error && (
          <p className="text-xs text-warn mt-2 text-center">{error}</p>
        )}
      </section>
    )
  }

  if (status === 'submitted') {
    return (
      <section className="bg-warn/5 border border-warn/20 rounded-card p-4 shadow-card">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">EHS Review</h2>
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
            style={{ color: 'var(--warn)', backgroundColor: 'color-mix(in srgb, var(--warn) 25%, transparent)' }}
          >
            <Clock className="w-3 h-3" /> Pending
          </span>
        </div>
        <p className="text-xs text-fg-2">Awaiting EHS manager sign-off</p>
        <button
          type="button"
          onClick={() => setRecallOpen(true)}
          className="no-print mt-3 inline-flex items-center gap-1.5 text-xs text-fg-3 hover:text-fg-2 transition-colors min-h-[44px] px-3"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Recall submission
        </button>
        <ConfirmDialog
          open={recallOpen}
          title="Recall Submission"
          message="This will withdraw your EHS review request. You can resubmit later."
          confirmLabel="Recall"
          onConfirm={handleRecall}
          onCancel={() => setRecallOpen(false)}
        />
      </section>
    )
  }

  if (status === 'approved') {
    return (
      <section className="bg-ok/5 border border-ok/20 rounded-card p-4 shadow-card">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">EHS Review</h2>
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
            style={{ color: 'var(--ok)', backgroundColor: 'color-mix(in srgb, var(--ok) 25%, transparent)' }}
          >
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        </div>
        <p className="text-xs text-fg-2">
          Approved by {record.reviewerName ?? 'EHS Manager'}
          {record.reviewDecidedAt && <> · {fmt(record.reviewDecidedAt)}</>}
        </p>
        {record.reviewNote && (
          <p className="text-xs text-fg-2 mt-1 italic">&ldquo;{record.reviewNote}&rdquo;</p>
        )}
      </section>
    )
  }

  if (status === 'rejected') {
    return (
      <>
        <section className="bg-danger/5 border border-danger/20 rounded-card p-4 shadow-card">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs uppercase tracking-wider text-fg-3 font-semibold">EHS Review</h2>
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{ color: 'var(--danger)', backgroundColor: 'color-mix(in srgb, var(--danger) 25%, transparent)' }}
            >
              <AlertCircle className="w-3 h-3" /> Needs Revision
            </span>
          </div>
          <p className="text-xs text-fg-2">
            Reviewed by {record.reviewerName ?? 'EHS Manager'}
            {record.reviewDecidedAt && <> · {fmt(record.reviewDecidedAt)}</>}
          </p>
          {record.reviewNote && (
            <p className="text-xs text-danger mt-1">&ldquo;{record.reviewNote}&rdquo;</p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="no-print mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium
                       bg-mytra-purple/10 border border-mytra-purple/30 text-mytra-purple
                       hover:border-mytra-purple/60 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Resubmitting…</>
            ) : (
              <><Send className="w-4 h-4" /> Resubmit for EHS Review</>
            )}
          </button>
          {error && (
            <p className="text-xs text-warn mt-2 text-center">{error}</p>
          )}
        </section>
      </>
    )
  }

  return null
}
