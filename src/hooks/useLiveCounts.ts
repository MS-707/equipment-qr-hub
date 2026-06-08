'use client'

import { useState, useEffect } from 'react'
import { getOpenCount, onWorkOrderChange } from '@/lib/work-orders'
import { getOpenSafetyCount, onSafetyChange } from '@/lib/safety-records'

/**
 * Live badge counts shared by BottomTabBar and NavHeader. Subscribes to same-tab
 * pub/sub (onWorkOrderChange / onSafetyChange) and cross-tab `storage` events so
 * both nav surfaces stay in sync without duplicating the wiring.
 */
export function useLiveCounts() {
  const [openOrders, setOpenOrders] = useState(0)
  const [openSafety, setOpenSafety] = useState(0)

  useEffect(() => {
    const sync = () => {
      setOpenOrders(getOpenCount())
      setOpenSafety(getOpenSafetyCount())
    }
    sync()
    const unsubWo = onWorkOrderChange(sync)
    const unsubSafety = onSafetyChange(sync)
    window.addEventListener('storage', sync)
    return () => {
      unsubWo()
      unsubSafety()
      window.removeEventListener('storage', sync)
    }
  }, [])

  return { openOrders, openSafety }
}
