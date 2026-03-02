import Link from 'next/link'
import { EquipmentItem, CATEGORY_COLORS } from '@/lib/types'

interface EquipmentCardProps {
  equipment: EquipmentItem
  showCategory?: boolean
}

export default function EquipmentCard({ equipment, showCategory = true }: EquipmentCardProps) {
  const categoryColor = CATEGORY_COLORS[equipment.category]

  return (
    <Link
      href={`/equipment/${equipment.itemNumber}`}
      className="block bg-mytra-card border border-mytra-border rounded-lg p-4
                 hover:bg-mytra-card-hover transition-colors duration-150
                 min-h-[72px] focus:outline-none focus:ring-2 focus:ring-mytra-purple"
      style={{ borderLeftWidth: '3px', borderLeftColor: categoryColor }}
    >
      {/* Category badge — only shown when not already grouped by category */}
      {showCategory && (
        <span
          className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full mb-1.5"
          style={{
            backgroundColor: `${categoryColor}18`,
            color: categoryColor,
          }}
        >
          {equipment.category}
        </span>
      )}

      {/* Equipment name */}
      <p className="text-white font-medium text-sm leading-snug">
        {equipment.name}
      </p>
    </Link>
  )
}
