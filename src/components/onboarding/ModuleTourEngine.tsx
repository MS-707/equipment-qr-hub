'use client'

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { ArrowRight, ArrowLeft, X } from 'lucide-react'
import { findTourForRoute, type ModuleTourStep } from '@/tours'
import { markTourSeen } from '@/lib/tourState'

export const MODULE_TOUR_EVENT = 'sage:start-module-tour'
export const TOUR_ACTIVE_EVENT = 'sage:tour-active'
export const TOUR_ENDED_EVENT = 'sage:tour-ended'

// The engine is lazy-loaded (ssr: false), so a Tour click can land before the
// listener exists and vanish. Callers go through requestModuleTour(); if the
// engine isn't mounted yet the request is parked here and replayed on mount
// (button and engine share this module instance).
let pendingTourId: string | null = null
let engineMounted = false

export function requestModuleTour(tourId: string) {
  if (engineMounted) {
    window.dispatchEvent(new CustomEvent(MODULE_TOUR_EVENT, { detail: { tourId } }))
  } else {
    pendingTourId = tourId
  }
}

const GAP = 12
const PAD = 6

function findVisible(selector: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector))
  return els.find((el) => el.getBoundingClientRect().width > 0) || null
}

export default function ModuleTourEngine() {
  const pathname = usePathname()
  const [active, setActive] = useState(false)
  const [steps, setSteps] = useState<ModuleTourStep[]>([])
  const [tourId, setTourId] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const finish = useCallback(() => {
    if (tourId) markTourSeen(tourId)
    setActive(false)
    setStepIndex(0)
    setTourId(null)
    window.dispatchEvent(new Event(TOUR_ENDED_EVENT))
  }, [tourId])

  const startTour = useCallback((id: string, attempt = 0) => {
    const tour = findTourForRoute(pathname)
    if (!tour || tour.id !== id) return
    const available = tour.steps.filter((s) => findVisible(s.target))
    if (available.length === 0) {
      // Targets may not have rendered yet (data still loading) — retry briefly.
      if (attempt < 3) setTimeout(() => startTour(id, attempt + 1), 400 * (attempt + 1))
      return
    }
    setSteps(available)
    setTourId(id)
    setStepIndex(0)
    setActive(true)
    window.dispatchEvent(new Event(TOUR_ACTIVE_EVENT))
  }, [pathname])

  useEffect(() => {
    engineMounted = true
    const onStart = (e: Event) => {
      const id = (e as CustomEvent).detail?.tourId as string | undefined
      if (id) startTour(id)
    }
    window.addEventListener(MODULE_TOUR_EVENT, onStart)
    if (pendingTourId) {
      const id = pendingTourId
      pendingTourId = null
      startTour(id)
    }
    return () => {
      engineMounted = false
      window.removeEventListener(MODULE_TOUR_EVENT, onStart)
    }
  }, [startTour])

  // Auto-dismiss on route change (only when pathname actually changes)
  const prevPathRef = useRef(pathname)
  useEffect(() => {
    if (prevPathRef.current !== pathname && active) {
      finish()
    }
    prevPathRef.current = pathname
  }, [pathname, active, finish])

  useLayoutEffect(() => {
    if (!active) return
    const prevOverflow = document.body.style.overflow
    const selector = steps[stepIndex]?.target ?? ''
    const el = findVisible(selector)
    if (el) {
      document.body.style.overflow = ''
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    // Track the target every frame until it stops moving (smooth scroll, late
    // layout), then lock scroll. A single delayed measure used to snapshot
    // mid-scroll coordinates, parking the spotlight on the wrong content.
    let raf = 0
    let last: DOMRect | null = null
    let stableFrames = 0
    const startedAt = Date.now()
    const track = () => {
      const target = findVisible(selector)
      const r = target ? target.getBoundingClientRect() : null
      if (r) {
        const moved =
          !last ||
          Math.abs(r.top - last.top) > 0.5 ||
          Math.abs(r.left - last.left) > 0.5 ||
          Math.abs(r.height - last.height) > 0.5
        if (moved) {
          stableFrames = 0
          setRect(r)
        } else {
          stableFrames++
        }
        last = r
      }
      if ((stableFrames >= 6 && r) || Date.now() - startedAt > 1500) {
        if (r) setRect(r)
        document.body.style.overflow = 'hidden'
        return
      }
      raf = requestAnimationFrame(track)
    }
    raf = requestAnimationFrame(track)

    const measure = () => {
      const target = findVisible(selector)
      setRect(target ? target.getBoundingClientRect() : null)
    }
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
      document.body.style.overflow = prevOverflow
    }
  }, [active, stepIndex, steps])

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        if (stepIndex === steps.length - 1) finish()
        else setStepIndex((i) => i + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (stepIndex > 0) setStepIndex((i) => i - 1)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        finish()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, stepIndex, steps.length, finish])

  if (!active || steps.length === 0) return null

  const step = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1
  const vw = typeof window !== 'undefined' ? window.innerWidth : 0
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0
  const placeAbove = rect ? rect.top > vh / 2 : false
  const tooltipWidth = Math.min(300, vw - 24)
  const targetCenterX = rect ? rect.left + rect.width / 2 : vw / 2
  const tooltipLeft = Math.max(12, Math.min(targetCenterX - tooltipWidth / 2, vw - tooltipWidth - 12))

  return (
    <div className="fixed inset-0 z-[70] animate-fadeIn">
      <div className="absolute inset-0" />

      {rect && (
        <div
          className="absolute border-2 border-mytra-purple rounded-xl pointer-events-none transition-all duration-200 ease-out"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
          }}
        />
      )}

      <div
        className="absolute bg-mytra-card border border-mytra-border rounded-xl shadow-pop p-4 transition-all duration-200 ease-out"
        style={{
          width: tooltipWidth,
          left: rect ? tooltipLeft : '50%',
          ...(rect
            ? placeAbove
              ? { top: rect.top - GAP, transform: 'translateY(-100%)' }
              : { top: rect.bottom + GAP }
            : { top: '50%', transform: 'translate(-50%, -50%)' }),
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-fg">{step.title}</h3>
          <button
            type="button"
            onClick={finish}
            aria-label="End tour"
            className="-mt-1 -mr-1 w-8 h-8 flex items-center justify-center rounded-lg text-fg-3 hover:text-fg hover:bg-mytra-card-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-fg-2 mt-1 leading-relaxed">{step.body}</p>

        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === stepIndex ? 'bg-mytra-purple' : 'bg-mytra-border'}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex((i) => i - 1)}
                className="min-h-[40px] px-3 rounded-lg text-sm font-medium text-fg-3 hover:text-fg transition-colors inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? finish() : setStepIndex((i) => i + 1))}
              className="min-h-[40px] px-4 rounded-lg text-sm font-semibold bg-mytra-purple text-white
                         hover:bg-mytra-purple-hover transition-colors inline-flex items-center gap-1.5"
            >
              {isLast ? 'Done' : 'Next'}
              {!isLast && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
