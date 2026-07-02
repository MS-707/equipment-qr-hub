import { describe, it, expect } from 'vitest'
import { evaluateSwipe, type SwipePoint } from '@/hooks/useSwipe'

/**
 * Swipe classifier thresholds (queue item A5): tab-swipe must be a
 * deliberate horizontal flick. A gloved worker dragging a long checklist
 * diagonally, or slow-dragging, must never trigger navigation — on the
 * pre-trip tab a stray swipe-right used to call router.back() and drop
 * un-debounced inspection answers.
 */

const at = (x: number, y: number, t: number): SwipePoint => ({ x, y, t })

describe('evaluateSwipe', () => {
  it('accepts a clean fast horizontal flick left', () => {
    expect(evaluateSwipe(at(300, 400, 0), at(180, 405, 150))).toBe('left')
  })

  it('accepts a clean fast horizontal flick right', () => {
    expect(evaluateSwipe(at(100, 400, 0), at(280, 390, 150))).toBe('right')
  })

  it('rejects short movements (tap wobble)', () => {
    expect(evaluateSwipe(at(200, 400, 0), at(260, 400, 100))).toBeNull()
  })

  it('rejects gloved diagonal scrolls (dy/dx = 0.5)', () => {
    // 100px right, 50px down — a thumb dragging the checklist while drifting
    expect(evaluateSwipe(at(100, 200, 0), at(200, 250, 200))).toBeNull()
  })

  it('rejects slow drags even when horizontal', () => {
    expect(evaluateSwipe(at(100, 400, 0), at(300, 400, 900))).toBeNull()
  })

  it('accepts a flick at exactly the ratio boundary direction', () => {
    // 120px right, 30px up — dy/dx = 0.25, well within tolerance
    expect(evaluateSwipe(at(100, 400, 0), at(220, 370, 200))).toBe('right')
  })

  it('rejects vertical scrolls outright', () => {
    expect(evaluateSwipe(at(200, 500, 0), at(205, 200, 200))).toBeNull()
  })
})
