'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

export default function SwUpdateBanner() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.ready.then((reg) => {
      if (reg.waiting) {
        setWaiting(reg.waiting)
      }

      reg.addEventListener('updatefound', () => {
        const sw = reg.installing
        if (!sw) return
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            setWaiting(sw)
          }
        })
      })
    })

    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  }, [])

  if (!waiting) return null

  function apply() {
    waiting?.postMessage({ type: 'SKIP_WAITING' })
  }

  return (
    <div className="no-print fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-50
                    bg-mytra-card border border-mytra-border shadow-card rounded-xl px-4 py-3
                    flex items-center gap-3 animate-fadeInUp max-w-sm w-[calc(100%-2rem)]">
      <RefreshCw className="w-4 h-4 text-mytra-purple shrink-0" />
      <p className="text-xs text-fg-2 flex-1">A new version is available.</p>
      <button
        type="button"
        onClick={apply}
        className="text-xs font-semibold text-mytra-purple hover:underline whitespace-nowrap min-h-[44px] flex items-center"
      >
        Update now
      </button>
    </div>
  )
}
