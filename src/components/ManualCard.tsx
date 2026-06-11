'use client'

import { BookOpen, ExternalLink, FileText } from 'lucide-react'
import { EquipmentItem } from '@/lib/types'
import { stripRegCitations } from '@/lib/strip-citations'

interface ManualCardProps {
  equipment: EquipmentItem
}

export default function ManualCard({ equipment }: ManualCardProps) {
  const isPdf = equipment.manualType === 'pdf'
  const isWebpage = equipment.manualType === 'webpage'
  const hasManual = equipment.manualType !== 'none'
  const hasDescription = equipment.oemManual.trim() !== ''

  if (!hasDescription && !hasManual) return null

  return (
    <div className="bg-mytra-card border border-mytra-border rounded-lg overflow-hidden shadow-card animate-blurIn">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-fg-3 shrink-0" />
            <h3 className="text-sm font-semibold text-fg">OEM Manual</h3>
          </div>
          {hasManual && (
            <a
              href={equipment.manualUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-mytra-purple hover:bg-mytra-purple-hover
                         text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors
                         shadow-sm hover:shadow-md hover:shadow-mytra-purple/20 press-scale shrink-0"
            >
              {isPdf ? (
                <>
                  <FileText className="w-3.5 h-3.5" />
                  Open PDF
                </>
              ) : (
                <>
                  <ExternalLink className="w-3.5 h-3.5" />
                  {isWebpage ? 'View Online' : 'Open Manual'}
                </>
              )}
            </a>
          )}
        </div>

        {hasDescription && (
          <p className="text-fg-2 text-xs leading-relaxed">
            {stripRegCitations(equipment.oemManual)}
          </p>
        )}

        {!hasManual && hasDescription && (
          <p className="text-fg-4 text-xs italic">
            {equipment.name.toLowerCase().includes('custom')
              ? 'Custom-built — no OEM manual available. Refer to internal documentation.'
              : 'Manual not yet sourced — check equipment nameplate for model number.'}
          </p>
        )}
      </div>
    </div>
  )
}
