import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return { session: null, error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { session, error: null }
}
