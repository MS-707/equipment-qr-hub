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
import { haptic } from '@/lib/haptic'
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
import { SDS_EXTERNAL_URL } from '@/lib/nav'
import { btnPrimaryCls, btnSelectedCls } from '@/lib/form-styles'
import { useT } from '@/lib/i18n'
import type { MessageKey } from '@/lib/i18n-keys'

function today(): string {
  return localToday()
}

const QUICK_ACTIONS: { href: string; label: string; labelKey: MessageKey; icon: typeof ClipboardList; primary?: boolean; external?: boolean }[] = [
  { href: '/safety/ptp', label: 'Start PTP', labelKey: 'dashboard.startPtp', icon: ClipboardList, primary: true },
  { href: '/safety/jha', label: 'Job Hazard Analysis', labelKey: 'dashboard.jobHazardAnalysis', icon: ListChecks },
  { href: '/safety/permits/height', label: 'Work-at-Height', labelKey: 'dashboard.workAtHeight', icon: ArrowUpFromLine },
  { href: '/safety/permits/hot-work', label: 'Hot Work', labelKey: 'dashboard.hotWork', icon: Flame },
  { href: '/safety/permits/confined-space', label: 'Confined Space', labelKey: 'dashboard.confinedSpace', icon: PackageOpen },
  { href: '/safety/incident', label: 'Report Incident', labelKey: 'dashboard.reportIncident', icon: AlertTriangle },
  { href: SDS_EXTERNAL_URL, label: 'SDS Library', labelKey: 'dashboard.sdsBinder', icon: FlaskConical, external: true },
  { href: '/inspections', label: 'Pre-Trip Inspection', labelKey: 'dashboard.preTripInspection', icon: Truck },
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
            {firstName ? t('dashboard.greeting', { name: firstName }) : t('dashboard.homeTitle', undefined, 'Home')}
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
          label={ptpStatus.status === 'active' && ptpStatus.ptp.validUntil ? (ptpDayLabel(ptpStatus.ptp, today()) ?? t('dashboard.todaysPtp', undefined, "Today's PTP")) : t('dashboard.todaysPtp', undefined, "Today's PTP")}
          value={ptpStatus.status === 'active' ? t('dashboard.active', undefined, 'Active') : ptpStatus.status === 'expired' ? t('dashboard.expired', undefined, 'Expired') : t('dashboard.notStarted', undefined, 'Not started')}
          sub={ptpStatus.status === 'active' ? t('dashboard.crewSigned', { count: ptpStatus.ptp.crewSignatures.length }) : ptpStatus.status === 'expired' ? t('common.tapToRenew', undefined, 'Tap to renew') : t('common.tapToStart', undefined, 'Tap to start')}
          tone={ptpStatus.status === 'active' ? 'good' : ptpStatus.status === 'expired' ? 'danger' : 'warn'}
          delayMs={0}
          href={ptpStatus.status === 'active' ? `/safety/record/${ptpStatus.ptp.id}` : '/safety/ptp'}
        />
        <StatCard label={t('dashboard.activePermits', undefined, 'Active permits')} value={String(activePermits.length)} sub={t('dashboard.openNow', undefined, 'open now')} tone="neutral" delayMs={60} />
        <StatCard label={t('dashboard.incidents', undefined, 'Incidents')} value={String(incidentCount)} sub={t('dashboard.last7days', undefined, 'last 7 days')} tone={incidentCount > 0 ? 'warn' : 'neutral'} delayMs={120} />
          </>
        )}
      </div>

      {/* Sync queue */}
      <SyncQueuePanel />

      {/* EHS review banners */}
      {reviewRejectedCount > 0 && (
        <Link
          href="/safety/history"
          onClick={() => haptic('tap')}
          className="flex items-center gap-2 bg-danger/10 border border-danger/30 rounded-card px-4 py-3 min-h-[44px] hover:bg-danger/15 transition-colors"
        >
          <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
          <p className="text-xs text-danger flex-1 tabular-nums">
            {t('dashboard.needsRevision', { count: reviewRejectedCount })}
          </p>
          <ChevronRight className="w-3.5 h-3.5 text-danger shrink-0" />
        </Link>
      )}
      {reviewApprovedCount > 0 && (
        <Link
          href="/safety/history"
          onClick={() => haptic('tap')}
          className="flex items-center gap-2 bg-ok/10 border border-ok/20 rounded-card px-4 py-3 min-h-[44px] hover:bg-ok/15 transition-colors"
        >
          <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
          <p className="text-xs text-ok flex-1 tabular-nums">
            {t('dashboard.approvedByEhs', { count: reviewApprovedCount })}
          </p>
          <ChevronRight className="w-3.5 h-3.5 text-ok shrink-0" />
        </Link>
      )}

      {/* Quick actions */}
      <section data-tour-module="quick-actions">
        <h2 className="heading-rule text-xs uppercase tracking-wider text-fg-3 font-semibold mb-2 px-1">{t('dashboard.quickActions', undefined, 'Quick actions')}</h2>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map(({ href, label, labelKey, icon: Icon, primary, external }, i) => {
            const cls = `flex items-center gap-2 rounded-card px-3 py-4 text-sm font-medium min-h-[44px]
                         transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] border
                         press-scale animate-blurIn ${
              primary
                ? `${btnSelectedCls} border-mytra-purple hover:bg-mytra-purple-hover hover:shadow-raised hover:shadow-mytra-purple/20`
                : 'bg-mytra-card text-fg-2 border-mytra-border hover:bg-mytra-card-hover hover:shadow-raised'
            }`
            const style = { animationDelay: `${100 + i * 40}ms` }
            if (external) {
              return (
                <a key={href} href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style} onClick={() => haptic('tap')}>
                  <Icon className="w-4 h-4 shrink-0" />
                  {t(labelKey, undefined, label)}
                </a>
              )
            }
            return (
              <Link key={href} href={href} className={cls} style={style} onClick={() => haptic('tap')}>
                <Icon className="w-4 h-4 shrink-0" />
                {t(labelKey, undefined, label)}
              </Link>
            )
          })}
        </div>
      </section>

      {/* Active permits */}
      {activePermits.length > 0 && (
        <section>
          <h2 data-tour-module="active-permits" className="heading-rule text-xs uppercase tracking-wider text-fg-3 font-semibold mb-2 px-1">{t('dashboard.activePermits', undefined, 'Active permits')}</h2>
          <div className="space-y-2">
            {activePermits.map((p) => (
              <Link
                key={p.id}
                href={`/safety/record/${p.id}`}
                onClick={() => haptic('tap')}
                className="flex items-center justify-between gap-3 bg-mytra-card border border-mytra-border rounded-card px-3 py-3 shadow-card hover:bg-mytra-card-hover hover:shadow-raised transition-colors press-scale"
              >
                <div className="min-w-0">
                  <p className="text-xs font-mono text-fg-3 tabular-nums">{p.id}</p>
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
          <h2 className="heading-rule flex-1 text-xs uppercase tracking-wider text-fg-3 font-semibold">{t('dashboard.recentActivity', undefined, 'Recent activity')}</h2>
          <Link href="/safety/history" className="text-xs text-mytra-purple hover:underline inline-flex items-center gap-0.5 min-h-[44px] px-2 -mr-2">
            {t('dashboard.viewHistory', undefined, 'View history')} <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {!loaded ? (
          <div className="space-y-2">
            <RecordCardSkeleton />
            <RecordCardSkeleton />
            <RecordCardSkeleton />
          </div>
        ) : recent.length === 0 ? (
          <div className="bg-mytra-card border border-mytra-border rounded-card p-8 shadow-card text-center animate-fadeInUp">
            <ClipboardList className="w-8 h-8 text-mytra-purple mx-auto mb-3" />
            <p className="text-sm font-medium text-fg mb-1">{t('dashboard.emptyTitle', undefined, 'Ready to go')}</p>
            <p className="text-xs text-fg-3 mb-4">{t('dashboard.emptySub', undefined, 'No safety records yet. Start your day with a Pre-Task Plan.')}</p>
            <Link
              href="/safety/ptp"
              className={`${btnPrimaryCls} inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium min-h-[44px]`}
            >
              <ClipboardList className="w-4 h-4" /> {t('dashboard.startPtp', undefined, 'Start PTP')}
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
  const cls = `bg-mytra-card border border-mytra-border rounded-card p-4 shadow-card
                    transition-shadow duration-200 ${href ? 'hover:shadow-raised' : ''} animate-blurIn ${href ? 'press-scale' : ''}`
  const content = (
    <>
      <p className="text-xs uppercase tracking-wider text-fg-3">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 tabular-nums ${valueColor}`}>{value}</p>
      <p className="text-xs text-fg-4">{sub}</p>
    </>
  )
  if (href) {
    return (
      <Link href={href} style={{ animationDelay: `${delayMs}ms` }} className={cls} onClick={() => haptic('tap')}>
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
