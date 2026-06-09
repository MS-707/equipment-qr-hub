'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { findTourForRoute } from '@/tours'
import { isTourSeen, markTourSeen } from '@/lib/tourState'
import { MODULE_TOUR_EVENT, TOUR_ACTIVE_EVENT } from './ModuleTourEngine'

export default function TourAutoPrompt() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [tourId, setTourId] = useState<string | null>(null)

  useEffect(() => {
    // Reset on route change
    setVisible(false)
    setTourId(null)

    const tour = findTourForRoute(pathname)
    if (!tour || isTourSeen(tour.id)) return

    const showTimer = setTimeout(() => {
      // Re-check in case tour was started/seen during the delay
      if (isTourSeen(tour.id)) return
      setTourId(tour.id)
      setVisible(true)
    }, 1500)

    return () => clearTimeout(showTimer)
  }, [pathname])

  // Auto-dismiss after 20 seconds (field workers may be looking at the jobsite)
  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(() => setVisible(false), 20000)
    return () => clearTimeout(timer)
  }, [visible])

  // Hide if tour starts externally (e.g. via ModuleTourButton)
  useEffect(() => {
    const onTourActive = () => setVisible(false)
    window.addEventListener(TOUR_ACTIVE_EVENT, onTourActive)
    return () => window.removeEventListener(TOUR_ACTIVE_EVENT, onTourActive)
  }, [])

  if (!visible || !tourId) return null

  const handleShow = () => {
    setVisible(false)
    window.dispatchEvent(
      new CustomEvent(MODULE_TOUR_EVENT, { detail: { tourId } })
    )
  }

  const handleSkip = () => {
    markTourSeen(tourId)
    setVisible(false)
  }

  return (
    <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-[60] animate-fadeInUp">
      <div className="bg-mytra-card border-t border-mytra-border px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-mytra-purple shrink-0" />
          <p className="text-sm text-fg flex-1">First time here? Want a quick walkthrough?</p>
          <button
            type="button"
            onClick={handleShow}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-mytra-purple text-white
                       hover:bg-mytra-purple-hover transition-colors min-h-[32px]"
          >
            Show Me
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm text-fg-3 hover:text-fg transition-colors min-h-[32px]"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
