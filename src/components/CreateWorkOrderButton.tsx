'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, X, CalendarDays } from 'lucide-react'
import { PmType } from '@/lib/types'
import { createWorkOrder } from '@/lib/work-orders'

interface CreateWorkOrderButtonProps {
  equipmentId: number
  equipmentName: string
  pmType: PmType
  tasks: string
  onCreated?: () => void
}

export default function CreateWorkOrderButton({
  equipmentId,
  equipmentName,
  pmType,
  tasks,
  onCreated,
}: CreateWorkOrderButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [justCreated, setJustCreated] = useState(false)
  const createdTimerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    return () => { clearTimeout(createdTimerRef.current) }
  }, [])

  function handleCreate() {
    createWorkOrder({
      equipmentId,
      pmType,
      tasks,
      dueDate: dueDate || null,
      assignedTo: assignedTo.trim() || null,
    })
    setIsOpen(false)
    setDueDate('')
    setAssignedTo('')
    setJustCreated(true)
    createdTimerRef.current = setTimeout(() => setJustCreated(false), 2000)
    onCreated?.()
  }

  if (justCreated) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-400 font-medium px-2 py-1">
        Created
      </span>
    )
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-mytra-purple
                   transition-colors px-2 py-1 rounded hover:bg-mytra-purple/10"
        title={`Create work order for ${equipmentName} ${pmType} PM`}
      >
        <Plus className="w-3 h-3" />
        <span className="hidden sm:inline">Work Order</span>
      </button>
    )
  }

  return (
    <div className="mt-3 p-3 bg-mytra-bg border border-mytra-border rounded-lg space-y-3 animate-fadeIn">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white">
          New {pmType} PM Work Order
        </span>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Due Date</label>
          <div className="relative">
            <CalendarDays className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-mytra-input border border-mytra-border rounded py-1.5 pl-7 pr-2
                         text-xs text-white focus:outline-none focus:ring-1 focus:ring-mytra-purple"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Assign To</label>
          <input
            type="text"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="Optional"
            className="w-full bg-mytra-input border border-mytra-border rounded py-1.5 px-2
                       text-xs text-white placeholder:text-gray-600
                       focus:outline-none focus:ring-1 focus:ring-mytra-purple"
          />
        </div>
      </div>

      <button
        onClick={handleCreate}
        className="w-full bg-mytra-purple hover:bg-mytra-purple/80 text-white text-xs
                   font-medium py-2 rounded-lg transition-colors"
      >
        Create Work Order
      </button>
    </div>
  )
}
