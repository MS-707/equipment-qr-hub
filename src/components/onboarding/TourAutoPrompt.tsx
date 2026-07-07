'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { GraduationCap, X } from 'lucide-react'
import { findTourForRoute } from '@/tours'
import { isTourSeen } from '@/lib/tourState'
import { requestModuleTour, TOUR_ACTIVE_EVENT } from './ModuleTourEngine'
import { btnPrimaryCls } from '@/lib/form-styles'

const DISMISS_KEY = 'sage-tour-prompt-dismissed'
const ONBOARDING_SEEN_KEY = 'sage-onboarding-seen'

/**
 * "First time here?" prompt for pages that have a module tour.
 * Desktop: small card bottom-left. Mobile: slim one-line pill above the tab
 * bar — deliberately quiet so a first open doesn't feel overwhelming.
 *
 * Guard rails (each fixed a real complaint from the first iteration):
 * - Only after sign-in — never on the auth screen.
 * - Waits until the welcome onboarding has been seen, so the two never stack.
 * - "No thanks" / ✕ dismisses globally, not per page.
 * - A page's prompt disappears for good once its tour is taken.
 */
export default function TourAutoPrompt() {
  const { status } = useSession()
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [tour, setTour] = useState<{ id: string; label: string } | null>(null)

  useEffect(() => {
    setVisible(false)
    if (status !== 'authenticated') return
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return
      if (localStorage.getItem(ONBOARDING_SEEN_KEY) !== '1') return
    } catch {
      return
    }
    const match = findTourForRoute(pathname)
    if (!match || isTourSeen(match.id)) return
    setTour({ id: match.id, label: match.label })
    const t = setTimeout(() => setVisible(true), 1200)
    return () => clearTimeout(t)
  }, [status, pathname])

  useEffect(() => {
    const hide = () => setVisible(false)
    window.addEventListener(TOUR_ACTIVE_EVENT, hide)
    return () => window.removeEventListener(TOUR_ACTIVE_EVENT, hide)
  }, [])

  function dismissForever() {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* non-fatal */
    }
    setVisible(false)
  }

  function takeTour() {
    if (tour) requestModuleTour(tour.id)
    setVisible(false)
  }

  if (!visible || !tour) return null

  return (
    <>
      {/* Mobile: slim pill above the bottom tab bar */}
      <div
        className="md:hidden no-print fixed left-3 right-3 z-[60] animate-fadeInUp"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}
      >
        <div className="flex items-center gap-2 bg-mytra-card border border-mytra-border rounded-full shadow-pop pl-3 pr-1.5 py-1.5">
          <GraduationCap className="w-4 h-4 text-mytra-purple shrink-0" />
          <p className="text-xs text-fg-2 flex-1 truncate">First time here? Take a quick tour</p>
          <button
            type="button"
            onClick={takeTour}
            className={`${btnPrimaryCls} shrink-0 min-h-[36px] px-3.5 rounded-full text-xs font-semibold`}
          >
            Tour
          </button>
          <button
            type="button"
            onClick={dismissForever}
            aria-label="Dismiss tour prompts"
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-fg-3 hover:text-fg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Desktop: card bottom-left */}
      <div className="hidden md:block fixed bottom-6 left-6 z-[60] animate-fadeInUp">
      <div className="w-72 bg-mytra-card border border-mytra-border rounded-xl shadow-pop p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-mytra-purple/15 flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4 text-mytra-purple" />
            </div>
            <h3 className="text-sm font-semibold text-fg">First time here?</h3>
          </div>
          <button
            type="button"
            onClick={dismissForever}
            aria-label="Dismiss tour prompts"
            className="-mt-1 -mr-1 w-8 h-8 flex items-center justify-center rounded-lg text-fg-3 hover:text-fg hover:bg-mytra-card-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-fg-2 mt-2 leading-relaxed">
          Take a quick tour of {tour.label} — it points out what each part does.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={takeTour}
            className={`${btnPrimaryCls} flex-1 min-h-[36px] py-2 text-xs font-semibold`}
          >
            Show me around
          </button>
          <button
            type="button"
            onClick={dismissForever}
            className="min-h-[36px] px-3 py-2 rounded-lg text-xs font-medium text-fg-3 hover:text-fg transition-colors"
          >
            No thanks
          </button>
        </div>
      </div>
      </div>
    </>
  )
}
