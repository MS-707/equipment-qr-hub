'use client'

import { useEffect } from 'react'
import { installSyncListeners } from '@/lib/safety-sync'
import { installNotifyListeners } from '@/lib/inspections'
import { archiveOldSyncedRecords, pruneOldDrafts } from '@/lib/safety-records'

export default function SyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    archiveOldSyncedRecords()
    pruneOldDrafts()
    const uninstallSync = installSyncListeners()
    const uninstallNotify = installNotifyListeners()
    return () => {
      uninstallSync()
      uninstallNotify()
    }
  }, [])

  return <>{children}</>
}
