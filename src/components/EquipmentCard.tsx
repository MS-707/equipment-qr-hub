'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Shield, ShieldAlert } from 'lucide-react'
import { EquipmentItem, CATEGORY_COLORS, requiresMachineGuarding } from '@/lib/types'
import { getAuthorization, onShopMgmtChange } from '@/lib/shop-management'

interface EquipmentCardProps {
  equipment: EquipmentItem
  showCategory?: boolean
}

export default function EquipmentCard({ equipment, showCategory = true }: EquipmentCardProps) {
  const categoryColor = CATEGORY_COLORS[equipment.category]
  const hasGuarding = requiresMachineGuarding(equipment)
  const [isRestricted, setIsRestricted] = useState(false)

  useEffect(() => {
    function refresh() {
      setIsRestricted(getAuthorization(equipment.itemNumber).restricted)
    }
    refresh()
    return onShopMgmtChange(refresh)
  }, [equipment.itemNumber])

  return (
    <Link
      href={`/equipment/${equipment.itemNumber}`}
      className="block bg-mytra-card border border-mytra-border rounded-lg p-4
                 hover:bg-mytra-card-hover hover:-translate-y-0.5 hover:shadow-lg hover:shadow-mytra-purple/5
                 active:translate-y-0 active:shadow-card press-scale
                 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]
                 min-h-[72px] focus:outline-none focus:ring-2 focus:ring-mytra-purple"
      style={{ borderLeftWidth: '3px', borderLeftColor: categoryColor }}
    >
      {/* Badges row */}
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        {/* Category badge — only shown when not already grouped by category */}
        {showCategory && (
          <span
            className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
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
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5
                       rounded-full bg-warn/10 text-warn"
            title="Machine guarding required"
          >
            <Shield className="w-3 h-3" />
            Guarded
          </span>
        )}

        {/* Restricted access indicator */}
        {isRestricted && (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5
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
