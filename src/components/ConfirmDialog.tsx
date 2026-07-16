'use client'

import { useRef, useEffect, useState, useId } from 'react'
import { haptic } from '@/lib/haptic'
import { btnPrimaryCls } from '@/lib/form-styles'
import { useT } from '@/lib/i18n'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  inputPrompt?: string
  onConfirm: (inputValue?: string) => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  inputPrompt,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const t = useT()
  const confirmText = confirmLabel ?? t('confirm.confirm', undefined, 'Confirm')
  const cancelText = cancelLabel ?? t('confirm.cancel', undefined, 'Cancel')
  const ref = useRef<HTMLDialogElement>(null)
  const [inputValue, setInputValue] = useState('')
  const titleId = useId()
  const messageId = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      setInputValue('')
      el.showModal()
    } else if (!open && el.open) {
      el.close()
    }
  }, [open])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    function handleCancel(e: Event) {
      e.preventDefault()
      onCancel()
    }
    el.addEventListener('cancel', handleCancel)
    return () => el.removeEventListener('cancel', handleCancel)
  }, [onCancel])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      className="backdrop:bg-black/60 bg-mytra-card border border-mytra-border rounded-2xl
                 shadow-pop p-6 max-w-sm w-[calc(100%-2rem)] animate-scaleIn
                 text-fg outline-none"
    >
      <h2 id={titleId} className="text-base font-semibold text-fg mb-1">{title}</h2>
      <p id={messageId} className="text-sm text-fg-2 mb-4">{message}</p>

      {inputPrompt && (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={inputPrompt}
          autoFocus
          className="w-full bg-mytra-input border border-mytra-border rounded-field py-2.5 px-3
                     text-sm text-fg placeholder:text-fg-4 mb-4
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple"
        />
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-lg text-sm font-medium min-h-[44px]
                     bg-mytra-bg border border-mytra-border text-fg-2
                     hover:text-fg hover:bg-mytra-card-hover transition-colors"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={() => {
            haptic(variant === 'danger' ? 'warning' : 'tap')
            onConfirm(inputPrompt ? inputValue : undefined)
          }}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium min-h-[44px] transition-colors
            ${variant === 'danger'
              ? 'bg-danger text-white hover:bg-danger/90'
              : `${btnPrimaryCls}`
            }`}
        >
          {confirmText}
        </button>
      </div>
    </dialog>
  )
}
