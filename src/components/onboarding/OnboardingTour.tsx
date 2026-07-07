'use client'

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useId } from 'react'
import { Sparkles, ArrowRight, ArrowLeft, X } from 'lucide-react'
import { getCurrentIdentity } from '@/lib/identity'
import { btnPrimaryCls } from '@/lib/form-styles'

const SEEN_KEY = 'sage-onboarding-seen'
export const START_TOUR_EVENT = 'sage:start-tour'

interface TourStep {
  /** Comma-separated selectors; the first VISIBLE match is highlighted. */
  target: string
  title: string
  body: string
}

const STEPS: TourStep[] = [
  {
    target: '[data-tour-tab="/"]',
    title: 'Home',
    body: 'Your Safety Dashboard. Start here each shift to log a Pre-Task Plan, check active permits, and see recent activity.',
  },
  {
    target: '[data-tour-tab="/inspections"]',
    title: 'Pre-Trip',
    body: 'Run pre-trip inspections on vehicles and equipment before you operate them.',
  },
  {
    target: '[data-tour-tab="/equipment"]',
    title: 'Assets',
    body: 'Look up any equipment — training requirements, PM schedules, and compliance info. QR codes on gear bring you straight here.',
  },
  {
    target: '[data-tour="sage-fab"]',
    title: 'Ask Sage',
    body: 'Tap Sage anytime for safety guidance, to review your PTP for gaps, or to find where something lives. Works offline too.',
  },
]

const GAP = 12
const PAD = 6

function findVisible(selector: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector))
  return els.find((el) => el.getBoundingClientRect().width > 0) || null
}

type Phase = 'idle' | 'welcome' | 'tour'

