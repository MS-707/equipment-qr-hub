'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckCircle2, WifiOff, AlertCircle, X } from 'lucide-react'

export type SyncToastEvent = {
  tone: 'ok' | 'warn' | 'danger'
  message: string
  /** Persistent toasts (e.g. sync failures) stay until dismissed. */
  persist?: boolean
}

const listeners = new Set<(e: SyncToastEvent) => void>()

export function notifySyncResult(e: SyncToastEvent) {
  listeners.forEach((fn) => fn(e))
}

const TONE: Record<SyncToastEvent['tone'], { Icon: typeof CheckCircle2; cls: string }> = {
  ok: { Icon: CheckCircle2, cls: 'text-ok bg-ok/10 border-ok/20' },
  warn: { Icon: WifiOff, cls: 'text-warn bg-warn/10 border-warn/20' },
  danger: { Icon: AlertCircle, cls: 'text-danger bg-danger/10 border-danger/20' },
}

export default function SyncToast() {
  const [toast, setToast] = useState<SyncToastEvent | null>(null)

  const handleEvent = useCallback((e: SyncToastEvent) => {
    setToast(e)
  }, [])

  useEffect(() => {
    listeners.add(handleEvent)
    return () => { listeners.delete(handleEvent) }
  }, [handleEvent])

  useEffect(() => {
    if (!toast || toast.persist) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  if (!toast) return null

  const { Icon, cls } = TONE[toast.tone]

  return (
    <div
      role={toast.tone === 'danger' ? 'alert' : 'status'}
      aria-live={toast.tone === 'danger' ? 'assertive' : 'polite'}
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-2 px-4 py-2.5 rounded-full border shadow-lg ${cls} animate-fadeIn`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="text-xs font-medium whitespace-nowrap">{toast.message}</span>
      {toast.persist && (
        <button
          type="button"
          onClick={() => setToast(null)}
          aria-label="Dismiss"
          className="ml-1 -mr-1.5 w-7 h-7 -my-1.5 flex items-center justify-center rounded-full hover:bg-current/10"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
