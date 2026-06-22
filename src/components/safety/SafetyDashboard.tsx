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
} from 'lucide-react'
import {
  getPtpStatusForDate,
  getActivePermits,
  getAllSafetyRecords,
  onSafetyChange,
  getReviewActionableRecords,
  ptpDayLabel,
} from '@/lib/safety-records'
import type { PtpDateStatus } from '@/lib/safety-records'
import { useReviewPoller } from '@/lib/review-poll'
import { getCurrentIdentity } from '@/lib/identity'
import type { SafetyRecord, AnyPermit } from '@/lib/safety-types'
import SafetyRecordCard from './SafetyRecordCard'
import ModuleTourButton from '@/components/onboarding/ModuleTourButton'
import PermitTimer from './PermitTimer'
import PermitStatusBadge from './PermitStatusBadge'
import { StatCardSkeleton, RecordCardSkeleton } from '@/components/Skeleton'
import PullToRefresh from '@/components/PullToRefresh'
import SyncQueuePanel from './SyncQueuePanel'
import { localToday } from '@/lib/datetime'

function today(): string {
  return localToday()
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
  const [ptpStatus, setPtpStatus] = useState<PtpDateStatus>({ ptp: undefined, status: 'none' })
  const [activePermits, setActivePermits] = useState<AnyPermit[]>([])
  const [incidentCount, setIncidentCount] = useState(0)
  const [reviewApprovedCount, setReviewApprovedCount] = useState(0)
  const [reviewRejectedCount, setReviewRejectedCount] = useState(0)
  const [recent, setRecent] = useState<SafetyRecord[]>([])
  const [firstName, setFirstName] = useState('')
  const [loaded, setLoaded] = useState(false)

  useReviewPoller()

  const load = useCallback(() => {
    setPtpStatus(getPtpStatusForDate(today()))
    setActivePermits(getActivePermits())
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const all = getAllSafetyRecords()
    setIncidentCount(
      all.filter((r) => r.type === 'incident-report' && new Date(r.createdAt).getTime() >= sevenDaysAgo).length
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
          label={ptpStatus.status === 'active' && ptpStatus.ptp.validUntil ? (ptpDayLabel(ptpStatus.ptp, today()) ?? "Today's PTP") : "Today's PTP"}
          value={ptpStatus.status === 'active' ? 'Active' : ptpStatus.status === 'expired' ? 'Expired' : 'Not started'}
          sub={ptpStatus.status === 'active' ? `${ptpStatus.ptp.crewSignatures.length} crew signed` : ptpStatus.status === 'expired' ? 'Tap to renew' : 'Tap to start'}
          tone={ptpStatus.status === 'active' ? 'good' : ptpStatus.status === 'expired' ? 'danger' : 'warn'}
          delayMs={0}
          href={ptpStatus.status === 'active' ? `/safety/record/${ptpStatus.ptp.id}` : '/safety/ptp'}
        />
        <StatCard label="Active permits" value={String(activePermits.length)} sub="open now" tone="neutral" delayMs={60} />
        <StatCard label="Incidents" value={String(incidentCount)} sub="last 7 days" tone={incidentCount > 0 ? 'warn' : 'neutral'} delayMs={120} />
          </>
        )}
      </div>

      {/* Sync queue */}
      <SyncQueuePanel />

      {/* EHS review banners */}
      {reviewRejectedCount > 0 && (
        <Link
          href="/safety/history"
          className="flex items-center gap-2 bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 min-h-[44px] hover:bg-danger/15 transition-colors"
        >
          <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
          <p className="text-xs text-danger flex-1">
            {reviewRejectedCount} record{reviewRejectedCount !== 1 ? 's' : ''} need{reviewRejectedCount === 1 ? 's' : ''} revision — returned by EHS
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
                    <PermitTimer validUntil={p.validUntil} status={p.status} />
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
          <div className="bg-mytra-card border border-mytra-border rounded-lg p-8 shadow-card text-center animate-fadeInUp">
            <ClipboardList className="w-8 h-8 text-mytra-purple mx-auto mb-3" />
            <p className="text-sm font-medium text-fg mb-1">Ready to go</p>
            <p className="text-xs text-fg-3 mb-4">No safety records yet. Start your day with a Pre-Task Plan.</p>
            <Link
              href="/safety/ptp"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                         bg-mytra-purple text-white hover:bg-mytra-purple-hover transition-colors min-h-[44px]"
            >
              <ClipboardList className="w-4 h-4" /> Start PTP
            </Link>
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
  href,
}: {
  label: string
  value: string
  sub: string
  tone: 'good' | 'warn' | 'neutral' | 'danger'
  delayMs?: number
  href?: string
}) {
  const valueColor = tone === 'good' ? 'text-ok' : tone === 'warn' ? 'text-warn' : tone === 'danger' ? 'text-danger' : 'text-fg'
  const cls = `bg-mytra-card border border-mytra-border rounded-lg p-4 shadow-card
                    transition-shadow duration-200 hover:shadow-pop animate-blurIn ${href ? 'press-scale' : ''}`
  const content = (
    <>
      <p className="text-xs uppercase tracking-wider text-fg-3">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 ${valueColor}`}>{value}</p>
      <p className="text-xs text-fg-4">{sub}</p>
    </>
  )
  if (href) {
    return (
      <Link href={href} style={{ animationDelay: `${delayMs}ms` }} className={cls}>
        {content}
      </Link>
    )
  }
  return (
    <div style={{ animationDelay: `${delayMs}ms` }} className={cls}>
      {content}
    </div>
  )
}