export default function OnboardingTour() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [stepIndex, setStepIndex] = useState(0)
  const [steps, setSteps] = useState<TourStep[]>([])
  const [rect, setRect] = useState<DOMRect | null>(null)
  // 'entering' = measuring target, 'visible' = stable, 'stepping' = crossfading between steps
  const [spotPhase, setSpotPhase] = useState<'entering' | 'visible' | 'stepping'>('entering')
  const pendingStepRef = useRef<number | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const bodyId = useId()

  const finish = useCallback(() => {
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* non-fatal */
    }
    setPhase('idle')
    setStepIndex(0)
    restoreFocusRef.current?.focus()
    restoreFocusRef.current = null
  }, [])

  const goToStep = useCallback((next: number) => {
    pendingStepRef.current = next
    setSpotPhase('stepping')
  }, [])

  useEffect(() => {
    if (spotPhase !== 'stepping') return
    const timer = setTimeout(() => {
      const next = pendingStepRef.current
      if (next !== null) {
        setStepIndex(next)
        pendingStepRef.current = null
      }
      setSpotPhase('entering')
    }, 150)
    return () => clearTimeout(timer)
  }, [spotPhase])

  const startTour = useCallback(() => {
    const available = STEPS.filter((s) => findVisible(s.target))
    if (available.length === 0) {
      finish()
      return
    }
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSteps(available)
    setStepIndex(0)
    setSpotPhase('entering')
    setPhase('tour')
  }, [finish])

  // Auto-show welcome on first run, once signed in.
  useEffect(() => {
    let seen = false
    try {
      seen = localStorage.getItem(SEEN_KEY) === '1'
    } catch {
      /* ignore */
    }
    if (!seen && getCurrentIdentity()) {
      const t = setTimeout(() => setPhase('welcome'), 600)
      return () => clearTimeout(t)
    }
  }, [])

  // Allow the "?" button (or anywhere) to replay the tour.
  useEffect(() => {
    const onStart = () => setPhase('welcome')
    window.addEventListener(START_TOUR_EVENT, onStart)
    return () => window.removeEventListener(START_TOUR_EVENT, onStart)
  }, [])

  useLayoutEffect(() => {
    if (phase !== 'tour') return
    const measure = () => {
      const el = findVisible(steps[stepIndex]?.target ?? '')
      setRect(el ? el.getBoundingClientRect() : null)
    }
    measure()
    // Reveal after a frame so position is applied before fade-in
    const raf = requestAnimationFrame(() => setSpotPhase('visible'))
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
  }, [phase, stepIndex, steps])

  // Lock body scroll while any onboarding UI is up.
  useEffect(() => {
    if (phase === 'idle') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'tour') return
    const onKey = (e: KeyboardEvent) => {
      if (spotPhase === 'stepping') return
      if (e.key === 'Escape') { finish(); return }
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        if (stepIndex >= steps.length - 1) finish()
        else goToStep(stepIndex + 1)
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (stepIndex > 0) goToStep(stepIndex - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, stepIndex, steps.length, finish, goToStep, spotPhase])

  // Focus the tooltip when a step reveals; trap Tab within its controls.
  useEffect(() => {
    if (phase === 'tour' && spotPhase === 'visible') tooltipRef.current?.focus()
  }, [phase, spotPhase, stepIndex])

  const trapTab = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const focusables = tooltipRef.current?.querySelectorAll<HTMLElement>('button, [href]')
    if (!focusables || focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus()
    }
  }, [])

  if (phase === 'idle') return null

  // ── Welcome splash ──────────────────────────────
  if (phase === 'welcome') {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center px-5 bg-black/70 backdrop-blur-sm animate-fadeIn">
        <div className="w-full max-w-sm bg-mytra-card border border-mytra-border rounded-2xl shadow-pop p-6 animate-fadeInUp">
          <div className="w-12 h-12 rounded-full bg-mytra-purple/15 flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6 text-mytra-purple" />
          </div>
          <h2 className="text-xl font-bold text-fg">Welcome to Sage</h2>
          <p className="text-sm text-fg-2 mt-2 leading-relaxed">
            Your AI-assisted safety companion for any workplace. Log Pre-Task Plans, pull permits,
            report incidents, and get instant safety guidance — online or off.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={startTour}
              className={`${btnPrimaryCls} w-full min-h-[44px] py-3 text-sm font-semibold inline-flex items-center justify-center gap-2`}
            >
              Take a quick tour <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={finish}
              className="w-full min-h-[44px] py-2.5 rounded-lg text-sm font-medium text-fg-3 hover:text-fg transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    )
  }

  const step = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1
  const vw = typeof window !== 'undefined' ? window.innerWidth : 0
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0

  const placeAbove = rect ? rect.top > vh / 2 : false
  const tooltipWidth = Math.min(300, vw - 24)
  const targetCenterX = rect ? rect.left + rect.width / 2 : vw / 2
  const tooltipLeft = Math.max(12, Math.min(targetCenterX - tooltipWidth / 2, vw - tooltipWidth - 12))

  const spotVisible = spotPhase === 'visible' && rect !== null

  return (
    <div className="fixed inset-0 z-[70] animate-fadeIn">
      <div className="absolute inset-0" />

      {rect && (
        <div
          className="absolute border-2 border-mytra-purple rounded-xl pointer-events-none"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
            opacity: spotVisible ? 1 : 0,
            transition: 'opacity 150ms ease-in-out',
          }}
        />
      )}

      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        onKeyDown={trapTab}
        className="absolute bg-mytra-card border border-mytra-border rounded-xl shadow-pop p-4 outline-none"
        style={{
          width: tooltipWidth,
          left: rect ? tooltipLeft : '50%',
          opacity: spotVisible ? 1 : 0,
          transition: 'opacity 150ms ease-in-out',
          ...(rect
            ? placeAbove
              ? { top: rect.top - GAP, transform: 'translateY(-100%)' }
              : { top: rect.bottom + GAP }
            : { top: '50%', transform: 'translate(-50%, -50%)' }),
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id={titleId} className="text-sm font-semibold text-fg">{step.title}</h3>
          <button
            type="button"
            onClick={finish}
            aria-label="End tour"
            className="-mt-2 -mr-2 w-11 h-11 flex items-center justify-center rounded-lg text-fg-3 hover:text-fg hover:bg-mytra-card-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p id={bodyId} className="text-sm text-fg-2 mt-1 leading-relaxed">{step.body}</p>

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
                onClick={() => goToStep(stepIndex - 1)}
                disabled={spotPhase === 'stepping'}
                className="min-h-[40px] px-3 rounded-lg text-sm font-medium text-fg-3 hover:text-fg transition-colors inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? finish() : goToStep(stepIndex + 1))}
              disabled={spotPhase === 'stepping'}
              className={`${btnPrimaryCls} min-h-[40px] px-4 text-sm font-semibold inline-flex items-center gap-1.5`}
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
