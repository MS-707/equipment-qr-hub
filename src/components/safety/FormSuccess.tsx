'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { CheckCircle2, WifiOff, Send, Loader2, AlertTriangle } from 'lucide-react'
import { haptic } from '@/lib/haptic'
import type { ReviewSubmitState } from '@/lib/review-submit'

interface FormSuccessProps {
  id: string
  title: string
  message: string
  onNew: () => void
  newLabel?: string
  offline?: boolean
  onSubmitForReview?: () => Promise<void>
  /**
   * Auto-submission outcome, driven by the ACTUAL POST result — never a
   * hardcoded flag. 'failed' renders a retry affordance via onRetryReview.
   */
  reviewAutoSubmitted?: ReviewSubmitState | null
  onRetryReview?: () => void
}

export default function FormSuccess({ id, title, message, onNew, newLabel = 'New', offline, onSubmitForReview, reviewAutoSubmitted, onRetryReview }: FormSuccessProps) {
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewDone, setReviewDone] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => { headingRef.current?.focus(); haptic('success') }, [])

  async function handleReviewSubmit() {
    if (!onSubmitForReview) return
    setReviewSubmitting(true)
    try {
      await onSubmitForReview()
      setReviewDone(true)
    } catch {
      // Submission failed — button returns to ready state so user can retry
    } finally {
      setReviewSubmitting(false)
    }
  }

  return (
    <div className="animate-fadeIn space-y-4">
      <div className="bg-ok/10 border border-ok/20 rounded-card p-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-ok mx-auto mb-3" />
        <h3 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-ok mb-1 outline-none">{title}</h3>
        <p className="text-sm text-ok">
          {message} <span className="font-mono text-fg">{id}</span>.
        </p>
      </div>
      {offline && (
        <div className="flex items-center gap-2 bg-warn/10 border border-warn/20 rounded-lg px-4 py-2.5">
          <WifiOff className="w-4 h-4 text-warn shrink-0" />
          <p className="text-xs text-warn">Saved locally. Will sync automatically when connection returns.</p>
        </div>
      )}

      {reviewAutoSubmitted === 'pending' && (
        <div className="flex items-center gap-2 bg-mytra-purple-glow border border-mytra-purple/20 rounded-lg px-4 py-2.5" role="status">
          <Loader2 className="w-4 h-4 text-mytra-purple shrink-0 animate-spin" />
          <p className="text-xs text-mytra-purple">Submitting for EHS review…</p>
        </div>
      )}

      {reviewAutoSubmitted === 'submitted' && (
        <div className="flex items-center gap-2 bg-mytra-purple-glow border border-mytra-purple/20 rounded-lg px-4 py-2.5">
          <Send className="w-4 h-4 text-mytra-purple shrink-0" />
          <p className="text-xs text-mytra-purple">Submitted for EHS review</p>
        </div>
      )}

      {reviewAutoSubmitted === 'failed' && (
        <div className="flex items-center gap-2 bg-warn/10 border border-warn/20 rounded-lg px-4 py-2.5" role="alert">
          <AlertTriangle className="w-4 h-4 text-warn shrink-0" />
          <p className="text-sm text-warn-strong flex-1">
            Could not submit for EHS review (offline or server issue). The record is saved on this device.
          </p>
          {onRetryReview && (
            <button
              type="button"
              onClick={onRetryReview}
              className="shrink-0 min-h-[44px] px-3 rounded-lg text-sm font-semibold text-mytra-purple hover:bg-mytra-purple/10 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {onSubmitForReview && !reviewAutoSubmitted && !reviewDone && (
        <button
          type="button"
          onClick={handleReviewSubmit}
          disabled={reviewSubmitting}
          className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium
                     bg-mytra-purple/10 border border-mytra-purple/30 text-mytra-purple
                     hover:border-mytra-purple/60 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {reviewSubmitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Submitting for review…</>
          ) : (
            <><Send className="w-4 h-4" /> Submit for EHS Review</>
          )}
        </button>
      )}

      {reviewDone && (
        <div className="flex items-center gap-2 bg-mytra-purple-glow border border-mytra-purple/20 rounded-lg px-4 py-2.5">
          <Send className="w-4 h-4 text-mytra-purple shrink-0" />
          <p className="text-xs text-mytra-purple">Submitted for EHS review — your manager will be notified</p>
        </div>
      )}

      <Link
        href={`/safety/record/${id}`}
        className="block w-full text-center py-3 rounded-lg text-sm font-semibold bg-mytra-purple text-white hover:bg-mytra-purple-hover transition-colors"
      >
        View / Print
      </Link>
      <button
        type="button"
        onClick={onNew}
        className="w-full py-3 rounded-lg text-sm font-semibold bg-mytra-card border border-mytra-border text-fg hover:bg-mytra-card-hover transition-colors"
      >
        {newLabel}
      </button>
      <Link href="/safety" className="block text-center text-sm text-fg-2 hover:text-fg">
        Back to Home
      </Link>
    </div>
  )
}
