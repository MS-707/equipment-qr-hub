'use client'

import { useEffect } from 'react'
import {
  getReviewPendingRecords,
  markReviewApproved,
  markReviewRejected,
} from '@/lib/safety-records'

const POLL_INTERVAL_MS = 90_000
const STALE_THRESHOLD_MS = 5 * 60_000
const LS_KEY = 'eqr-review-poll-ts'

function getLastPollTime(): number {
  if (typeof window === 'undefined') return 0
  const raw = localStorage.getItem(LS_KEY)
  return raw ? Number(raw) : 0
}

function setLastPollTime(): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LS_KEY, String(Date.now())) } catch { /* non-fatal */ }
}

interface ReviewResult {
  status: 'pending' | 'approved' | 'rejected'
  reviewerName?: string
  reviewNote?: string
}

let polling = false

async function pollReviewStatus(): Promise<void> {
  if (typeof window === 'undefined') return
  if (!navigator.onLine) return
  if (polling) return
  polling = true
  try {
    await doPoll()
  } finally {
    polling = false
  }
}

async function doPoll(): Promise<void> {

  const pending = getReviewPendingRecords()
  if (pending.length === 0) return

  const pageIds = pending
    .map((r) => r.notionPageId)
    .filter((id): id is string => !!id)

  if (pageIds.length === 0) return

  try {
    const res = await fetch(`/api/safety/review/status?pages=${pageIds.join(',')}`)
    if (!res.ok) return

    const data = (await res.json()) as { decisions: Record<string, ReviewResult> }
    setLastPollTime()

    for (const record of pending) {
      if (!record.notionPageId) continue
      const decision = data.decisions[record.notionPageId]
      if (!decision) continue

      if (decision.status === 'approved') {
        markReviewApproved(record.id, {
          reviewerName: decision.reviewerName ?? 'EHS Manager',
          reviewerEmail: null,
          reviewNote: decision.reviewNote ?? null,
        })
      } else if (decision.status === 'rejected') {
        markReviewRejected(record.id, {
          reviewerName: decision.reviewerName ?? 'EHS Manager',
          reviewerEmail: null,
          reviewNote: decision.reviewNote ?? null,
        })
      }
    }
  } catch {
    // Network error — will retry next interval
  }
}

export function useReviewPoller(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null

    function startTimer() {
      stopTimer()
      timer = setInterval(() => void pollReviewStatus(), POLL_INTERVAL_MS)
    }

    function stopTimer() {
      if (timer) { clearInterval(timer); timer = null }
    }

    const isStale = Date.now() - getLastPollTime() > STALE_THRESHOLD_MS
    if (isStale) void pollReviewStatus()

    startTimer()

    const onOnline = () => void pollReviewStatus()
    window.addEventListener('online', onOnline)

    const onVisibility = () => {
      if (document.hidden) {
        stopTimer()
      } else {
        void pollReviewStatus()
        startTimer()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stopTimer()
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
}
