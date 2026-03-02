import Link from 'next/link'
import { Shield } from 'lucide-react'
import { EquipmentItem, CATEGORY_COLORS, requiresMachineGuarding } from '@/lib/types'

interface EquipmentCardProps {
  equipment: EquipmentItem
  showCategory?: boolean
}

export default function EquipmentCard({ equipment, showCategory = true }: EquipmentCardProps) {
  const categoryColor = CATEGORY_COLORS[equipment.category]
  const hasGuarding = requiresMachineGuarding(equipment)

  return (
    <Link
      href={`/equipment/${equipment.itemNumber}`}
      className="block bg-mytra-card border border-mytra-border rounded-lg p-4
                 hover:bg-mytra-card-hover transition-colors duration-150
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
      </div>

      {/* Equipment name */}
      <p className="text-white font-medium text-sm leading-snug">
        {equipment.name}
      </p>
    </Link>
  )
}
