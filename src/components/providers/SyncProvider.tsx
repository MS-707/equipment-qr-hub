'use client'

import { useEffect } from 'react'
import { installSyncListeners } from '@/lib/safety-sync'
import { installNotifyListeners, getAllInspections, onInspectionChange } from '@/lib/inspections'
import { archiveOldSyncedRecords, pruneOldDrafts, getAllSafetyRecords, onSafetyChange } from '@/lib/safety-records'
import { requestPersistentStorage } from '@/lib/persist-storage'

export default function SyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    archiveOldSyncedRecords()
    pruneOldDrafts()
    const uninstallSync = installSyncListeners()
    const uninstallNotify = installNotifyListeners()

    // Ask the browser not to evict our stores once real records exist —
    // at load if the device already holds data, else on the first save.
    // (requestPersistentStorage self-guards to one request per session.)
    const maybePersist = () => {
      if (getAllSafetyRecords().length > 0 || getAllInspections().length > 0) {
        void requestPersistentStorage()
      }
    }
    maybePersist()
    const unsubSafety = onSafetyChange(maybePersist)
    const unsubInspections = onInspectionChange(maybePersist)

    return () => {
      uninstallSync()
      uninstallNotify()
      unsubSafety()
      unsubInspections()
    }
  }, [])

  return <>{children}</>
}
