import { useRef, useCallback } from 'react'

const MIN_DISTANCE = 50
const MAX_RATIO = 0.6

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
}

export function useSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
): SwipeHandlers {
  const start = useRef<{ x: number; y: number } | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]
    start.current = { x: t.clientX, y: t.clientY }
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!start.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.current.x
    const dy = t.clientY - start.current.y
    start.current = null

    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (absDx < MIN_DISTANCE) return
    if (absDy / absDx > MAX_RATIO) return

    const target = e.target as HTMLElement
    if (target.closest('canvas, [data-no-swipe]')) return

    if (dx < 0) onSwipeLeft()
    else onSwipeRight()
  }, [onSwipeLeft, onSwipeRight])

  return { onTouchStart, onTouchEnd }
}
