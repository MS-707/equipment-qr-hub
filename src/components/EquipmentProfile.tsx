'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Calendar, GraduationCap, ShieldCheck, Shield } from 'lucide-react'
import { EquipmentItem, CATEGORY_COLORS, requiresMachineGuarding } from '@/lib/types'
import TabNav from '@/components/TabNav'
import PMSchedule from '@/components/PMSchedule'
import TrainingInfo from '@/components/TrainingInfo'
import ComplianceInfo from '@/components/ComplianceInfo'

interface EquipmentProfileProps {
  equipment: EquipmentItem
}

const TAB_IDS = ['training', 'pm-schedule', 'compliance'] as const
type TabId = (typeof TAB_IDS)[number]

const TABS = [
  { id: 'training' as TabId, label: 'Training', icon: <GraduationCap className="w-4 h-4" /> },
  { id: 'pm-schedule' as TabId, label: 'PM Schedule', icon: <Calendar className="w-4 h-4" /> },
  { id: 'compliance' as TabId, label: 'Compliance', icon: <ShieldCheck className="w-4 h-4" /> },
]

function isValidTab(value: string | null): value is TabId {
  return TAB_IDS.includes(value as TabId)
}

export default function EquipmentProfile({ equipment }: EquipmentProfileProps) {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const initialTab = isValidTab(tabParam) ? tabParam : 'training'

  const [activeTab, setActiveTab] = useState<TabId>(initialTab)
  const categoryColor = CATEGORY_COLORS[equipment.category]

  // Sync tab state if URL param changes (e.g. browser back/forward)
  useEffect(() => {
    if (isValidTab(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [tabParam, activeTab])

  function handleTabChange(id: string) {
    const tabId = id as TabId
    setActiveTab(tabId)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tabId)
    window.history.replaceState(null, '', url.toString())
  }

  return (
    <main className="min-h-screen bg-mytra-bg">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white
                     text-sm transition-colors duration-150 mb-6 py-2 -ml-2 pl-2 pr-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Directory
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
            <span className="inline-block text-xs font-medium px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-400">
              {equipment.status}
            </span>
            {requiresMachineGuarding(equipment) && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                <Shield className="w-3 h-3" />
                Machine Guarding Required
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white leading-tight">
            {equipment.name}
          </h1>
        </div>

        {/* Tab Navigation */}
        <TabNav tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />

        {/* Tab Content */}
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className="mt-5"
        >
          {activeTab === 'training' && <TrainingInfo equipment={equipment} />}
          {activeTab === 'pm-schedule' && <PMSchedule equipment={equipment} />}
          {activeTab === 'compliance' && <ComplianceInfo equipment={equipment} />}
        </div>
      </div>
    </main>
  )
}
