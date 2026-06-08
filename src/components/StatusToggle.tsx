'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { EquipmentStatus, EQUIPMENT_STATUS_COLORS } from '@/lib/types'
import { updateEquipmentStatus } from '@/lib/equipment'
import { getCurrentIdentity } from '@/lib/identity'
import { isAdmin } from '@/lib/admin'

const STATUSES: EquipmentStatus[] = ['Active', 'Out of Service', 'Pending Repair', 'Retired']

interface StatusToggleProps {
  itemNumber: number
  currentStatus: EquipmentStatus
  onStatusChange: (status: EquipmentStatus) => void
}

export default function StatusToggle({ itemNumber, currentStatus, onStatusChange }: StatusToggleProps) {
  const [isOpen, setIsOpen] = useState(false)
  const color = EQUIPMENT_STATUS_COLORS[currentStatus]
  const identity = getCurrentIdentity()
  const canEdit = isAdmin(identity?.email)

  function handleSelect(status: EquipmentStatus) {
    if (!canEdit) return
    updateEquipmentStatus(itemNumber, status)
    onStatusChange(status)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <span
        className={`inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full transition-colors min-h-[44px] ${canEdit ? 'cursor-pointer' : ''}`}
        style={{
          backgroundColor: `${color}18`,
          color: color,
        }}
        role={canEdit ? 'button' : undefined}
        tabIndex={canEdit ? 0 : undefined}
        onClick={canEdit ? () => setIsOpen(!isOpen) : undefined}
        aria-haspopup={canEdit ? 'listbox' : undefined}
        aria-expanded={canEdit ? isOpen : undefined}
      >
        {currentStatus}
        {canEdit && <ChevronDown className="w-3 h-3" />}
      </span>

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
