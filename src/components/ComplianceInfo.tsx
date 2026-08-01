'use client'

import { EquipmentItem } from '@/lib/types'
import { useT } from '@/lib/i18n'

interface ComplianceInfoProps {
  equipment: EquipmentItem
}

export default function ComplianceInfo({ equipment }: ComplianceInfoProps) {
  const t = useT()
  return (
    <div className="space-y-6">
      {/* Maintenance Dates */}
      <div>
        <h3 className="text-sm font-semibold text-fg mb-3">
          {t('compliance.maintenanceDates', undefined, 'Maintenance Dates')}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-mytra-card border border-mytra-border rounded-card p-4">
            <p className="text-xs text-fg-3 mb-1">{t('compliance.lastPmDate', undefined, 'Last PM Date')}</p>
            <p
              className={`text-sm font-medium ${
                equipment.lastPmDate ? 'text-fg' : 'text-fg-4'
              }`}
            >
              {equipment.lastPmDate || t('compliance.notTrackedYet', undefined, 'Not tracked yet')}
            </p>
          </div>
          <div className="bg-mytra-card border border-mytra-border rounded-card p-4">
            <p className="text-xs text-fg-3 mb-1">{t('compliance.nextPmDue', undefined, 'Next PM Due')}</p>
            <p
              className={`text-sm font-medium ${
                equipment.nextPmDue ? 'text-fg' : 'text-fg-4'
              }`}
            >
              {equipment.nextPmDue || t('compliance.notTrackedYet', undefined, 'Not tracked yet')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
