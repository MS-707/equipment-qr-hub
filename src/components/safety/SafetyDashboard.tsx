'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ClipboardList,
  ListChecks,
  ArrowUpFromLine,
  Flame,
  PackageOpen,
  AlertTriangle,
  Truck,
  FlaskConical,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import {
  getPtpForDate,
  getActivePermits,
  getAllSafetyRecords,
  onSafetyChange,
  getReviewActionableRecords,
} from '@/lib/safety-records'
import { useReviewPoller } from '@/lib/review-poll'
import { getCurrentIdentity } from '@/lib/identity'
import type { SafetyRecord, AnyPermit, PreTaskPlan } from '@/lib/safety-types'
import SafetyRecordCard from './SafetyRecordCard'
import ModuleTourButton from '@/components/onboarding/ModuleTourButton'
import PermitTimer from './PermitTimer'
import PermitStatusBadge from './PermitStatusBadge'
import { permitDisplayStatus } from '@/lib/safety-records'
import { StatCardSkeleton, RecordCardSkeleton } from '@/components/Skeleton'
import PullToRefresh from '@/components/PullToRefresh'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

const QUICK_ACTIONS: { href: string; label: string; icon: typeof ClipboardList; primary?: boolean; external?: boolean }[] = [
  { href: '/safety/ptp', label: 'Start PTP', icon: ClipboardList, primary: true },
  { href: '/safety/jha', label: 'Job Hazard Analysis', icon: ListChecks },
  { href: '/safety/permits/height', label: 'Work-at-Height', icon: ArrowUpFromLine },
  { href: '/safety/permits/hot-work', label: 'Hot Work', icon: Flame },
  { href: '/safety/permits/confined-space', label: 'Confined Space', icon: PackageOpen },
  { href: '/safety/incident', label: 'Report Incident', icon: AlertTriangle },
  { href: 'https://sds-five-beta.vercel.app', label: 'SDS Binder', icon: FlaskConical, external: true },
  { href: '/inspections', label: 'Pre-Trip Inspection', icon: Truck },
]

