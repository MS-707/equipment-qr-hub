'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckCircle2, WifiOff, AlertCircle } from 'lucide-react'

type SyncEvent = { id: string; status: 'synced' | 'offline' | 'failed' }

const listeners = new Set<(e: SyncEvent) => void>()

export function notifySyncResult(e: SyncEvent) {
  listeners.forEach((fn) => fn(e))
}

export default function SyncToast() {
  const [toast, setToast] = useState<SyncEvent | null>(null)

  const handleEvent = useCallback((e: SyncEvent) => {
    setToast(e)
  }, [])

  useEffect(() => {
    listeners.add(handleEvent)
    return () => { listeners.delete(handleEvent) }
  }, [handleEvent])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  if (!toast) return null

  const Icon = toast.status === 'synced' ? CheckCircle2 : toast.status === 'offline' ? WifiOff : AlertCircle
  const color = toast.status === 'synced' ? 'text-ok bg-ok/10 border-ok/20' : toast.status === 'offline' ? 'text-warn bg-warn/10 border-warn/20' : 'text-danger bg-danger/10 border-danger/20'
  const msg = toast.status === 'synced' ? 'Synced to cloud' : toast.status === 'offline' ? 'Saved offline — will sync later' : 'Sync failed — will retry'

  return (
    <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-2 px-4 py-2.5 rounded-full border shadow-lg ${color} animate-fadeIn`}>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="text-xs font-medium whitespace-nowrap">{msg}</span>
    </div>
  )
}
