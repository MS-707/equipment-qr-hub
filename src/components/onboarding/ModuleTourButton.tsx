'use client'

import { GraduationCap } from 'lucide-react'
import { MODULE_TOUR_EVENT } from './ModuleTourEngine'
import { isTourSeen } from '@/lib/tourState'

interface ModuleTourButtonProps {
  tourId: string
}

export default function ModuleTourButton({ tourId }: ModuleTourButtonProps) {
  const seen = typeof window !== 'undefined' ? isTourSeen(tourId) : true

  return (
    <button
      type="button"
      aria-label="Take a tour of this page"
      title="Page tour"
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent(MODULE_TOUR_EVENT, { detail: { tourId } })
        )
      }
      className="inline-flex items-center gap-1 text-xs font-medium text-fg-3
                 hover:text-fg hover:bg-mytra-card-hover rounded-lg px-2 py-1.5
                 transition-colors min-h-[32px]"
    >
      <GraduationCap className={`w-4 h-4 ${!seen ? 'animate-pulse text-mytra-purple' : ''}`} />
      <span className="hidden sm:inline">Tour</span>
    </button>
  )
}
