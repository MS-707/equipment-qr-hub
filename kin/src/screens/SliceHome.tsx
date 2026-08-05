import { ChevronRight, ClipboardCheck } from 'lucide-react'
import { getAllEquipment } from '@/lib/equipment'
import { CATEGORY_COLORS, EQUIPMENT_STATUS_COLORS, requiresPreTrip } from '@/lib/types'
import Link from '../shims/next-link'

/**
 * Index for the slice: exactly the units that require a pre-trip, each linking
 * into its inspection flow. Same source and same filter the Next app uses to
 * decide which /inspect/[id] pages exist (src/app/inspect/[id]/page.tsx
 * generateStaticParams), so the two lists cannot drift.
 *
 * getAllEquipment() reads src/data/equipment.ts and layers the locally stored
 * status overrides on top — the same seed the D1 equipment table was built
 * from in KIN-M0-T3.
 */
export default function SliceHome() {
  const units = getAllEquipment().filter(requiresPreTrip)

  return (
    <main id="main" className="min-h-screen bg-mytra-bg">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-mytra-purple/15 text-mytra-purple">
            <ClipboardCheck className="w-3.5 h-3.5" aria-hidden="true" />
            Pre-Trip Inspection
          </span>
          <h1 className="mt-2 text-xl font-bold text-fg leading-tight">Select equipment</h1>
          <p className="mt-1 text-sm text-fg-3">
            Scanning a unit&rsquo;s QR label opens its inspection directly. This list is here for
            anyone without a label in front of them.
          </p>
        </div>

        {units.length === 0 ? (
          <p className="text-sm text-fg-3">No units require a pre-trip inspection.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {units.map((unit) => (
              <li key={unit.itemNumber}>
                <Link
                  href={`/inspect/${unit.itemNumber}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 min-h-[44px] rounded-card
                             bg-mytra-card border border-mytra-border hover:bg-mytra-card-hover
                             transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-fg truncate">{unit.name}</span>
                    <span className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span
                        className="inline-block text-xs font-medium px-2 py-0.5 rounded-full text-fg-2"
                        style={{ backgroundColor: `${CATEGORY_COLORS[unit.category]}18` }}
                      >
                        {unit.category}
                      </span>
                      <span
                        className="inline-block text-xs font-medium px-2 py-0.5 rounded-full text-fg-2"
                        style={{ backgroundColor: `${EQUIPMENT_STATUS_COLORS[unit.status]}18` }}
                      >
                        {unit.status}
                      </span>
                      <span className="text-xs text-fg-4">Item #{unit.itemNumber}</span>
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0 text-fg-3" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
