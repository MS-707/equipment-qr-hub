'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { EquipmentItem } from '@/lib/types'

interface ComplianceInfoProps {
  equipment: EquipmentItem
}

export default function ComplianceInfo({ equipment }: ComplianceInfoProps) {
  const [showRegulatory, setShowRegulatory] = useState(false)

  const calOshaSections = equipment.calOshaSections
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  return (
    <div className="space-y-6">
      {/* Maintenance Dates */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">
          Maintenance Dates
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-mytra-card border border-mytra-border rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-1">Last PM Date</p>
            <p
              className={`text-sm font-medium ${
                equipment.lastPmDate ? 'text-white' : 'text-gray-600'
              }`}
            >
              {equipment.lastPmDate || 'Not tracked yet'}
            </p>
          </div>
          <div className="bg-mytra-card border border-mytra-border rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-1">Next PM Due</p>
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

      {/* Regulatory Details (collapsible) */}
      {(calOshaSections.length > 0 || equipment.calOshaTrainingReq.trim() !== '') && (
        <div>
          <button
            onClick={() => setShowRegulatory(!showRegulatory)}
            aria-expanded={showRegulatory}
            className="flex items-center gap-2 text-sm font-semibold text-gray-400
                       hover:text-white transition-colors w-full"
          >
            {showRegulatory ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            Regulatory Details
          </button>

          {showRegulatory && (
            <div className="mt-3 space-y-4">
              {calOshaSections.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-2">
                    Applicable Cal/OSHA Sections
                  </p>
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

              {equipment.calOshaTrainingReq.trim() !== '' && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-2">
                    Regulatory Training Requirements
                  </p>
                  <div className="bg-mytra-card border border-mytra-border rounded-lg p-4">
                    <p className="text-gray-300 text-sm leading-relaxed">
                      {equipment.calOshaTrainingReq}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
