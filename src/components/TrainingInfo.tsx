'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Users, BookOpen, Download, ExternalLink, FileText, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { EquipmentItem } from '@/lib/types'
import { stripRegCitations } from '@/lib/strip-citations'

interface TrainingInfoProps {
  equipment: EquipmentItem
}

type ViewerMode = 'direct' | 'google' | 'failed'

export default function TrainingInfo({ equipment }: TrainingInfoProps) {
  const [showViewer, setShowViewer] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(true)
  const [viewerMode, setViewerMode] = useState<ViewerMode>('direct')
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const startViewer = useCallback(() => {
    setPdfLoading(true)
    setViewerMode('direct')
  }, [])

  useEffect(() => {
    if (!showViewer || !pdfLoading) {
      clearTimeout(fallbackTimerRef.current)
      return
    }
    if (viewerMode === 'direct') {
      fallbackTimerRef.current = setTimeout(() => {
        setViewerMode('google')
        setPdfLoading(true)
      }, 6000)
    } else if (viewerMode === 'google') {
      fallbackTimerRef.current = setTimeout(() => {
        setViewerMode('failed')
        setPdfLoading(false)
      }, 12000)
    }
    return () => clearTimeout(fallbackTimerRef.current)
  }, [showViewer, pdfLoading, viewerMode])

  const isPdf = equipment.manualType === 'pdf'
  const hasManual = equipment.manualType !== 'none'

  const viewerSrc = viewerMode === 'direct'
    ? equipment.manualUrl
    : `https://docs.google.com/gview?url=${encodeURIComponent(equipment.manualUrl)}&embedded=true`

  return (
    <div className="space-y-6">
      {/* OEM Manual */}
      {equipment.oemManual.trim() !== '' && (
        <div>
          <h3 className="text-sm font-semibold text-fg mb-3">
            Equipment Manual
          </h3>
          <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-fg-3 mt-0.5 shrink-0" />
              <p className="text-fg-2 text-sm leading-relaxed">
                {stripRegCitations(equipment.oemManual)}
              </p>
            </div>

            {hasManual && (
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
                      onClick={() => { setShowViewer(!showViewer); startViewer() }}
                      className="inline-flex items-center gap-1.5 bg-mytra-card-hover hover:bg-mytra-border
                                 text-fg-2 text-xs font-medium px-3 py-1.5 rounded-lg
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

            {!hasManual && (
              <p className="text-fg-4 text-xs italic pt-1">
                {equipment.name.toLowerCase().includes('custom')
                  ? 'Custom-built equipment — no OEM manual available. Refer to internal documentation.'
                  : 'Manual PDF pending — check equipment nameplate for model number.'}
              </p>
            )}
          </div>

          {showViewer && isPdf && (
            <div className="mt-3 rounded-lg overflow-hidden border border-mytra-border relative">
              {pdfLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-mytra-card z-10">
                  <div className="w-full h-full p-6 space-y-3">
                    <div className="h-4 bg-mytra-border rounded animate-pulse w-3/4" />
                    <div className="h-4 bg-mytra-border rounded animate-pulse w-full" />
                    <div className="h-4 bg-mytra-border rounded animate-pulse w-5/6" />
                    <div className="h-4 bg-mytra-border rounded animate-pulse w-2/3" />
                    <div className="h-4 bg-mytra-border rounded animate-pulse w-full" />
                    <div className="h-4 bg-mytra-border rounded animate-pulse w-4/5" />
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-fg-3 text-xs">
                      {viewerMode === 'direct' ? 'Loading manual...' : 'Trying alternate viewer...'}
                    </p>
                  </div>
                </div>
              )}

              {viewerMode === 'failed' ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 bg-mytra-card">
                  <FileText className="w-10 h-10 text-fg-4 mb-3" />
                  <p className="text-fg-2 text-sm font-medium mb-1">PDF too large to preview inline</p>
                  <p className="text-fg-3 text-xs mb-4">This file exceeds the embedded viewer limit.</p>
                  <div className="flex gap-2">
                    <a
                      href={equipment.manualUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-mytra-purple hover:bg-mytra-purple/80
                                 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open in new tab
                    </a>
                    <button
                      onClick={startViewer}
                      className="inline-flex items-center gap-1.5 bg-mytra-card-hover hover:bg-mytra-border
                                 text-fg-2 text-xs font-medium px-4 py-2 rounded-lg
                                 border border-mytra-border transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <iframe
                    key={viewerMode}
                    src={viewerSrc}
                    className={`w-full bg-white rounded-lg h-[50vh] sm:h-[70vh] min-h-[300px] sm:min-h-[400px]
                               ${pdfLoading ? 'opacity-0' : 'animate-fadeIn'}`}
                    title={`${equipment.name} Equipment Manual`}
                    onLoad={() => { setPdfLoading(false); clearTimeout(fallbackTimerRef.current) }}
                  />
                  <p className="text-fg-4 text-xs text-center py-2 bg-mytra-card">
                    PDF not loading? Use the Download PDF button above to open directly.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* EHS Support */}
      <div>
        <h3 className="text-sm font-semibold text-fg mb-3">
          EHS Support
        </h3>
        <div className="bg-mytra-card border border-mytra-border rounded-lg p-4
                        flex items-start gap-3">
          <Users className="w-5 h-5 text-fg-3 mt-0.5 shrink-0" />
          <div>
            <p className="text-fg-2 text-sm">
              Have questions about this equipment or need training?
            </p>
            <p className="text-fg-3 text-xs mt-1">
              Reach out to your EHS coordinator — we&apos;re here to help.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
