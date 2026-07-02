'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { ChevronDown } from 'lucide-react'
import { EquipmentStatus, EQUIPMENT_STATUS_COLORS } from '@/lib/types'
import { updateEquipmentStatus } from '@/lib/equipment'

const STATUSES: EquipmentStatus[] = ['Active', 'Out of Service', 'Pending Repair', 'Retired']

interface StatusToggleProps {
  itemNumber: number
  currentStatus: EquipmentStatus
  onStatusChange: (status: EquipmentStatus) => void
}

export default function StatusToggle({ itemNumber, currentStatus, onStatusChange }: StatusToggleProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { data: session } = useSession()
  const color = EQUIPMENT_STATUS_COLORS[currentStatus]
  const canEdit = session?.user?.isAdmin === true

  function handleSelect(status: EquipmentStatus) {
    if (!canEdit) return
    updateEquipmentStatus(itemNumber, status)
    onStatusChange(status)
    setIsOpen(false)
  }

  // Real <button> for admins so Enter/Space work for free — a span with
  // role="button" and no keydown handler locked keyboard users out of
  // marking equipment Out of Service.
  return (
    <div className="relative">
      {canEdit ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full transition-colors min-h-[44px]
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple"
          style={{
            backgroundColor: `${color}18`,
            color: color,
          }}
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          {currentStatus}
          <ChevronDown className="w-3 h-3" />
        </button>
      ) : (
        <span
          className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full min-h-[44px]"
          style={{
            backgroundColor: `${color}18`,
            color: color,
          }}
        >
          {currentStatus}
        </span>
      )}

      {isOpen && (
        <>
          {/* Backdrop to close on outside click */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div
            role="listbox"
            aria-label="Equipment status"
            className="absolute left-0 top-full mt-1 z-50 bg-mytra-card border border-mytra-border
                       rounded-lg shadow-lg overflow-hidden min-w-[160px] animate-slideDown origin-top"
          >
            {STATUSES.map((status) => {
              const statusColor = EQUIPMENT_STATUS_COLORS[status]
              const isSelected = status === currentStatus
              return (
                <button
                  key={status}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(status)}
                  className={`w-full text-left px-3 py-2.5 text-xs font-medium flex items-center gap-2 min-h-[44px]
                             transition-colors hover:bg-mytra-card-hover ${
                               isSelected ? 'bg-mytra-card-hover' : ''
                             }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: statusColor }}
                  />
                  <span style={{ color: statusColor }}>{status}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
