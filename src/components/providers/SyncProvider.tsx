'use client'

import { useEffect } from 'react'
import { installSyncListeners } from '@/lib/safety-sync'
import { installSdsSyncListeners } from '@/lib/sds-sync'
import { archiveOldSyncedRecords, pruneOldDrafts } from '@/lib/safety-records'
import { archiveOldSyncedSdsRecords } from '@/lib/sds-records'

export default function SyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    archiveOldSyncedRecords()
    archiveOldSyncedSdsRecords()
    pruneOldDrafts()
    const cleanupSafety = installSyncListeners()
    const cleanupSds = installSdsSyncListeners()
    return () => { cleanupSafety(); cleanupSds() }
  }, [])

  return <>{children}</>
}
