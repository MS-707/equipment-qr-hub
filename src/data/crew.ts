export interface CrewMember {
  name: string
  email?: string
  role?: string
}

const CREW_HISTORY_KEY = 'eqr-crew-history'
const MAX_HISTORY = 30

function readHistory(): CrewMember[] {
  try {
    const raw = localStorage.getItem(CREW_HISTORY_KEY)
    return raw ? (JSON.parse(raw) as CrewMember[]) : []
  } catch {
    return []
  }
}

export function rememberCrewMember(name: string, role?: string | null): void {
  const history = readHistory()
  const existing = history.findIndex((c) => c.name.toLowerCase() === name.toLowerCase())
  const entry: CrewMember = { name, ...(role ? { role } : {}) }
  if (existing >= 0) {
    history.splice(existing, 1)
  }
  history.unshift(entry)
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY
  try {
    localStorage.setItem(CREW_HISTORY_KEY, JSON.stringify(history))
  } catch {}
}

export const crewRoster: CrewMember[] = typeof window !== 'undefined' ? readHistory() : []

export function getCrewRoster(): CrewMember[] {
  return readHistory()
}

export const crewRoles: string[] = [
  'Supervisor',
  'Foreman',
  'Engineer',
  'Crew',
  'Operator',
  'Entrant',
  'Attendant',
  'Fire Watch',
]
