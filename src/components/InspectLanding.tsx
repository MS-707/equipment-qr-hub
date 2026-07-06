'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ClipboardCheck, ChevronRight } from 'lucide-react'
import { EquipmentItem, EquipmentStatus, EQUIPMENT_STATUS_COLORS, CATEGORY_COLORS } from '@/lib/types'
import { getEquipmentById } from '@/lib/equipment'
import PreTripInspection from '@/components/PreTripInspection'

/**
 * Focused landing for QR-initiated pre-trip inspections: the scanned unit's
 * identity up top, the inspection flow immediately below, nothing else
 * competing for attention. A quiet link out to the full profile for anyone
 * who scanned wanting specs instead.
 */
export default function InspectLanding({ equipment }: { equipment: EquipmentItem }) {
  const [status, setStatus] = useState<EquipmentStatus>(equipment.status)
  const categoryColor = CATEGORY_COLORS[equipment.category]
  const statusColor = EQUIPMENT_STATUS_COLORS[status]

  function handleStatusChange() {
    const updated = getEquipmentById(equipment.itemNumber)
    if (updated) setStatus(updated.status)
  }

  return (
    <main id="main" className="min-h-screen bg-mytra-bg">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-5 animate-blurIn">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-mytra-purple/15 text-mytra-purple"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              Pre-Trip Inspection
            </span>
            <span
              className="inline-block text-xs font-medium px-2.5 py-0.5 rounded-full text-fg-2"
              style={{ backgroundColor: `${categoryColor}18` }}
            >
              {equipment.category}
            </span>
            <span
              className="inline-block text-xs font-medium px-2.5 py-0.5 rounded-full text-fg-2"
              style={{ backgroundColor: `${statusColor}18` }}
            >
              {status}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-fg leading-tight">{equipment.name}</h1>
          <p className="text-xs text-fg-3 mt-1">Item #{equipment.itemNumber}{equipment.location ? ` · ${equipment.location}` : ''}</p>
        </div>

        {status === 'Out of Service' && (
          <div className="mb-5 bg-danger/10 border border-danger/30 rounded-lg px-4 py-3">
            <p className="text-sm font-semibold text-danger-strong">
              This unit is OUT OF SERVICE. Do not operate. Contact maintenance or your supervisor.
            </p>
          </div>
        )}

        <PreTripInspection equipment={equipment} onStatusChange={handleStatusChange} />

        <Link
          href={`/equipment/${equipment.itemNumber}`}
          className="mt-6 flex items-center justify-between gap-2 px-4 py-3 min-h-[44px] rounded-card
                     bg-mytra-card border border-mytra-border text-sm text-fg-3 hover:text-fg
                     hover:bg-mytra-card-hover transition-colors"
        >
          <span>Full equipment profile — training, PM schedule, compliance</span>
          <ChevronRight className="w-4 h-4 shrink-0" />
        </Link>
      </div>
    </main>
  )
}
