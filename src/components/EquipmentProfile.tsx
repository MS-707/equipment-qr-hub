'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Calendar, GraduationCap, ShieldCheck } from 'lucide-react'
import { EquipmentItem, CATEGORY_COLORS } from '@/lib/types'
import TabNav from '@/components/TabNav'
import PMSchedule from '@/components/PMSchedule'
import TrainingInfo from '@/components/TrainingInfo'
import ComplianceInfo from '@/components/ComplianceInfo'

interface EquipmentProfileProps {
  equipment: EquipmentItem
}

const TABS = [
  { id: 'pm-schedule', label: 'PM Schedule', icon: <Calendar className="w-4 h-4" /> },
  { id: 'training', label: 'Training', icon: <GraduationCap className="w-4 h-4" /> },
  { id: 'compliance', label: 'Compliance', icon: <ShieldCheck className="w-4 h-4" /> },
]

export default function EquipmentProfile({ equipment }: EquipmentProfileProps) {
  const [activeTab, setActiveTab] = useState('pm-schedule')
  const categoryColor = CATEGORY_COLORS[equipment.category]

  return (
    <main className="min-h-screen bg-mytra-bg">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-gray-500 hover:text-white
                     text-sm transition-colors duration-150 mb-6"
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
          </div>
          <h1 className="text-2xl font-bold text-white leading-tight">
            {equipment.name}
          </h1>
        </div>

        {/* Tab Navigation */}
        <TabNav tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        <div className="mt-5">
          {activeTab === 'pm-schedule' && <PMSchedule equipment={equipment} />}
          {activeTab === 'training' && <TrainingInfo equipment={equipment} />}
          {activeTab === 'compliance' && <ComplianceInfo equipment={equipment} />}
        </div>
      </div>
    </main>
  )
}