export default function SafetyDashboard() {
  const [ptp, setPtp] = useState<PreTaskPlan | undefined>(undefined)
  const [activePermits, setActivePermits] = useState<AnyPermit[]>([])
  const [incidentCount, setIncidentCount] = useState(0)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [reviewApprovedCount, setReviewApprovedCount] = useState(0)
  const [reviewRejectedCount, setReviewRejectedCount] = useState(0)
  const [recent, setRecent] = useState<SafetyRecord[]>([])
  const [firstName, setFirstName] = useState('')
  const [loaded, setLoaded] = useState(false)

  useReviewPoller()

  const load = useCallback(() => {
    setPtp(getPtpForDate(today()))
    setActivePermits(getActivePermits())
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const all = getAllSafetyRecords()
    setIncidentCount(
      all.filter((r) => r.type === 'incident-report' && new Date(r.createdAt).getTime() >= sevenDaysAgo).length
    )
    setPendingSyncCount(
      all.filter((r) => r.syncStatus === 'pending' || r.syncStatus === 'offline' || r.syncStatus === 'failed').length
    )
    const reviewItems = getReviewActionableRecords()
    setReviewApprovedCount(reviewItems.approved.length)
    setReviewRejectedCount(reviewItems.rejected.length)
    setRecent(all.slice(0, 5))
    setLoaded(true)
  }, [])

  useEffect(() => {
    const id = getCurrentIdentity()
    if (id?.name) setFirstName(id.name.split(' ')[0])
    load()
    const unsub = onSafetyChange(load)
    const onStorage = () => load()
    window.addEventListener('storage', onStorage)
    return () => {
      unsub()
      window.removeEventListener('storage', onStorage)
    }
  }, [load])

  return (
    <PullToRefresh onRefresh={load}>
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fadeIn">
      {/* Greeting */}
      <div className="flex items-start justify-between animate-blurIn">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-fg">
            {firstName ? `Hello, ${firstName}` : 'Home'}
          </h1>
          <ModuleTourButton tourId="dashboard" />
        </div>
        <p className="text-sm text-fg-2">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Status row */}
      <div data-tour-module="ptp-status" className="grid grid-cols-3 gap-3">
        {!loaded ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
        <StatCard
          label="Today's PTP"
          value={ptp ? 'Logged' : 'Not started'}
          sub={ptp ? `${ptp.crewSignatures.length} signed` : 'tap Start PTP'}
          tone={ptp ? 'good' : 'warn'}
          delayMs={0}
        />
        <StatCard label="Active permits" value={String(activePermits.length)} sub="open now" tone="neutral" delayMs={60} />
        <StatCard label="Incidents" value={String(incidentCount)} sub="last 7 days" tone={incidentCount > 0 ? 'warn' : 'neutral'} delayMs={120} />
          </>
        )}
      </div>

      {/* Sync status */}
      {pendingSyncCount > 0 && (
        <div className="flex items-center gap-2 bg-warn/10 border border-warn/20 rounded-lg px-4 py-2.5">
          <RefreshCw className="w-4 h-4 text-warn shrink-0" />
          <p className="text-xs text-warn">
            {pendingSyncCount} record{pendingSyncCount !== 1 ? 's' : ''} waiting to sync
          </p>
        </div>
      )}

      {/* EHS review banners */}
      {reviewRejectedCount > 0 && (
        <Link
          href="/safety/history"
          className="flex items-center gap-2 bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 min-h-[44px] hover:bg-danger/15 transition-colors"
        >
          <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
          <p className="text-xs text-danger flex-1">
            {reviewRejectedCount} record{reviewRejectedCount !== 1 ? 's' : ''} need{reviewRejectedCount === 1 ? 's' : ''} revision — rejected by EHS
          </p>
          <ChevronRight className="w-3.5 h-3.5 text-danger shrink-0" />
        </Link>
      )}
      {reviewApprovedCount > 0 && (
        <Link
          href="/safety/history"
          className="flex items-center gap-2 bg-ok/10 border border-ok/20 rounded-lg px-4 py-3 min-h-[44px] hover:bg-ok/15 transition-colors"
        >
          <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
          <p className="text-xs text-ok flex-1">
            {reviewApprovedCount} record{reviewApprovedCount !== 1 ? 's' : ''} approved by EHS
          </p>
          <ChevronRight className="w-3.5 h-3.5 text-ok shrink-0" />
        </Link>
      )}

      {/* Quick actions */}
      <section data-tour-module="quick-actions">
        <h2 className="heading-rule text-xs uppercase tracking-wider text-fg-3 font-semibold mb-2 px-1">Quick actions</h2>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map(({ href, label, icon: Icon, primary, external }, i) => {
            const cls = `flex items-center gap-2 rounded-lg px-3 py-4 text-sm font-medium min-h-[44px]
                         transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] border
                         press-scale animate-blurIn ${
              primary
                ? 'bg-mytra-purple text-white border-mytra-purple hover:bg-mytra-purple-hover hover:shadow-lg hover:shadow-mytra-purple/20'
                : 'bg-mytra-card text-fg-2 border-mytra-border hover:bg-mytra-card-hover hover:shadow-card'
            }`
            const style = { animationDelay: `${100 + i * 40}ms` }
            if (external) {
              return (
                <a key={href} href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </a>
              )
            }
            return (
              <Link key={href} href={href} className={cls} style={style}>
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </div>
      </section>

      {/* Active permits */}
      {activePermits.length > 0 && (
        <section>
          <h2 data-tour-module="active-permits" className="heading-rule text-xs uppercase tracking-wider text-fg-3 font-semibold mb-2 px-1">Active permits</h2>
          <div className="space-y-2">
            {activePermits.map((p) => (
              <Link
                key={p.id}
                href={`/safety/record/${p.id}`}
                className="flex items-center justify-between gap-3 bg-mytra-card border border-mytra-border rounded-lg px-3 py-3 shadow-card hover:bg-mytra-card-hover transition-colors press-scale"
              >
                <div className="min-w-0">
                  <p className="text-xs font-mono text-fg-3">{p.id}</p>
                  <p className="text-sm text-fg truncate">
                    {('workDescription' in p ? p.workDescription : p.spaceDescription) || p.projectName}
                  </p>
                  <p className="text-xs text-fg-3 truncate">{p.location}</p>
                </div>
                <div className="shrink-0 text-right space-y-1">
                  <PermitStatusBadge permit={p} />
                  <div>
                    <PermitTimer validUntil={p.validUntil} status={permitDisplayStatus(p) === 'expired' ? 'active' : p.status} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent activity */}
      <section data-tour-module="recent-activity">
        <div className="flex items-center justify-between gap-3 mb-2 px-1">
          <h2 className="heading-rule flex-1 text-xs uppercase tracking-wider text-fg-3 font-semibold">Recent activity</h2>
          <Link href="/safety/history" className="text-xs text-mytra-purple hover:underline inline-flex items-center gap-0.5 min-h-[44px] px-2 -mr-2">
            View history <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {!loaded ? (
          <div className="space-y-2">
            <RecordCardSkeleton />
            <RecordCardSkeleton />
            <RecordCardSkeleton />
          </div>
        ) : recent.length === 0 ? (
          <div className="bg-mytra-card border border-mytra-border rounded-lg p-6 shadow-card text-center">
            <CheckCircle2 className="w-8 h-8 text-fg-4 mx-auto mb-2" />
            <p className="text-sm text-fg-2">No safety records yet. Start your day with a PTP.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((r) => (
              <SafetyRecordCard key={r.id} record={r} />
            ))}
          </div>
        )}
      </section>
    </div>
    </PullToRefresh>
  )
}

function StatCard({
  label,
  value,
  sub,
  tone,
  delayMs = 0,
}: {
  label: string
  value: string
  sub: string
  tone: 'good' | 'warn' | 'neutral'
  delayMs?: number
}) {
  const valueColor = tone === 'good' ? 'text-ok' : tone === 'warn' ? 'text-warn' : 'text-fg'
  return (
    <div
      style={{ animationDelay: `${delayMs}ms` }}
      className="bg-mytra-card border border-mytra-border rounded-lg p-4 shadow-card
                    transition-shadow duration-200 hover:shadow-pop animate-blurIn">
      <p className="text-xs uppercase tracking-wider text-fg-3">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 ${valueColor}`}>{value}</p>
      <p className="text-xs text-fg-4">{sub}</p>
    </div>
  )
}
