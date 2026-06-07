'use client'

import Link from 'next/link'
import { Shield, ShieldAlert } from 'lucide-react'
import { EquipmentItem, CATEGORY_COLORS, requiresMachineGuarding } from '@/lib/types'
import { getAuthorization } from '@/lib/shop-management'

interface EquipmentCardProps {
  equipment: EquipmentItem
  showCategory?: boolean
}

export default function EquipmentCard({ equipment, showCategory = true }: EquipmentCardProps) {
  const categoryColor = CATEGORY_COLORS[equipment.category]
  const hasGuarding = requiresMachineGuarding(equipment)
  const isRestricted = getAuthorization(equipment.itemNumber).restricted

  return (
    <Link
      href={`/equipment/${equipment.itemNumber}`}
      className="block bg-mytra-card border border-mytra-border rounded-lg p-4
                 hover:bg-mytra-card-hover hover:-translate-y-0.5 hover:shadow-lg hover:shadow-mytra-purple/5
                 transition-all duration-150
                 min-h-[72px] focus:outline-none focus:ring-2 focus:ring-mytra-purple"
      style={{ borderLeftWidth: '3px', borderLeftColor: categoryColor }}
    >
      {/* Badges row */}
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        {/* Category badge — only shown when not already grouped by category */}
        {showCategory && (
          <span
            className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: `${categoryColor}18`,
              color: categoryColor,
            }}
          >
            {equipment.category}
          </span>
        )}

        {/* Machine guarding indicator */}
        {hasGuarding && (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5
                       rounded-full bg-amber-500/10 text-amber-400"
            title="Machine guarding required per Cal/OSHA T8 CCR 3556 or 3577"
          >
            <Shield className="w-3 h-3" />
            Guarded
          </span>
        )}

        {/* Restricted access indicator */}
        {isRestricted && (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5
                       rounded-full bg-warn/10 text-warn"
          >
            <ShieldAlert className="w-3 h-3" />
            Restricted
          </span>
        )}
      </div>

      {/* Equipment name */}
      <p className="text-fg font-medium text-sm leading-snug">
        {equipment.name}
      </p>
    </Link>
  )
}
