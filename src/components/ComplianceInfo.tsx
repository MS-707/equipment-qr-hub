'use client'

import { BookOpen } from 'lucide-react'
import { EquipmentItem } from '@/lib/types'

interface ComplianceInfoProps {
  equipment: EquipmentItem
}

export default function ComplianceInfo({ equipment }: ComplianceInfoProps) {
  const calOshaSections = equipment.calOshaSections
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  return (
    <div className="space-y-6">
      {/* OEM Manual */}
      {equipment.oemManual.trim() !== '' && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">
            OEM Manual Reference
          </h3>
          <div className="bg-mytra-card border border-mytra-border rounded-lg p-4
                          flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-gray-500 mt-0.5 shrink-0" />
            <p className="text-gray-300 text-sm leading-relaxed">
              {equipment.oemManual}
            </p>
          </div>
        </div>
      )}

      {/* Cal/OSHA Sections */}
      {calOshaSections.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">
            Applicable Cal/OSHA Sections
          </h3>
          <div className="flex flex-wrap gap-2">
            {calOshaSections.map((section, i) => (
              <span
                key={i}
                className="inline-block bg-mytra-card border border-mytra-border
                           rounded-full px-3 py-1 text-xs text-gray-300"
              >
                {section}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Key PM Summary */}
      {equipment.keyPmSummary.trim() !== '' && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">
            Key PM Tasks Summary
          </h3>
          <div className="bg-mytra-card border border-mytra-border rounded-lg p-4">
            <p className="text-gray-300 text-sm leading-relaxed">
              {equipment.keyPmSummary}
            </p>
          </div>
        </div>
      )}

      {/* Maintenance Dates */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">
          Maintenance Dates
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-mytra-card border border-mytra-border rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Last PM Date</p>
            <p
              className={`text-sm font-medium ${
                equipment.lastPmDate ? 'text-white' : 'text-gray-600'
              }`}
            >
              {equipment.lastPmDate || 'Not tracked yet'}
            </p>
          </div>
          <div className="bg-mytra-card border border-mytra-border rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Next PM Due</p>
            <p
              className={`text-sm font-medium ${
                equipment.nextPmDue ? 'text-white' : 'text-gray-600'
              }`}
            >
              {equipment.nextPmDue || 'Not tracked yet'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
