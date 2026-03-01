'use client'

import { Users } from 'lucide-react'
import { EquipmentItem, PRIORITY_COLORS } from '@/lib/types'
import { getTrainingProgramsForEquipment } from '@/lib/training'

interface TrainingInfoProps {
  equipment: EquipmentItem
}

export default function TrainingInfo({ equipment }: TrainingInfoProps) {
  const programs = getTrainingProgramsForEquipment(equipment.itemNumber)

  return (
    <div className="space-y-6">
      {/* Required Training Programs */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">
          Required Training Programs
        </h3>
        {programs.length > 0 ? (
          <div className="space-y-2">
            {programs.map((program) => {
              const priorityColor = PRIORITY_COLORS[program.priorityLevel]
              return (
                <div
                  key={program.programId}
                  className="bg-mytra-card border border-mytra-border rounded-lg p-4
                             flex flex-col gap-2"
                  style={{ borderLeftWidth: '3px', borderLeftColor: priorityColor }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-xs font-mono font-semibold px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: `${priorityColor}18`,
                          color: priorityColor,
                        }}
                      >
                        {program.programId}
                      </span>
                      <span className="text-white font-medium text-sm">
                        {program.title}
                      </span>
                    </div>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: `${priorityColor}18`,
                        color: priorityColor,
                      }}
                    >
                      {program.priorityLevel}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-400">
                      {program.durationHours} {program.durationHours === 1 ? 'hour' : 'hours'}
                    </span>
                    <span className="text-gray-600">|</span>
                    <span className="text-gray-400">{program.frequency}</span>
                  </div>
                  <p className="text-gray-500 text-xs">{program.deliveryMethod}</p>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-mytra-card border border-mytra-border rounded-lg p-4">
            <p className="text-gray-500 text-sm">
              No specific training programs linked to this equipment.
            </p>
          </div>
        )}
      </div>

      {/* Cal/OSHA Training Requirements */}
      {equipment.calOshaTrainingReq.trim() !== '' && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">
            Regulatory Training Requirements
          </h3>
          <div className="bg-mytra-card border border-mytra-border rounded-lg p-4">
            <p className="text-gray-300 text-sm leading-relaxed">
              {equipment.calOshaTrainingReq}
            </p>
          </div>
        </div>
      )}

      {/* Authorized Operators */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">
          Authorized Operators
        </h3>
        <div className="bg-mytra-card border border-dashed border-mytra-border rounded-lg p-6
                        flex flex-col items-center justify-center gap-2 text-center">
          <Users className="w-6 h-6 text-gray-600" />
          <p className="text-gray-500 text-sm">
            Connect to Notion to view authorized operators and training records.
          </p>
        </div>
      </div>
    </div>
  )
}
