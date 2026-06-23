'use client'

import Link from 'next/link'
import { Star, Phone } from 'lucide-react'
import type { SdsRecord } from '@/lib/sds-types'
import { SIGNAL_WORD_STYLES } from '@/lib/sds-types'
import GhsPictogram from './GhsPictogram'

interface SdsCardProps {
  record: SdsRecord
  onToggleFavorite: (id: string) => void
  index: number
}

export default function SdsCard({ record, onToggleFavorite, index }: SdsCardProps) {
  const signalColor = SIGNAL_WORD_STYLES[record.signalWord]

  return (
    <div
      className="bg-mytra-card border border-mytra-border rounded-card p-4 shadow-card
                 transition-colors duration-200 animate-blurIn"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="flex items-start gap-3">
        <Link
          href={`/sds/${record.id}`}
          className="min-w-0 flex-1 press-scale"
        >
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {record.signalWord !== 'None' && (
              <span
                className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `color-mix(in srgb, ${signalColor} 15%, transparent)`, color: signalColor }}
              >
                {record.signalWord}
              </span>
            )}
            {record.ppeRequired.length > 0 && (
              <span className="text-xs text-fg-4">
                {record.ppeRequired.length} PPE
              </span>
            )}
          </div>

          <p className="text-sm font-medium text-fg leading-snug mb-0.5">
            {record.productName}
          </p>
          <p className="text-xs text-fg-3 truncate">
            {record.manufacturer}
            {record.casNumbers.length > 0 && ` · CAS ${record.casNumbers[0]}`}
          </p>

          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {record.pictograms.slice(0, 5).map((code) => (
              <GhsPictogram key={code} code={code} size={24} />
            ))}
            {record.pictograms.length > 5 && (
              <span className="text-xs text-fg-4 ml-1">
                +{record.pictograms.length - 5}
              </span>
            )}
          </div>
        </Link>

        <div className="shrink-0 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              onToggleFavorite(record.id)
            }}
            aria-label={record.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center
                       text-fg-4 hover:text-warn transition-colors"
          >
            <Star
              className={`w-5 h-5 ${record.isFavorite ? 'fill-warn text-warn' : ''}`}
            />
          </button>
          {record.emergencyPhone && (
            <a
              href={`tel:${record.emergencyPhone}`}
              aria-label={`Call emergency: ${record.emergencyPhone}`}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center
                         text-fg-4 hover:text-danger transition-colors"
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
