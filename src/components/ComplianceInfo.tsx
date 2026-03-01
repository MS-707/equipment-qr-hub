'use client'

import { useState } from 'react'
import { BookOpen, Download, ExternalLink, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { EquipmentItem } from '@/lib/types'

interface ComplianceInfoProps {
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

export default function ComplianceInfo({ equipment }: ComplianceInfoProps) {
  const [showViewer, setShowViewer] = useState(false)
  const [showRegulatory, setShowRegulatory] = useState(false)

  const calOshaSections = equipment.calOshaSections
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  const hasManualUrl = equipment.manualUrl.trim() !== ''
  const isPdf = hasManualUrl && isDirectPdf(equipment.manualUrl)

  return (
    <div className="space-y-6">
      {/* OEM Manual */}
      {equipment.oemManual.trim() !== '' && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">
            OEM Manual
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
                      onClick={() => setShowViewer(!showViewer)}
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
            <div className="mt-3 rounded-lg overflow-hidden border border-mytra-border">
              <iframe
                src={equipment.manualUrl}
                className="w-full bg-white rounded-lg"
                style={{ height: '70vh', minHeight: '400px' }}
                title={`${equipment.name} OEM Manual`}
                sandbox="allow-same-origin"
              />
              <p className="text-gray-600 text-xs text-center py-2 bg-mytra-card">
                PDF not loading? Use the Download PDF button above to open directly.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Regulatory Details (collapsible) */}
      {(calOshaSections.length > 0 || equipment.calOshaTrainingReq.trim() !== '') && (
        <div>
          <button
            onClick={() => setShowRegulatory(!showRegulatory)}
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
                  <p className="text-xs font-medium text-gray-500 mb-2">
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
                  <p className="text-xs font-medium text-gray-500 mb-2">
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
