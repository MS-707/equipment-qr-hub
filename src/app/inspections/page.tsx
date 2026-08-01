'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ClipboardCheck, BookOpen, Download } from 'lucide-react'
import ModuleTourButton from '@/components/onboarding/ModuleTourButton'
import { getAllEquipment } from '@/lib/equipment'
import { getLastEquipmentId, getAllInspections, exportInspectionsToCsv, onInspectionChange } from '@/lib/inspections'
import { requiresPreTrip, INSPECTION_CATEGORIES, EquipmentItem } from '@/lib/types'
import PreTripInspection from '@/components/PreTripInspection'
import { useT } from '@/lib/i18n'

export default function InspectionsPage() {
  const t = useT()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const [inspectionCount, setInspectionCount] = useState(0)

  // Track record count so the export button reflects reality
  useEffect(() => {
    const refresh = () => setInspectionCount(getAllInspections().length)
    refresh()
    return onInspectionChange(refresh)
  }, [])

  function handleExportCsv() {
    const records = getAllInspections()
    if (records.length === 0) return
    const csv = exportInspectionsToCsv(records)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inspections-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

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

  // Rich-text interpolation: split the template around a sentinel so the
  // styled <span> around the equipment name stays a real element.
  const manualLinkParts = t('inspect.viewOperatorManual', { name: '\u0000' }, 'View operator manual & training info for {name}').split('\u0000')

  if (!mounted) return null

  return (
    <main id="main" className="contents">
    <div className="max-w-2xl mx-auto px-4 py-6 animate-fadeIn">
      {/* Page header */}
      <div className="flex items-center gap-2.5 mb-6">
        <ClipboardCheck className="w-6 h-6 text-mytra-purple" />
        <h1 className="text-xl font-bold text-fg">{t('inspect.pageTitle', undefined, 'Pre-Trip Inspections')}</h1>
        <ModuleTourButton tourId="inspections" />
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={inspectionCount === 0}
          title={inspectionCount === 0 ? t('inspect.noInspectionsYetTitle', undefined, 'No inspections recorded yet') : t('inspect.exportCsvTitle', { count: inspectionCount })}
          aria-label={t('inspect.exportCsvAria', undefined, 'Export inspections as CSV')}
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium rounded-lg px-2 py-1.5
                     min-h-[44px] text-fg-3 hover:text-fg hover:bg-mytra-card-hover transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">{t('inspect.exportCsv', undefined, 'Export CSV')}</span>
        </button>
      </div>

      {/* Equipment selector */}
      <div data-tour-module="equip-dropdown" className="mb-6">
        <label htmlFor="equipment-select" className="block text-xs text-fg-3 mb-1.5">
          {t('inspect.selectEquipmentLabel', undefined, 'Select Equipment')}
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
                  {eq.status !== 'Active'
                    ? t('inspect.equipmentOptionWithStatus', { name: eq.name, status: eq.status }, '{name} ({status})')
                    : eq.name}
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
          <span>{manualLinkParts[0]}<span className="text-fg font-medium">{selectedEquipment.name}</span>{manualLinkParts[1]}</span>
        </Link>
      )}

      {/* Inspection form */}
      {selectedEquipment && (
        <PreTripInspection key={selectedId} equipment={selectedEquipment} />
      )}
    </div>
    </main>
  )
}
