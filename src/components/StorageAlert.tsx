'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function StorageAlert() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handler = () => setVisible(true)
    window.addEventListener('eqr:storage-corruption', handler)
    return () => window.removeEventListener('eqr:storage-corruption', handler)
  }, [])

  if (!visible) return null

  return (
    <div className="no-print fixed top-0 left-0 right-0 z-[80] bg-danger/95 text-white px-4 py-3 text-center">
      <div className="max-w-2xl mx-auto flex items-center gap-2 justify-center">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <p className="text-sm font-medium">
          Safety records could not be loaded — storage may be corrupted. Your data backup is being
          restored. If records are missing, contact your safety officer.
        </p>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="ml-2 text-white/70 hover:text-white text-sm shrink-0"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
