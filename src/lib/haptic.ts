export function haptic(type: 'tap' | 'success' | 'warning' | 'error'): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return

  const patterns: Record<string, number | number[]> = {
    tap: 10,
    success: [10, 50, 10],
    warning: [20, 40, 20, 40, 20],
    error: [50, 30, 50, 30, 100],
  }

  navigator.vibrate(patterns[type] ?? 10)
}
