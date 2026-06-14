'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, CheckCircle2, XCircle, Clock, RefreshCw, Loader2, Users } from 'lucide-react'
import Link from 'next/link'
import AuthGate from '@/components/AuthGate'
import type { BetaSignup } from '@/lib/beta'

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
  pending: { bg: 'bg-warn/10 border-warn/20', text: 'text-warn', icon: Clock },
  approved: { bg: 'bg-ok/10 border-ok/20', text: 'text-ok', icon: CheckCircle2 },
  rejected: { bg: 'bg-danger/10 border-danger/20', text: 'text-danger', icon: XCircle },
}

function BetaAdmin() {
  const [signups, setSignups] = useState<BetaSignup[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/beta/decide')
      if (res.ok) {
        const data = await res.json()
        setSignups(data.signups ?? [])
      }
    } catch { /* network error */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function decide(id: string, status: 'approved' | 'rejected') {
    setActing(id)
    try {
      const res = await fetch('/api/beta/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) await load()
    } catch { /* network error */ }
    setActing(null)
  }

  const pending = signups.filter((s) => s.status === 'pending')
  const decided = signups.filter((s) => s.status !== 'pending')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fadeIn">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg min-h-[44px]" aria-label="Back to home">
        <ArrowLeft className="w-4 h-4" /> Home
      </Link>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-mytra-purple" />
          <h1 className="text-xl font-bold text-fg">Beta Signups</h1>
        </div>
        <button onClick={load} className="text-fg-3 hover:text-fg p-2 min-h-[44px]" aria-label="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Pending" value={pending.length} tone="warn" />
        <StatCard label="Approved" value={signups.filter((s) => s.status === 'approved').length} tone="ok" />
        <StatCard label="Total" value={signups.length} tone="neutral" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-fg-3">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : signups.length === 0 ? (
        <div className="bg-mytra-card border border-mytra-border rounded-lg p-8 text-center shadow-card">
          <Users className="w-8 h-8 text-fg-4 mx-auto mb-2" />
          <p className="text-sm text-fg-2">No signups yet. Share <span className="font-mono text-mytra-purple">/beta</span> to start collecting.</p>
        </div>
      ) : (
        <>
          {/* Pending */}
          {pending.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-wider text-fg-3 font-semibold mb-2 px-1">
                Pending review ({pending.length})
              </h2>
              <div className="space-y-2">
                {pending.map((s) => (
                  <SignupCard key={s.id} signup={s} acting={acting === s.id} onDecide={decide} />
                ))}
              </div>
            </section>
          )}

          {/* Decided */}
          {decided.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-wider text-fg-3 font-semibold mb-2 px-1">
                Decided ({decided.length})
              </h2>
              <div className="space-y-2">
                {decided.map((s) => (
                  <SignupCard key={s.id} signup={s} acting={acting === s.id} onDecide={decide} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function SignupCard({
  signup,
  acting,
  onDecide,
}: {
  signup: BetaSignup
  acting: boolean
  onDecide: (id: string, status: 'approved' | 'rejected') => void
}) {
  const style = STATUS_STYLES[signup.status] ?? STATUS_STYLES.pending
  const StatusIcon = style.icon

  return (
    <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 shadow-card space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg truncate">{signup.name}</p>
          <p className="text-xs text-fg-3 truncate">{signup.email}</p>
          <p className="text-xs text-fg-3">{signup.company} · {signup.role}</p>
          {signup.crewSize && <p className="text-xs text-fg-4">Crew: {signup.crewSize}</p>}
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${style.bg} ${style.text}`}>
          <StatusIcon className="w-3 h-3" />
          {signup.status}
        </span>
      </div>

      {signup.reason && (
        <p className="text-xs text-fg-2 bg-mytra-input rounded-lg p-2">{signup.reason}</p>
      )}

      <p className="text-xs text-fg-4">
        Applied {new Date(signup.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        {signup.decidedAt && ` · Decided ${new Date(signup.decidedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
      </p>

      {signup.status === 'pending' && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onDecide(signup.id, 'approved')}
            disabled={acting}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium
                       bg-ok/10 border border-ok/20 text-ok hover:bg-ok/20 transition-colors
                       disabled:opacity-40 min-h-[44px]"
          >
            {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            Approve
          </button>
          <button
            onClick={() => onDecide(signup.id, 'rejected')}
            disabled={acting}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium
                       bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 transition-colors
                       disabled:opacity-40 min-h-[44px]"
          >
            {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
            Decline
          </button>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'warn' | 'neutral' }) {
  const valueColor = tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : 'text-fg'
  return (
    <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 shadow-card">
      <p className="text-xs uppercase tracking-wider text-fg-3">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 ${valueColor}`}>{value}</p>
    </div>
  )
}

export default function BetaAdminPage() {
  return (
    <AuthGate>
      <BetaAdmin />
    </AuthGate>
  )
}
