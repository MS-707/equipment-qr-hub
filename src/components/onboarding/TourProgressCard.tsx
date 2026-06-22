'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { GraduationCap, CheckCircle2, Circle, X } from 'lucide-react'
import { MODULE_TOURS, findTourForRoute } from '@/tours'
import { isTourSeen } from '@/lib/tourState'
import { MODULE_TOUR_EVENT, TOUR_ENDED_EVENT } from './ModuleTourEngine'

const DISMISSED_KEY = 'eqr-tours-all-dismissed'

export default function TourProgressCard() {
  const router = useRouter()
  const pathname = usePathname()
  const [dismissed, setDismissed] = useState(true) // start hidden to avoid flash
  const [statuses, setStatuses] = useState<Record<string, boolean>>({})

  const refresh = () => {
    const s: Record<string, boolean> = {}
    MODULE_TOURS.forEach((t) => {
      s[t.id] = isTourSeen(t.id)
    })
    setStatuses(s)
  }

  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISSED_KEY) === 'true') } catch { /* default dismissed */ }
    refresh()
  }, [])

  // Refresh when a tour ends (user completed one)
  useEffect(() => {
    const onEnd = () => refresh()
    window.addEventListener(TOUR_ENDED_EVENT, onEnd)
    window.addEventListener('storage', onEnd)
    return () => {
      window.removeEventListener(TOUR_ENDED_EVENT, onEnd)
      window.removeEventListener('storage', onEnd)
    }
  }, [])

  const total = MODULE_TOURS.length
  const completed = MODULE_TOURS.filter((t) => statuses[t.id]).length
  const allDone = completed === total

  if (dismissed) return null

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setDismissed(true)
  }

  const handleTourClick = (tourRoute: string, tourId: string) => {
    // If we're already on the tour's page, trigger the tour directly
    const currentTour = findTourForRoute(pathname)
    if (currentTour && currentTour.id === tourId) {
      window.dispatchEvent(
        new CustomEvent(MODULE_TOUR_EVENT, { detail: { tourId } })
      )
    } else {
      // Navigate to the tour's route — skip dynamic routes like /equipment/[id]
      if (tourRoute.includes('[')) return
      router.push(tourRoute)
    }
  }

  return (
    <div className="bg-mytra-card border border-mytra-border rounded-card p-4 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-mytra-purple" />
          <h3 className="text-sm font-semibold text-fg">Getting Started</h3>
        </div>
        <span className="text-xs text-fg-3">
          {completed} of {total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-mytra-border mb-3">
        <div
          className="h-1.5 rounded-full bg-mytra-purple transition-all duration-300"
          style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
        />
      </div>

      {allDone ? (
        <div className="flex items-center justify-between py-2">
          <p className="text-sm text-fg-2">All set! You know your way around.</p>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs text-fg-3 hover:text-fg transition-colors flex items-center gap-1 min-h-[32px]"
          >
            <X className="w-3.5 h-3.5" />
            Dismiss
          </button>
        </div>
      ) : (
        <div>
          {MODULE_TOURS.map((tour) => {
            const done = statuses[tour.id]
            const isDynamic = tour.route.includes('[')
            return (
              <div
                key={tour.id}
                className="flex items-center gap-3 py-2 border-b border-mytra-border last:border-0"
              >
                {done ? (
                  <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-fg-4 shrink-0" />
                )}
                <span className={`text-sm flex-1 ${done ? 'text-fg-3' : 'text-fg'}`}>
                  {tour.label}
                </span>
                {!done && !isDynamic && (
                  <button
                    type="button"
                    onClick={() => handleTourClick(tour.route, tour.id)}
                    className="text-xs text-mytra-purple hover:underline min-h-[32px] px-1"
                  >
                    Start &rarr;
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
