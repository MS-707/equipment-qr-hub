import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.stubGlobal('navigator', { vibrate: vi.fn() })
})

describe('haptic', () => {
  it('triggers tap vibration', async () => {
    const { haptic } = await import('../haptic')
    haptic('tap')
    expect(navigator.vibrate).toHaveBeenCalledWith(10)
  })

  it('triggers success vibration pattern', async () => {
    const { haptic } = await import('../haptic')
    haptic('success')
    expect(navigator.vibrate).toHaveBeenCalledWith([10, 50, 10])
  })

  it('triggers warning vibration pattern', async () => {
    const { haptic } = await import('../haptic')
    haptic('warning')
    expect(navigator.vibrate).toHaveBeenCalledWith([20, 40, 20, 40, 20])
  })

  it('triggers error vibration pattern', async () => {
    const { haptic } = await import('../haptic')
    haptic('error')
    expect(navigator.vibrate).toHaveBeenCalledWith([50, 30, 50, 30, 100])
  })

  it('does nothing when vibrate is unavailable', async () => {
    vi.stubGlobal('navigator', {})
    vi.resetModules()
    const { haptic } = await import('../haptic')
    expect(() => haptic('tap')).not.toThrow()
  })
})
