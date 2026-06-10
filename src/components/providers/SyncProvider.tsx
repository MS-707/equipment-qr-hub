'use client'

import { useEffect } from 'react'
import { installSyncListeners } from '@/lib/safety-sync'

export default function SyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    return installSyncListeners()
  }, [])

  return <>{children}</>
}
