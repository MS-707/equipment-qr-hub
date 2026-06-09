import { kv } from '@vercel/kv'

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

const KV_PREFIX = 'beta:'
const KV_INDEX = 'beta:_index'

function kvEnabled(): boolean {
  return !!process.env.KV_REST_API_URL
}

// In-memory fallback for local dev
const memStore = new Map<string, BetaSignup>()

export async function addSignup(signup: BetaSignup): Promise<void> {
  if (kvEnabled()) {
    await kv.set(`${KV_PREFIX}${signup.id}`, signup)
    const index = await kv.get<string[]>(KV_INDEX) ?? []
    index.push(signup.id)
    await kv.set(KV_INDEX, index)
  } else {
    memStore.set(signup.id, signup)
  }
}

export async function getSignup(id: string): Promise<BetaSignup | undefined> {
  if (kvEnabled()) {
    return await kv.get<BetaSignup>(`${KV_PREFIX}${id}`) ?? undefined
  }
  return memStore.get(id)
}

export async function getAllSignups(): Promise<BetaSignup[]> {
  if (kvEnabled()) {
    const index = await kv.get<string[]>(KV_INDEX) ?? []
    const signups = await Promise.all(
      index.map((id) => kv.get<BetaSignup>(`${KV_PREFIX}${id}`))
    )
    return signups
      .filter((s): s is BetaSignup => s !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }
  return Array.from(memStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export async function updateSignupStatus(id: string, status: BetaStatus): Promise<BetaSignup | undefined> {
  if (kvEnabled()) {
    const signup = await kv.get<BetaSignup>(`${KV_PREFIX}${id}`)
    if (!signup) return undefined
    signup.status = status
    signup.decidedAt = new Date().toISOString()
    await kv.set(`${KV_PREFIX}${id}`, signup)
    return signup
  }
  const signup = memStore.get(id)
  if (!signup) return undefined
  signup.status = status
  signup.decidedAt = new Date().toISOString()
  return signup
}
