const STORAGE_KEY = 'sage-module-tours-seen'

function getSeenMap(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

export function isTourSeen(moduleId: string): boolean {
  return !!getSeenMap()[moduleId]
}

export function markTourSeen(moduleId: string): void {
  try {
    const map = getSeenMap()
    map[moduleId] = true
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch { /* non-fatal */ }
}

export function resetTourSeen(moduleId?: string): void {
  try {
    if (moduleId) {
      const map = getSeenMap()
      delete map[moduleId]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch { /* non-fatal */ }
}
