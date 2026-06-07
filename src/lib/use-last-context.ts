const STORAGE_KEY = 'last-context'

interface LastContext {
  projectName?: string
  location?: string
  shift?: string
}

export function getLastContext(): LastContext {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveLastContext(ctx: LastContext): void {
  if (typeof window === 'undefined') return
  const prev = getLastContext()
  const merged: LastContext = { ...prev }
  if (ctx.projectName?.trim()) merged.projectName = ctx.projectName.trim()
  if (ctx.location?.trim()) merged.location = ctx.location.trim()
  if (ctx.shift?.trim()) merged.shift = ctx.shift.trim()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch { /* quota */ }
}
