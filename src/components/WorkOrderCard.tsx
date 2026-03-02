'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Mail,
  CheckCircle2,
  Circle,
  Clock,
} from 'lucide-react'
import { WorkOrder, PM_TYPE_COLORS, WorkOrderStatus } from '@/lib/types'
import { updateWorkOrder, deleteWorkOrder, isOverdue } from '@/lib/work-orders'
import { getEquipmentById } from '@/lib/equipment'

interface WorkOrderCardProps {
  workOrder: WorkOrder
  onUpdate: () => void
}

const STATUS_FLOW: WorkOrderStatus[] = ['Not Started', 'In Progress', 'Complete']

const STATUS_ICONS: Record<WorkOrderStatus, typeof Circle> = {
  'Not Started': Circle,
  'In Progress': Clock,
  'Complete': CheckCircle2,
}

export default function WorkOrderCard({ workOrder, onUpdate }: WorkOrderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [notes, setNotes] = useState(workOrder.completionNotes)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    return () => { clearTimeout(deleteTimerRef.current) }
  }, [])

  const equipment = useMemo(
    () => getEquipmentById(workOrder.equipmentId),
    [workOrder.equipmentId]
  )
  const overdue = isOverdue(workOrder)
  const pmColor = PM_TYPE_COLORS[workOrder.pmType]

  function cycleStatus() {
    const currentIdx = STATUS_FLOW.indexOf(workOrder.status)
    const nextStatus = STATUS_FLOW[(currentIdx + 1) % STATUS_FLOW.length]
    updateWorkOrder(workOrder.id, { status: nextStatus })
    onUpdate()
  }

  function saveNotes() {
    updateWorkOrder(workOrder.id, { completionNotes: notes })
    onUpdate()
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      deleteTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    deleteWorkOrder(workOrder.id)
    onUpdate()
  }

  const StatusIcon = STATUS_ICONS[workOrder.status]

  const tasks = workOrder.tasks
    .split(';')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

  return (
    <div
      className={`bg-mytra-card border rounded-lg overflow-hidden transition-colors ${
        overdue ? 'border-red-500/50' : 'border-mytra-border'
      }`}
    >
      {/* Card Header */}
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Equipment name + link */}
            {equipment && (
              <Link
                href={`/equipment/${equipment.itemNumber}?tab=pm-schedule`}
                className="text-gray-400 text-xs hover:text-mytra-purple transition-colors
                           truncate block"
              >
                {equipment.name}
              </Link>
            )}

            {/* PM type badge + WO number */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className="text-xs font-medium px-2 py-0.5 rounded"
                style={{
                  backgroundColor: `${pmColor}18`,
                  color: pmColor,
                }}
              >
                {workOrder.pmType} PM
              </span>
              <span className="text-xs text-gray-600 font-mono">
                {workOrder.id}
              </span>
              {overdue && (
                <span className="inline-flex items-center gap-1 text-xs text-red-400 font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  Overdue
                </span>
              )}
            </div>
          </div>

          {/* Status toggle */}
          <button
            onClick={cycleStatus}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full
                       transition-colors hover:opacity-80 shrink-0"
            style={{
              backgroundColor:
                workOrder.status === 'Complete'
                  ? '#22C55E18'
                  : workOrder.status === 'In Progress'
                  ? '#3B82F618'
                  : '#6B728018',
              color:
                workOrder.status === 'Complete'
                  ? '#22C55E'
                  : workOrder.status === 'In Progress'
                  ? '#3B82F6'
                  : '#6B7280',
            }}
            title="Click to change status"
          >
            <StatusIcon className="w-3 h-3" />
            {workOrder.status}
          </button>
        </div>

        {/* Due date + assignee */}
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
          {workOrder.dueDate && (
            <span className={overdue ? 'text-red-400' : ''}>
              Due {workOrder.dueDate}
            </span>
          )}
          {workOrder.assignedTo && (
            <span>Assigned: {workOrder.assignedTo}</span>
          )}
          {workOrder.completedDate && (
            <span className="text-green-400">
              Completed {workOrder.completedDate}
            </span>
          )}
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-center gap-1 text-xs text-gray-500
                   hover:text-white hover:bg-mytra-card-hover transition-colors border-t border-mytra-border"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="w-3 h-3" /> Less
          </>
        ) : (
          <>
            <ChevronDown className="w-3 h-3" /> {tasks.length} tasks
          </>
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-mytra-border space-y-3">
          {/* Task list */}
          <ul className="mt-3 space-y-1.5">
            {tasks.map((task, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                <span className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-gray-600" />
                <span>{task}</span>
              </li>
            ))}
          </ul>

          {/* Completion notes */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Completion Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={2}
              placeholder="Issues found, parts replaced, observations..."
              className="w-full bg-mytra-input border border-mytra-border rounded py-2 px-3
                         text-xs text-white placeholder:text-gray-600 resize-none
                         focus:outline-none focus:ring-1 focus:ring-mytra-purple"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Linear dispatch placeholder */}
            <button
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5
                         rounded-lg border border-mytra-border text-gray-400
                         hover:text-white hover:bg-mytra-card-hover transition-colors"
              title="Send to Linear (requires Linear integration)"
              onClick={() => {
                const title = `${equipment?.name || 'Equipment'} - ${workOrder.pmType} PM`
                const desc = `**Work Order:** ${workOrder.id}\n**Due:** ${workOrder.dueDate || 'No date'}\n\n**Tasks:**\n${tasks.map(t => `- ${t}`).join('\n')}`
                navigator.clipboard.writeText(`${title}\n\n${desc}`)
                  .then(() => alert('Work order details copied to clipboard.\nUse Linear to create the issue.'))
                  .catch(() => alert('Could not copy to clipboard. Please copy manually.'))
              }}
            >
              <ExternalLink className="w-3 h-3" />
              Send to Linear
            </button>

            {/* Gmail dispatch placeholder */}
            <button
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5
                         rounded-lg border border-mytra-border text-gray-400
                         hover:text-white hover:bg-mytra-card-hover transition-colors"
              title="Email work order (requires Gmail integration)"
              onClick={() => {
                const subject = `PM Work Order: ${equipment?.name || 'Equipment'} - ${workOrder.pmType} PM [${workOrder.id}]`
                const body = `Work Order: ${workOrder.id}\nEquipment: ${equipment?.name || 'Unknown'}\nPM Type: ${workOrder.pmType}\nDue Date: ${workOrder.dueDate || 'Not set'}\n\nTasks:\n${tasks.map(t => `• ${t}`).join('\n')}\n\n---\nSent from Equipment QR Hub`
                window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
              }}
            >
              <Mail className="w-3 h-3" />
              Email
            </button>

            {/* Delete */}
            <button
              onClick={handleDelete}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5
                         rounded-lg transition-colors ml-auto ${
                           confirmDelete
                             ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                             : 'text-gray-600 hover:text-red-400'
                         }`}
            >
              <Trash2 className="w-3 h-3" />
              {confirmDelete ? 'Confirm Delete' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
