'use client'

import { useState, useEffect } from 'react'
import { GraduationCap } from 'lucide-react'
import { requestModuleTour, TOUR_ENDED_EVENT } from './ModuleTourEngine'
import { isTourSeen } from '@/lib/tourState'

interface ModuleTourButtonProps {
  tourId: string
}

export default function ModuleTourButton({ tourId }: ModuleTourButtonProps) {
  // Resolved post-mount: computing this during render leaves the
  // server-rendered (always "seen") class stuck after hydration.
  const [seen, setSeen] = useState(true)

  useEffect(() => {
    const update = () => setSeen(isTourSeen(tourId))
    update()
    window.addEventListener(TOUR_ENDED_EVENT, update)
    return () => window.removeEventListener(TOUR_ENDED_EVENT, update)
  }, [tourId])

  return (
    <button
      type="button"
      aria-label="Take a tour of this page"
      title="Page tour"
      onClick={() => requestModuleTour(tourId)}
      className={`inline-flex items-center gap-1 text-xs font-medium rounded-lg px-2 py-1.5
                 transition-colors min-h-[32px] ${
        !seen
          ? 'text-mytra-purple animate-pulse'
          : 'text-fg-3 hover:text-fg hover:bg-mytra-card-hover'
      }`}
    >
      <GraduationCap className="w-4 h-4" />
      <span className="hidden sm:inline">Tour</span>
    </button>
  )
}
