'use client'

import Link from 'next/link'
import { Star } from 'lucide-react'
import type { SdsRecord } from '@/lib/sds-types'
import { SIGNAL_WORD_STYLES } from '@/lib/sds-types'
import GhsPictogram from './GhsPictogram'

interface SdsFavoritesProps {
  favorites: SdsRecord[]
}

export default function SdsFavorites({ favorites }: SdsFavoritesProps) {
  if (favorites.length === 0) return null

  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider text-fg-3 font-semibold mb-2 px-1 flex items-center gap-1.5">
        <Star className="w-3.5 h-3.5 fill-warn text-warn" />
        Favorites
      </h2>
      <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
        {favorites.map((r) => {
          const signalColor = SIGNAL_WORD_STYLES[r.signalWord]
          return (
            <Link
              key={r.id}
              href={`/sds/${r.id}`}
              className="shrink-0 w-[160px] bg-mytra-card border border-mytra-border rounded-card p-3 shadow-card
                         hover:bg-mytra-card-hover hover:shadow-raised
                         transition-colors duration-200 press-scale"
            >
              <div className="flex items-center gap-1 mb-1.5">
                {r.pictograms.slice(0, 3).map((code) => (
                  <GhsPictogram key={code} code={code} size={18} />
                ))}
              </div>
              <p className="text-xs font-medium text-fg leading-snug line-clamp-2 mb-1">
                {r.productName}
              </p>
              {r.signalWord !== 'None' && (
                <span
                  className="inline-block text-xs font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: `color-mix(in srgb, ${signalColor} 15%, transparent)`, color: signalColor }}
                >
                  {r.signalWord}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
