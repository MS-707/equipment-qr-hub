'use client'

import { useState } from 'react'
import { Users, BookOpen, Download, ExternalLink, FileText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { EquipmentItem, PRIORITY_COLORS } from '@/lib/types'
import { getTrainingProgramsForEquipment } from '@/lib/training'

interface TrainingInfoProps {
  equipment: EquipmentItem
}

function isDirectPdf(url: string): boolean {
  const lower = url.toLowerCase()
  return (
    lower.endsWith('.pdf') ||
    lower.includes('.pdf/') ||
    lower.includes('cdn2.ridgid.com/resources/media') ||
    lower.includes('/catalog/pdfImages/') ||
    lower.includes('jpw-assets') ||
    lower.includes('manuals.genielift.com') ||
    lower.includes('manuals.harborfreight.com') ||
    lower.includes('.ashx')
  )
}

export default function TrainingInfo({ equipment }: TrainingInfoProps) {
  const [showViewer, setShowViewer] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(true)
  const programs = getTrainingProgramsForEquipment(equipment.itemNumber)

  const hasManualUrl = equipment.manualUrl.trim() !== ''
  const isPdf = hasManualUrl && isDirectPdf(equipment.manualUrl)

  return (
    <div className="space-y-6">
      {/* OEM Manual */}
      {equipment.oemManual.trim() !== '' && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">
            Equipment Manual
          </h3>
          <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-gray-500 mt-0.5 shrink-0" />
              <p className="text-gray-300 text-sm leading-relaxed">
                {equipment.oemManual}
              </p>
            </div>

            {hasManualUrl && (
              <div className="flex flex-wrap gap-2 pt-1">
                {isPdf ? (
                  <>
                    <a
                      href={equipment.manualUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-mytra-purple hover:bg-mytra-purple/80
                                 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download PDF
                    </a>
                    <button
                      onClick={() => { setShowViewer(!showViewer); setPdfLoading(true) }}
                      className="inline-flex items-center gap-1.5 bg-mytra-card-hover hover:bg-mytra-border
                                 text-gray-300 text-xs font-medium px-3 py-1.5 rounded-lg
                                 border border-mytra-border transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {showViewer ? 'Hide' : 'View'} Manual
                      {showViewer ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </>
                ) : (
                  <a
                    href={equipment.manualUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-mytra-purple hover:bg-mytra-purple/80
                               text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View Manual
                  </a>
                )}
              </div>
            )}

            {!hasManualUrl && (
              <p className="text-gray-600 text-xs italic pt-1">
                Manual PDF pending — check equipment nameplate for model number
              </p>
            )}
          </div>

          {/* Embedded PDF Viewer */}
          {showViewer && isPdf && (
            <div className="mt-3 rounded-lg overflow-hidden border border-mytra-border relative">
              {pdfLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-mytra-card z-10">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400 mb-2" />
                  <p className="text-gray-400 text-xs">Loading manual...</p>
                </div>
              )}
              <iframe
                src={equipment.manualUrl}
                className="w-full bg-white rounded-lg"
                style={{ height: '70vh', minHeight: '400px' }}
                title={`${equipment.name} Equipment Manual`}
                sandbox="allow-same-origin allow-scripts"
                onLoad={() => setPdfLoading(false)}
              />
              <p className="text-gray-500 text-xs text-center py-2 bg-mytra-card">
                PDF not loading? Use the Download PDF button above to open directly.
              </p>
            </div>
          )}
        </div>
      )}

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

      {/* Authorized Operators */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">
          Authorized Operators
        </h3>
        <div className="bg-mytra-card border border-dashed border-mytra-border rounded-lg p-6
                        flex flex-col items-center justify-center gap-2 text-center">
          <Users className="w-6 h-6 text-gray-600" />
          <p className="text-gray-400 text-sm">
            Authorized operator list managed by EHS.
          </p>
          <p className="text-gray-500 text-xs">
            Contact your EHS coordinator for access or training questions.
          </p>
        </div>
      </div>
    </div>
  )
}
