'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Check } from 'lucide-react'

export interface FormStep {
  id: string
  label: string
  complete: boolean
}

export interface FormStepperProps {
  steps: FormStep[]
  activeStepId: string | null
}

export function useActiveStep(stepIds: string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null)
  const ratiosRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    if (stepIds.length === 0) return

    const elements: Element[] = []
    for (const id of stepIds) {
      const el = document.querySelector(`[data-step="${id}"]`)
      if (el) elements.push(el)
    }

    if (elements.length === 0) return

    const pickActive = () => {
      let bestId: string | null = null
      let bestRatio = -1
      let bestTop = Infinity

      for (const id of stepIds) {
        const ratio = ratiosRef.current.get(id) ?? 0
        if (ratio <= 0) continue
        const el = document.querySelector(`[data-step="${id}"]`)
        const top = el?.getBoundingClientRect().top ?? Infinity

        if (
          ratio > bestRatio ||
          (ratio === bestRatio && top < bestTop)
        ) {
          bestRatio = ratio
          bestId = id
          bestTop = top
        }
      }

      if (bestId === null && stepIds.length > 0) {
        let closestId: string | null = null
        let closestDist = Infinity
        for (const id of stepIds) {
          const el = document.querySelector(`[data-step="${id}"]`)
          if (!el) continue
          const dist = Math.abs(el.getBoundingClientRect().top)
          if (dist < closestDist) {
            closestDist = dist
            closestId = id
          }
        }
        bestId = closestId
      }

      setActiveId(bestId)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const stepAttr = (entry.target as HTMLElement).dataset.step
          if (stepAttr) {
            ratiosRef.current.set(stepAttr, entry.intersectionRatio)
          }
        }
        pickActive()
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    )

    for (const el of elements) observer.observe(el)

    return () => observer.disconnect()
  }, [stepIds])

  return activeId
}

export default function FormStepper({ steps, activeStepId }: FormStepperProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!activeRef.current || !scrollRef.current) return
    const container = scrollRef.current
    const pill = activeRef.current
    const scrollLeft = pill.offsetLeft - container.offsetWidth / 2 + pill.offsetWidth / 2
    container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
  }, [activeStepId])

  const handleTap = useCallback((id: string) => {
    document.querySelector(`[data-step="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className="sticky top-[56px] z-20 bg-mytra-card/95 backdrop-blur-sm border-b border-mytra-border shadow-card">
      <div
        ref={scrollRef}
        className="flex items-center gap-2 px-3 py-2 overflow-x-auto scrollbar-hide"
      >
        {steps.map((step, i) => {
          const isActive = step.id === activeStepId
          const isComplete = step.complete && !isActive

          return (
            <button
              key={step.id}
              ref={isActive ? activeRef : undefined}
              type="button"
              onClick={() => handleTap(step.id)}
              className={`
                flex items-center gap-1.5 shrink-0 min-h-[44px] px-3 rounded-full
                transition-all duration-200 ease-out
                ${isActive
                  ? 'bg-mytra-purple/10 text-mytra-purple border border-mytra-purple'
                  : isComplete
                    ? 'bg-mytra-card text-fg-3 border border-mytra-border'
                    : 'bg-mytra-card text-fg-4 border border-mytra-border'
                }
              `}
            >
              {isComplete ? (
                <Check className="w-3.5 h-3.5 text-ok shrink-0" />
              ) : (
                <span className={`text-xs font-bold leading-none ${isActive ? 'text-mytra-purple' : 'text-fg-4'}`}>
                  {i + 1}
                </span>
              )}
              <span className="text-xs font-medium whitespace-nowrap">{step.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
