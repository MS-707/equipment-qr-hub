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
import { permitDisplayStatus } from '@/lib/safety-records'
import { StatCardSkeleton, RecordCardSkeleton } from '@/components/Skeleton'
import PullToRefresh from '@/components/PullToRefresh'
import SyncQueuePanel from './SyncQueuePanel'
import { localToday } from '@/lib/datetime'
import { useT } from '@/lib/i18n'

function today(): string {
  return localToday()
}

const QUICK_ACTIONS: { href: string; labelKey: string; icon: typeof ClipboardList; primary?: boolean; external?: boolean }[] = [
  { href: '/safety/ptp', labelKey: 'dashboard.startPtp', icon: ClipboardList, primary: true },
  { href: '/safety/jha', labelKey: 'dashboard.jobHazardAnalysis', icon: ListChecks },
  { href: '/safety/permits/height', labelKey: 'dashboard.workAtHeight', icon: ArrowUpFromLine },
  { href: '/safety/permits/hot-work', labelKey: 'dashboard.hotWork', icon: Flame },
  { href: '/safety/permits/confined-space', labelKey: 'dashboard.confinedSpace', icon: PackageOpen },
  { href: '/safety/incident', labelKey: 'dashboard.reportIncident', icon: AlertTriangle },
  { href: 'https://sds-five-beta.vercel.app', labelKey: 'dashboard.sdsBinder', icon: FlaskConical, external: true },
  { href: '/inspections', labelKey: 'dashboard.preTripInspection', icon: Truck },
]

export default function SafetyDashboard() {
  const t = useT()
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
            {firstName ? t('dashboard.greeting', { name: firstName }) : t('dashboard.homeTitle')}
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
          label={ptpStatus.status === 'active' && ptpStatus.ptp.validUntil ? (ptpDayLabel(ptpStatus.ptp, today()) ?? t('dashboard.todaysPtp')) : t('dashboard.todaysPtp')}
          value={ptpStatus.status === 'active' ? t('dashboard.active') : ptpStatus.status === 'expired' ? t('dashboard.expired') : t('dashboard.notStarted')}
          sub={ptpStatus.status === 'active' ? t('dashboard.crewSigned', { count: ptpStatus.ptp.crewSignatures.length }) : ptpStatus.status === 'expired' ? t('common.tapToRenew') : t('common.tapToStart')}
          tone={ptpStatus.status === 'active' ? 'good' : ptpStatus.status === 'expired' ? 'danger' : 'warn'}
          delayMs={0}
          href={ptpStatus.status === 'active' ? `/safety/record/${ptpStatus.ptp.id}` : '/safety/ptp'}
        />
        <StatCard label={t('dashboard.activePermits')} value={String(activePermits.length)} sub={t('dashboard.openNow')} tone="neutral" delayMs={60} />
        <StatCard label={t('dashboard.incidents')} value={String(incidentCount)} sub={t('dashboard.last7days')} tone={incidentCount > 0 ? 'warn' : 'neutral'} delayMs={120} />
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
            {t('dashboard.needsRevision', { count: reviewRejectedCount })}
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
            {t('dashboard.approvedByEhs', { count: reviewApprovedCount })}
          </p>
          <ChevronRight className="w-3.5 h-3.5 text-ok shrink-0" />
        </Link>
      )}

      {/* Quick actions */}
      <section data-tour-module="quick-actions">
        <h2 className="heading-rule text-xs uppercase tracking-wider text-fg-3 font-semibold mb-2 px-1">{t('dashboard.quickActions')}</h2>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map(({ href, labelKey, icon: Icon, primary, external }, i) => {
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
                  {t(labelKey)}
                </a>
              )
            }
            return (
              <Link key={href} href={href} className={cls} style={style}>
                <Icon className="w-4 h-4 shrink-0" />
                {t(labelKey)}
              </Link>
            )
          })}
        </div>
      </section>

      {/* Active permits */}
      {activePermits.length > 0 && (
        <section>
          <h2 data-tour-module="active-permits" className="heading-rule text-xs uppercase tracking-wider text-fg-3 font-semibold mb-2 px-1">{t('dashboard.activePermits')}</h2>
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
          <h2 className="heading-rule flex-1 text-xs uppercase tracking-wider text-fg-3 font-semibold">{t('dashboard.recentActivity')}</h2>
          <Link href="/safety/history" className="text-xs text-mytra-purple hover:underline inline-flex items-center gap-0.5 min-h-[44px] px-2 -mr-2">
            {t('common.viewAll')} <ChevronRight className="w-3 h-3" />
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
            <p className="text-sm font-medium text-fg mb-1">{t('dashboard.emptyTitle')}</p>
            <p className="text-xs text-fg-3 mb-4">{t('dashboard.emptySub')}</p>
            <Link
              href="/safety/ptp"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                         bg-mytra-purple text-white hover:bg-mytra-purple-hover transition-colors min-h-[44px]"
            >
              <ClipboardList className="w-4 h-4" /> {t('dashboard.startPtp')}
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
