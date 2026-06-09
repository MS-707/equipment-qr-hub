'use client'

import { useRef, useState, useCallback, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

const THRESHOLD = 64
const MAX_PULL = 100
const RESISTANCE = 0.4

interface PullToRefreshProps {
  onRefresh: () => void | Promise<void>
  children: ReactNode
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const pulling = useRef(false)
  const pullDistRef = useRef(0)
  pullDistRef.current = pullDistance

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop
    if (scrollTop > 0) return
    startY.current = e.touches[0].clientY
    pulling.current = true
  }, [refreshing])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return
    const dy = e.touches[0].clientY - startY.current
    if (dy <= 0) {
      setPullDistance(0)
      return
    }
    setPullDistance(Math.min(dy * RESISTANCE, MAX_PULL))
  }, [refreshing])

  const onTouchEnd = useCallback(async () => {
    if (!pulling.current) return
    pulling.current = false
    if (pullDistRef.current >= THRESHOLD && !refreshing) {
      setRefreshing(true)
      setPullDistance(THRESHOLD * 0.6)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }, [refreshing, onRefresh])

  const active = pullDistance > 0 || refreshing
  const ready = pullDistance >= THRESHOLD

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
        style={{ height: active ? pullDistance : 0 }}
      >
        <RefreshCw
          className={`w-5 h-5 text-fg-3 transition-transform duration-200 ${
            refreshing ? 'animate-spin' : ''
          }`}
          style={{ transform: refreshing ? undefined : `rotate(${Math.min(pullDistance / THRESHOLD, 1) * 180}deg)`, opacity: ready || refreshing ? 1 : pullDistance / THRESHOLD }}
        />
      </div>
      {children}
    </div>
  )
}
