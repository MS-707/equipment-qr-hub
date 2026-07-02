import { useRef, useCallback } from 'react'

// Tuned for gloved hands on jobsites: a swipe must be a deliberate,
// mostly-horizontal flick. Diagonal scrolls (common when a gloved thumb
// drags a long checklist) and slow drags must never navigate.
const MIN_DISTANCE = 70
const MAX_RATIO = 0.45
const MAX_DURATION_MS = 400

export interface SwipePoint {
  x: number
  y: number
  t: number
}

/**
 * Pure swipe classifier — exported for tests. Returns the swipe direction
 * or null when the gesture should be ignored (too short, too slow, too
 * diagonal).
 */
export function evaluateSwipe(start: SwipePoint, end: SwipePoint): 'left' | 'right' | null {
  if (end.t - start.t > MAX_DURATION_MS) return null
  const dx = end.x - start.x
  const dy = end.y - start.y
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)
  if (absDx < MIN_DISTANCE) return null
  if (absDy / absDx > MAX_RATIO) return null
  return dx < 0 ? 'left' : 'right'
}

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
}

export function useSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
): SwipeHandlers {
  const start = useRef<SwipePoint | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]
    start.current = { x: t.clientX, y: t.clientY, t: Date.now() }
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!start.current) return
    const t = e.changedTouches[0]
    const direction = evaluateSwipe(start.current, { x: t.clientX, y: t.clientY, t: Date.now() })
    start.current = null
    if (!direction) return

    const target = e.target as HTMLElement
    if (target.closest('canvas, [data-no-swipe]')) return

    if (direction === 'left') onSwipeLeft()
    else onSwipeRight()
  }, [onSwipeLeft, onSwipeRight])

  return { onTouchStart, onTouchEnd }
}
