'use client'

import { useEffect, useCallback } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { useT } from '@/lib/i18n'

export interface ValidationError {
  label: string
  fieldId: string
}

export interface ValidationSummaryProps {
  errors: ValidationError[]
  show: boolean
  onDismiss: () => void
}

export default function ValidationSummary({ errors, show, onDismiss }: ValidationSummaryProps) {
  const t = useT()
  useEffect(() => {
    if (errors.length === 0) onDismiss()
  }, [errors.length, onDismiss])

  const handleTap = useCallback((fieldId: string) => {
    const el = document.getElementById(fieldId)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => {
      document.getElementById(fieldId)?.focus()
    }, 250)
  }, [])

  if (!show || errors.length === 0) return null

  return (
    <div className="animate-fadeInUp bg-warn/10 border border-warn/30 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-warn">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-sm font-semibold">
            {t('forms.needsAttention', { count: errors.length })}
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="p-1.5 rounded-md text-fg-3 hover:text-fg-2 hover:bg-warn/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label={t('common.dismiss', undefined, 'Dismiss')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <ul className="space-y-0.5">
        {errors.map((error) => (
          <li key={error.fieldId}>
            <button
              type="button"
              onClick={() => handleTap(error.fieldId)}
              className="w-full flex items-center gap-2.5 min-h-[44px] px-2 rounded text-sm text-fg hover:bg-warn/10 active:bg-warn/15 transition-colors text-left"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-warn shrink-0" />
              <span>{error.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
