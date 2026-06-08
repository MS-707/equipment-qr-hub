'use client'

import { HelpCircle } from 'lucide-react'
import { START_TOUR_EVENT } from '@/components/onboarding/OnboardingTour'

export default function HelpButton() {
  return (
    <button
      type="button"
      aria-label="Replay app tour"
      title="App tour"
      onClick={() => window.dispatchEvent(new Event(START_TOUR_EVENT))}
      className="w-9 h-9 flex items-center justify-center rounded-lg text-fg-3
                 hover:text-fg hover:bg-mytra-card-hover transition-colors"
    >
      <HelpCircle className="w-5 h-5" />
    </button>
  )
}
