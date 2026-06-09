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
