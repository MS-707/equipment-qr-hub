'use client'

import type { GhsPictogramCode } from '@/lib/sds-types'
import { GHS_PICTOGRAM_LABELS } from '@/lib/sds-types'
import GhsPictogram from './GhsPictogram'

const GHS_CODES: GhsPictogramCode[] = [
  'GHS01', 'GHS02', 'GHS03', 'GHS04', 'GHS05',
  'GHS06', 'GHS07', 'GHS08', 'GHS09',
]

interface GhsFilterChipsProps {
  selected: Set<GhsPictogramCode>
  onToggle: (code: GhsPictogramCode) => void
  counts: Record<GhsPictogramCode, number>
}

export default function GhsFilterChips({ selected, onToggle, counts }: GhsFilterChipsProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
      {GHS_CODES.map((code) => {
        const active = selected.has(code)
        const count = counts[code] || 0
        return (
          <button
            key={code}
            type="button"
            onClick={() => onToggle(code)}
            aria-pressed={active}
            title={GHS_PICTOGRAM_LABELS[code]}
            className={`shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-2 rounded-full
                        border transition-colors min-h-[44px] ${
              active
                ? 'bg-mytra-purple/15 text-mytra-purple border-mytra-purple'
                : 'bg-mytra-bg text-fg-2 border-mytra-border hover:text-fg'
            }`}
          >
            <GhsPictogram code={code} size={20} />
            <span className="whitespace-nowrap">
              {GHS_PICTOGRAM_LABELS[code]}
              {count > 0 && <span className="text-fg-4 ml-0.5">({count})</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
