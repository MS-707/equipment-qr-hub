'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ClipboardCheck, BookOpen } from 'lucide-react'
import ModuleTourButton from '@/components/onboarding/ModuleTourButton'
import { getAllEquipment } from '@/lib/equipment'
import { getLastEquipmentId } from '@/lib/inspections'
import { requiresPreTrip, INSPECTION_CATEGORIES, EquipmentItem } from '@/lib/types'
import PreTripInspection from '@/components/PreTripInspection'

export default function InspectionsPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)

  // Get inspectable equipment grouped by category
  const inspectableUnits = useMemo(() => {
    return getAllEquipment().filter(requiresPreTrip)
  }, [])

  const grouped = useMemo(() => {
    const groups: Record<string, EquipmentItem[]> = {}
    for (const cat of INSPECTION_CATEGORIES) {
      const items = inspectableUnits.filter((e) => e.category === cat)
      if (items.length > 0) groups[cat] = items
    }
    return groups
  }, [inspectableUnits])

  // Pre-select last-used equipment on mount
  useEffect(() => {
    const lastId = getLastEquipmentId()
    if (lastId && inspectableUnits.some((e) => e.itemNumber === lastId)) {
      setSelectedId(lastId)
    } else if (inspectableUnits.length > 0) {
      setSelectedId(inspectableUnits[0].itemNumber)
    }
    setMounted(true)
  }, [inspectableUnits])

  const selectedEquipment = inspectableUnits.find((e) => e.itemNumber === selectedId)

  if (!mounted) return null

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-fadeIn">
      {/* Page header */}
      <div className="flex items-center gap-2.5 mb-6">
        <ClipboardCheck className="w-6 h-6 text-mytra-purple" />
        <h1 className="text-xl font-bold text-fg">Pre-Trip Inspections</h1>
        <ModuleTourButton tourId="inspections" />
      </div>

      {/* Equipment selector */}
      <div data-tour-module="equip-dropdown" className="mb-6">
        <label htmlFor="equipment-select" className="block text-xs text-fg-3 mb-1.5">
          Select Equipment
        </label>
        <select
          id="equipment-select"
          value={selectedId ?? ''}
          onChange={(e) => setSelectedId(parseInt(e.target.value, 10))}
          className="w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3
                     text-sm text-fg
                     focus:outline-none focus:ring-2 focus:ring-mytra-purple focus:border-transparent
                     appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22%239CA3AF%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20d%3D%22M7%2010l5%205%205-5z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
        >
          {Object.entries(grouped).map(([category, items]) => (
            <optgroup key={category} label={category}>
              {items.map((eq) => (
                <option key={eq.itemNumber} value={eq.itemNumber}>
                  {eq.name}
                  {eq.status !== 'Active' ? ` (${eq.status})` : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Operator manual link */}
      {selectedEquipment && (
        <Link
          href={`/equipment/${selectedEquipment.itemNumber}?tab=training`}
          data-tour-module="equip-manuals"
          className="flex items-center gap-2 mb-6 px-3 py-2.5 rounded-lg text-xs text-fg-3
                     bg-mytra-card border border-mytra-border hover:text-fg hover:bg-mytra-card-hover
                     transition-colors"
        >
          <BookOpen className="w-4 h-4 shrink-0" />
          <span>View operator manual & training info for <span className="text-fg font-medium">{selectedEquipment.name}</span></span>
        </Link>
      )}

      {/* Inspection form */}
      {selectedEquipment && (
        <PreTripInspection key={selectedId} equipment={selectedEquipment} />
      )}
    </div>
  )
}
