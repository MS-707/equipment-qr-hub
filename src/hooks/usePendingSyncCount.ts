'use client'

import { useState, useEffect } from 'react'
import { getAllSafetyRecords, onSafetyChange } from '@/lib/safety-records'

export function usePendingSyncCount(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const sync = () => {
      const pending = getAllSafetyRecords().filter(
        (r) => r.syncStatus === 'pending' || r.syncStatus === 'offline' || r.syncStatus === 'failed'
      )
      setCount(pending.length)
    }
    sync()
    const unsub = onSafetyChange(sync)
    window.addEventListener('storage', sync)
    return () => {
      unsub()
      window.removeEventListener('storage', sync)
    }
  }, [])

  return count
}
