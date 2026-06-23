'use client'

import type { GhsPictogramCode } from '@/lib/sds-types'
import { GHS_PICTOGRAM_LABELS } from '@/lib/sds-types'

interface GhsPictogramProps {
  code: GhsPictogramCode
  size?: number
  className?: string
}

export default function GhsPictogram({ code, size = 28, className = '' }: GhsPictogramProps) {
  return (
    <svg
      width={size}
      height={size}
      aria-label={GHS_PICTOGRAM_LABELS[code]}
      role="img"
      className={className}
    >
      <use href={`/sds/ghs-sprites.svg#${code}`} />
    </svg>
  )
}
