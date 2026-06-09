export type BetaStatus = 'pending' | 'approved' | 'rejected'

export interface BetaSignup {
  id: string
  name: string
  email: string
  company: string
  role: string
  crewSize: string
  reason: string
  status: BetaStatus
  createdAt: string
  decidedAt?: string
}

const store = new Map<string, BetaSignup>()

export function addSignup(signup: BetaSignup): void {
  store.set(signup.id, signup)
}

export function getSignup(id: string): BetaSignup | undefined {
  return store.get(id)
}

export function getAllSignups(): BetaSignup[] {
  return Array.from(store.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function updateSignupStatus(id: string, status: BetaStatus): BetaSignup | undefined {
  const signup = store.get(id)
  if (!signup) return undefined
  signup.status = status
  signup.decidedAt = new Date().toISOString()
  return signup
}
