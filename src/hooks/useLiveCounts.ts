'use client'

import { useState, useEffect } from 'react'
import { getOpenCount, onWorkOrderChange } from '@/lib/work-orders'
import { getOpenSafetyCount, onSafetyChange } from '@/lib/safety-records'
import { getNewSdsCount, onSdsChange } from '@/lib/sds-records'

/**
 * Live badge counts shared by BottomTabBar and NavHeader. Subscribes to same-tab
 * pub/sub (onWorkOrderChange / onSafetyChange / onSdsChange) and cross-tab
 * `storage` events so both nav surfaces stay in sync without duplicating the wiring.
 */
export function useLiveCounts() {
  const [openOrders, setOpenOrders] = useState(0)
  const [openSafety, setOpenSafety] = useState(0)
  const [newSds, setNewSds] = useState(0)

  useEffect(() => {
    const sync = () => {
      setOpenOrders(getOpenCount())
      setOpenSafety(getOpenSafetyCount())
      setNewSds(getNewSdsCount())
    }
    sync()
    const unsubWo = onWorkOrderChange(sync)
    const unsubSafety = onSafetyChange(sync)
    const unsubSds = onSdsChange(sync)
    window.addEventListener('storage', sync)
    return () => {
      unsubWo()
      unsubSafety()
      unsubSds()
      window.removeEventListener('storage', sync)
    }
  }, [])

  return { openOrders, openSafety, newSds }
}
