'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { EquipmentItem } from '@/lib/types'

interface FrequencyConfig {
  key: keyof EquipmentItem
  label: string
}

const PM_FREQUENCIES: FrequencyConfig[] = [
  { key: 'pmDaily', label: 'Daily PM' },
  { key: 'pmWeekly', label: 'Weekly PM' },
  { key: 'pmMonthly', label: 'Monthly PM' },
  { key: 'pmQuarterly', label: 'Quarterly PM' },
  { key: 'pmSemiAnnual', label: 'Semi-Annual PM' },
  { key: 'pmAnnual', label: 'Annual PM' },
]

interface PMScheduleProps {
  equipment: EquipmentItem
}

export default function PMSchedule({ equipment }: PMScheduleProps) {
  // Find the first frequency that has content, to open it by default
  const firstNonEmptyIndex = PM_FREQUENCIES.findIndex(
    (f) => (equipment[f.key] as string).trim() !== ''
  )

  const [openIndex, setOpenIndex] = useState<number | null>(
    firstNonEmptyIndex >= 0 ? firstNonEmptyIndex : null
  )

  function parseTasks(raw: string): string[] {
    return raw
      .split(';')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
  }

  function toggleAccordion(idx: number) {
    setOpenIndex(openIndex === idx ? null : idx)
  }

  // Filter to only frequencies with content
  const activeFrequencies = PM_FREQUENCIES.map((f, originalIndex) => ({
    ...f,
    value: (equipment[f.key] as string).trim(),
    originalIndex,
  })).filter((f) => f.value !== '')

  return (
    <div className="space-y-4">
      {/* Key PM Summary */}
      {equipment.keyPmSummary.trim() !== '' && (
        <div className="bg-mytra-purple/10 border-l-4 border-mytra-purple rounded-r-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-1">Key PM Summary</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            {equipment.keyPmSummary}
          </p>
        </div>
      )}

      {/* PM Frequency Accordions */}
      <div className="space-y-2">
        {activeFrequencies.map((freq) => {
          const tasks = parseTasks(freq.value)
          const isOpen = openIndex === freq.originalIndex

          return (
            <div
              key={freq.key}
              className="bg-mytra-card border border-mytra-border rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggleAccordion(freq.originalIndex)}
                className="w-full flex items-center justify-between px-4 py-3
                           hover:bg-mytra-card-hover transition-colors duration-150"
              >
                <div className="flex items-center gap-3">
                  <span className="text-white font-medium text-sm">
                    {freq.label}
                  </span>
                  <span className="text-xs text-gray-500 bg-mytra-bg px-2 py-0.5 rounded-full">
                    {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                  </span>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 border-t border-mytra-border">
                  <ul className="mt-3 space-y-2">
                    {tasks.map((task, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-gray-300"
                      >
                        <span className="text-gray-600 mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-gray-600" />
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {activeFrequencies.length === 0 && (
        <p className="text-gray-500 text-sm">
          No PM schedule data available for this equipment.
        </p>
      )}
    </div>
  )
}
