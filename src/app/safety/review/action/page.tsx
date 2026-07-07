'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Shield } from 'lucide-react'
import { inputCls, btnPrimaryCls } from '@/lib/form-styles'

interface ReviewInfo {
  recordId: string
  recordLabel: string
  projectName: string
  location: string
  submitterName: string
  status: string
  action: 'approve' | 'reject'
}

type Stage = 'loading' | 'confirm' | 'submitting' | 'done' | 'error'

export default function ReviewActionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-mytra-bg text-fg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-mytra-purple" />
      </div>
    }>
      <main id="main" className="contents">
        <ReviewActionInner />
      </main>
    </Suspense>
  )
}

function ReviewActionInner() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [stage, setStage] = useState<Stage>('loading')
  const [info, setInfo] = useState<ReviewInfo | null>(null)
  const [result, setResult] = useState<{ status: string; employeeNotified: boolean; alreadyDecided: boolean } | null>(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!token) {
      setError('No review token found in URL.')
      setStage('error')
      return
    }
    fetch(`/api/safety/review/decide?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Invalid link')
          setStage('error')
          return
        }
        if (data.status !== 'pending') {
          setResult({ status: data.status, employeeNotified: false, alreadyDecided: true })
          setStage('done')
          return
        }
        setInfo(data)
        setStage('confirm')
      })
      .catch(() => {
        setError('Network error — check your connection and try again.')
        setStage('error')
      })
  }, [token])

  async function handleConfirm() {
    if (!token) return
    setStage('submitting')
    try {
      const res = await fetch('/api/safety/review/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, note: note.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to process decision')
        setStage('error')
        return
      }
      setResult(data)
      setInfo((prev) => prev ? { ...prev, recordLabel: data.recordLabel } : prev)
      setStage('done')
    } catch {
      setError('Network error — check your connection and try again.')
      setStage('error')
    }
  }

  const isApprove = info?.action === 'approve'

  return (
    <div className="min-h-screen bg-mytra-bg text-fg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Shield className="w-5 h-5 text-mytra-purple" />
          <span className="text-lg font-bold">Sage EHS</span>
        </div>

        {stage === 'loading' && (
          <div className="bg-mytra-card border border-mytra-border rounded-card p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-mytra-purple mx-auto mb-3" />
            <p className="text-sm text-fg-3">Loading review details...</p>
          </div>
        )}

        {stage === 'confirm' && info && (
          <div className="bg-mytra-card border border-mytra-border rounded-card p-6 space-y-4">
            <div className="text-center">
              {isApprove ? (
                <CheckCircle2 className="w-10 h-10 text-ok mx-auto mb-2" />
              ) : (
                <XCircle className="w-10 h-10 text-danger mx-auto mb-2" />
              )}
              <h1 className="text-lg font-semibold">
                {isApprove ? 'Approve' : 'Deny'} this record?
              </h1>
            </div>

            <div className="bg-mytra-input rounded-lg p-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-fg-3">Type</span>
                <span className="font-medium">{info.recordLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-3">Record ID</span>
                <span className="font-mono text-xs">{info.recordId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-3">Project</span>
                <span>{info.projectName || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-3">Location</span>
                <span>{info.location || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-3">Submitted by</span>
                <span>{info.submitterName}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs text-fg-3 mb-1">
                Note to employee (optional)
              </label>
              <textarea
                rows={2}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={isApprove ? 'e.g. Looks good, stay safe out there.' : 'e.g. Missing fall protection details — see me before starting work.'}
                className={`${inputCls} resize-none`}
              />
            </div>

            <button
              onClick={handleConfirm}
              className={`w-full py-3 rounded-lg text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 ${
                isApprove
                  ? 'bg-ok text-white hover:opacity-90'
                  : 'bg-danger text-white hover:opacity-90'
              }`}
            >
              {isApprove ? (
                <><CheckCircle2 className="w-4 h-4" /> Confirm Approval</>
              ) : (
                <><XCircle className="w-4 h-4" /> Confirm Denial</>
              )}
            </button>
          </div>
        )}

        {stage === 'submitting' && (
          <div className="bg-mytra-card border border-mytra-border rounded-card p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-mytra-purple mx-auto mb-3" />
            <p className="text-sm text-fg-3">Processing your decision...</p>
          </div>
        )}

        {stage === 'done' && result && (
          <div className="bg-mytra-card border border-mytra-border rounded-card p-8 text-center space-y-3">
            {result.status === 'approved' ? (
              <CheckCircle2 className="w-12 h-12 text-ok mx-auto" />
            ) : (
              <XCircle className="w-12 h-12 text-danger mx-auto" />
            )}
            <h1 className="text-lg font-semibold">
              {result.alreadyDecided ? 'Already Decided' : 'Decision Recorded'}
            </h1>
            <p className="text-sm text-fg-3">
              {result.status === 'approved'
                ? `This ${info?.recordLabel || 'record'} has been approved.`
                : `This ${info?.recordLabel || 'record'} needs revision.`}
            </p>
            {result.employeeNotified && (
              <p className="text-xs text-ok">
                The employee has been notified by email.
              </p>
            )}
            {!result.employeeNotified && !result.alreadyDecided && (
              <p className="text-xs text-fg-3">
                Email notification could not be sent. Please notify the employee directly.
              </p>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  window.close()
                  setTimeout(() => { window.location.href = '/' }, 400)
                }}
                className="w-full py-2.5 rounded-lg text-sm font-medium bg-mytra-input text-fg hover:bg-mytra-card-hover transition-colors"
              >
                Close this window
              </button>
              <Link href="/" className="text-sm text-fg-3 hover:text-fg transition-colors text-center">
                Go to Safety Dashboard
              </Link>
            </div>
          </div>
        )}

        {stage === 'error' && (
          <div className="bg-mytra-card border border-mytra-border rounded-card p-8 text-center space-y-3">
            <AlertTriangle className="w-12 h-12 text-warn mx-auto" />
            <h1 className="text-lg font-semibold">Unable to Process</h1>
            <p className="text-sm text-fg-3">{error}</p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => window.location.reload()}
                className={`${btnPrimaryCls} w-full py-2.5 text-sm font-medium`}
              >
                Try again
              </button>
              <Link href="/" className="text-sm text-fg-3 hover:text-fg transition-colors text-center">
                Go to Safety Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
