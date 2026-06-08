'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Calendar, ClipboardCheck, GraduationCap, ShieldCheck, Shield } from 'lucide-react'
import { useSwipe } from '@/hooks/useSwipe'
import { EquipmentItem, EquipmentStatus, CATEGORY_COLORS, requiresMachineGuarding, requiresPreTrip } from '@/lib/types'
import { getEquipmentById } from '@/lib/equipment'
import TabNav from '@/components/TabNav'
import StatusToggle from '@/components/StatusToggle'
import PMSchedule from '@/components/PMSchedule'
import PmTracker from '@/components/PmTracker'
import TrainingInfo from '@/components/TrainingInfo'
import TrainingTracker from '@/components/TrainingTracker'
import ComplianceInfo from '@/components/ComplianceInfo'
import PreTripInspection from '@/components/PreTripInspection'
import AuthorizedUsers from '@/components/AuthorizedUsers'

interface EquipmentProfileProps {
  equipment: EquipmentItem
}

type TabId = 'pre-trip' | 'training' | 'pm-schedule' | 'compliance'

export default function EquipmentProfile({ equipment }: EquipmentProfileProps) {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')

  const showPreTrip = requiresPreTrip(equipment)

  const TABS = [
    ...(showPreTrip
      ? [{ id: 'pre-trip' as TabId, label: 'Pre-Trip', icon: <ClipboardCheck className="w-4 h-4" /> }]
      : []),
    { id: 'training' as TabId, label: 'Training', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'pm-schedule' as TabId, label: 'PM Schedule', icon: <Calendar className="w-4 h-4" /> },
    { id: 'compliance' as TabId, label: 'Compliance', icon: <ShieldCheck className="w-4 h-4" /> },
  ]

  const TAB_IDS = TABS.map((t) => t.id)

  function isValidTab(value: string | null): value is TabId {
    return TAB_IDS.includes(value as TabId)
  }

  const defaultTab: TabId = showPreTrip ? 'pre-trip' : 'training'
  const initialTab = isValidTab(tabParam) ? tabParam : defaultTab

  const [activeTab, setActiveTab] = useState<TabId>(initialTab)
  const [tabDirection, setTabDirection] = useState<'left' | 'right'>('right')
  const [status, setStatus] = useState<EquipmentStatus>(equipment.status)
  const categoryColor = CATEGORY_COLORS[equipment.category]

  // Sync tab state if URL param changes (e.g. browser back/forward)
  useEffect(() => {
    if (isValidTab(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam, activeTab])

  function handleInspectionStatusChange() {
    const updated = getEquipmentById(equipment.itemNumber)
    if (updated) setStatus(updated.status)
  }

  function handleTabChange(id: string) {
    const tabId = id as TabId
    const oldIdx = TAB_IDS.indexOf(activeTab)
    const newIdx = TAB_IDS.indexOf(tabId)
    setTabDirection(newIdx >= oldIdx ? 'right' : 'left')
    setActiveTab(tabId)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tabId)
    window.history.replaceState(null, '', url.toString())
  }

  const goNext = useCallback(() => {
    const idx = TAB_IDS.indexOf(activeTab)
    if (idx < TAB_IDS.length - 1) handleTabChange(TAB_IDS[idx + 1])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, TAB_IDS])

  const goPrev = useCallback(() => {
    const idx = TAB_IDS.indexOf(activeTab)
    if (idx > 0) handleTabChange(TAB_IDS[idx - 1])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, TAB_IDS])

  const swipeHandlers = useSwipe(goNext, goPrev)

  return (
    <main className="min-h-screen bg-mytra-bg">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Back link */}
        <Link
          href="/equipment"
          className="inline-flex items-center gap-1.5 text-fg-3 hover:text-fg
                     text-sm transition-colors duration-150 mb-6 py-2 -ml-2 pl-2 pr-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Equipment
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className="inline-block text-xs font-medium px-2.5 py-0.5 rounded-full"
              style={{
                backgroundColor: `${categoryColor}18`,
                color: categoryColor,
              }}
            >
              {equipment.category}
            </span>
            <StatusToggle
              itemNumber={equipment.itemNumber}
              currentStatus={status}
              onStatusChange={setStatus}
            />
            {requiresMachineGuarding(equipment) && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-warn/10 text-warn">
                <Shield className="w-3 h-3" />
                Machine Guarding Required
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-fg leading-tight">
            {equipment.name}
          </h1>
        </div>

        {/* Authorization */}
        <div className="mb-6">
          <AuthorizedUsers itemNumber={equipment.itemNumber} />
        </div>

        {/* Tab Navigation */}
        <TabNav tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />

        {/* Tab Content */}
        <div
          key={activeTab}
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className={`mt-5 ${tabDirection === 'right' ? 'animate-slideInRight' : 'animate-slideInLeft'}`}
          {...swipeHandlers}
        >
          {activeTab === 'pre-trip' && (
            <PreTripInspection
              equipment={equipment}
              onStatusChange={handleInspectionStatusChange}
            />
          )}
          {activeTab === 'training' && (
            <div className="space-y-6">
              <TrainingInfo equipment={equipment} />
              <TrainingTracker equipment={equipment} />
            </div>
          )}
          {activeTab === 'pm-schedule' && (
            <div className="space-y-6">
              <PmTracker equipment={equipment} />
              <PMSchedule equipment={equipment} />
            </div>
          )}
          {activeTab === 'compliance' && <ComplianceInfo equipment={equipment} />}
        </div>
      </div>
    </main>
  )
}
