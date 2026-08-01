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
import { haptic } from '@/lib/haptic'
import { useSession } from 'next-auth/react'
import { useT } from '@/lib/i18n'
import { formatDate } from '@/lib/datetime'

interface WorkOrderCardProps {
  workOrder: WorkOrder
  onUpdate: () => void
}

const STATUS_FLOW: WorkOrderStatus[] = ['Not Started', 'In Progress', 'Complete']

// Display-key maps: status / PM type are typed enum VALUES (record keys stay
// English); only the rendered label is localized.
const STATUS_KEY = {
  'Not Started': 'workOrders.statusNotStarted',
  'In Progress': 'workOrders.statusInProgress',
  'Complete': 'workOrders.statusComplete',
} as const

const PM_TYPE_KEY = {
  'Daily': 'workOrders.pmTypeDaily',
  'Weekly': 'workOrders.pmTypeWeekly',
  'Monthly': 'workOrders.pmTypeMonthly',
  'Quarterly': 'workOrders.pmTypeQuarterly',
  'Semi-Annual': 'workOrders.pmTypeSemiAnnual',
  'Annual': 'workOrders.pmTypeAnnual',
} as const

const STATUS_ICONS: Record<WorkOrderStatus, typeof Circle> = {
  'Not Started': Circle,
  'In Progress': Clock,
  'Complete': CheckCircle2,
}

export default function WorkOrderCard({ workOrder, onUpdate }: WorkOrderCardProps) {
  const t = useT()
  const [isExpanded, setIsExpanded] = useState(false)
  const [notes, setNotes] = useState(workOrder.completionNotes)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copyMsg, setCopyMsg] = useState<string | null>(null)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const { data: session } = useSession()
  const canDelete = session?.user?.isAdmin === true

  useEffect(() => {
    return () => { clearTimeout(deleteTimerRef.current) }
  }, [])

  useEffect(() => {
    if (!copyMsg) return
    const timer = setTimeout(() => setCopyMsg(null), 2500)
    return () => clearTimeout(timer)
  }, [copyMsg])

  const equipment = useMemo(
    () => getEquipmentById(workOrder.equipmentId),
    [workOrder.equipmentId]
  )
  const overdue = isOverdue(workOrder)
  const pmColor = PM_TYPE_COLORS[workOrder.pmType]

  function cycleStatus() {
    const currentIdx = STATUS_FLOW.indexOf(workOrder.status)
    if (currentIdx >= STATUS_FLOW.length - 1) return
    const nextStatus = STATUS_FLOW[currentIdx + 1]
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
      haptic('warning')
      deleteTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    deleteWorkOrder(workOrder.id)
    onUpdate()
  }

  const StatusIcon = STATUS_ICONS[workOrder.status]

  const tasks = workOrder.tasks
    .split(';')
    .map((task) => task.trim())
    .filter((task) => task.length > 0)

  return (
    <div
      className={`relative bg-mytra-card border rounded-card overflow-hidden transition-all duration-200 shadow-card ${
        overdue ? 'border-danger/50' : 'border-mytra-border'
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
                className="text-fg-3 text-xs hover:text-mytra-purple transition-colors
                           min-h-[44px] flex items-center"
              >
                <span className="truncate">{equipment.name}</span>
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
                {t('workOrders.pmBadge', { pmType: t(PM_TYPE_KEY[workOrder.pmType]) })}
              </span>
              <span className="text-xs text-fg-4 font-mono tabular-nums">
                {workOrder.id}
              </span>
              {overdue && (
                <span className="inline-flex items-center gap-1 text-xs text-danger font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  {t('workOrders.overdue', undefined, 'Overdue')}
                </span>
              )}
            </div>
          </div>

          {/* Status toggle */}
          <button
            data-tour-module="wo-status"
            onClick={cycleStatus}
            aria-label={t('workOrders.statusToggleAria', { status: t(STATUS_KEY[workOrder.status]) })}
            className="flex items-center gap-1.5 text-xs font-medium px-4 py-2.5 rounded-full
                       transition-colors hover:opacity-80 shrink-0 min-h-[44px]"
            style={{
              backgroundColor:
                workOrder.status === 'Complete'
                  ? 'color-mix(in srgb, var(--ok) 10%, transparent)'
                  : workOrder.status === 'In Progress'
                  ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
                  : 'color-mix(in srgb, var(--fg-4) 10%, transparent)',
              color:
                workOrder.status === 'Complete'
                  ? 'var(--ok)'
                  : workOrder.status === 'In Progress'
                  ? 'var(--accent)'
                  : 'var(--fg-4)',
            }}
            title={t('workOrders.statusToggleTitle', undefined, 'Click to change status')}
          >
            <StatusIcon className="w-3 h-3" />
            {t(STATUS_KEY[workOrder.status])}
          </button>
        </div>

        {/* Due date + assignee */}
        <div className="flex items-center gap-3 mt-2 text-xs text-fg-4">
          {workOrder.dueDate && (
            <span className={`tabular-nums ${overdue ? 'text-danger' : ''}`}>
              {t('workOrders.dueDate', { dueDate: formatDate(workOrder.dueDate) })}
            </span>
          )}
          {workOrder.assignedTo && (
            <span>{t('workOrders.assignedTo', { assignedTo: workOrder.assignedTo })}</span>
          )}
          {workOrder.completedDate && (
            <span className="text-ok tabular-nums">
              {t('workOrders.completedDate', { completedDate: formatDate(workOrder.completedDate) })}
            </span>
          )}
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="w-full px-4 py-2.5 flex items-center justify-center gap-1 text-xs text-fg-4 min-h-[44px]
                   hover:text-fg hover:bg-mytra-card-hover transition-colors border-t border-mytra-border"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="w-3 h-3" /> {t('workOrders.less', undefined, 'Less')}
          </>
        ) : (
          <>
            <ChevronDown className="w-3 h-3" /> {t('workOrders.tasksCount', { count: tasks.length })}
          </>
        )}
      </button>

      {/* Expanded content */}
      <div className={`accordion-content ${isExpanded ? 'open' : ''}`}>
        <div>
          <div className="px-4 pb-4 border-t border-mytra-border space-y-3">
            {/* Task list */}
            <ul className="mt-3 space-y-1.5">
              {tasks.map((task, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-fg-2">
                  <span className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-fg-4" />
                  <span>{task}</span>
                </li>
              ))}
            </ul>

            {/* Completion notes */}
            <div>
              <label className="text-xs text-fg-4 block mb-1">
                {t('workOrders.completionNotes', undefined, 'Completion Notes')}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={saveNotes}
                rows={2}
                placeholder={t('workOrders.completionNotesPlaceholder', undefined, 'Issues found, parts replaced, observations...')}
                className="w-full bg-mytra-input border border-mytra-border rounded-field py-2 px-3
                           text-xs text-fg placeholder:text-fg-4 resize-none
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Linear dispatch placeholder */}
              <button
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5
                           rounded-lg border border-mytra-border text-fg-3
                           hover:text-fg hover:bg-mytra-card-hover transition-colors min-h-[44px]"
                title={t('workOrders.sendToLinearTitle', undefined, 'Send to Linear (requires Linear integration)')}
                onClick={() => {
                  const title = t('workOrders.shareTitle', {
                    equipmentName: equipment?.name || t('workOrders.equipmentFallback', undefined, 'Equipment'),
                    pmType: t(PM_TYPE_KEY[workOrder.pmType]),
                  })
                  const desc = t('workOrders.shareBody', {
                    id: workOrder.id,
                    dueDate: workOrder.dueDate ? formatDate(workOrder.dueDate) : t('workOrders.noDateFallback', undefined, 'No date'),
                    tasks: tasks.map(task => `- ${task}`).join('\n'),
                  })
                  navigator.clipboard.writeText(`${title}\n\n${desc}`)
                    .then(() => { setCopyMsg(t('workOrders.copiedToClipboard', undefined, 'Copied to clipboard')); haptic('success') })
                    .catch(() => setCopyMsg(t('workOrders.copyFailed', undefined, 'Copy failed — please copy manually')))
                }}
              >
                <ExternalLink className="w-3 h-3" />
                {t('workOrders.sendToLinear', undefined, 'Send to Linear')}
              </button>

              {/* Gmail dispatch placeholder */}
              <button
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5
                           rounded-lg border border-mytra-border text-fg-3
                           hover:text-fg hover:bg-mytra-card-hover transition-colors min-h-[44px]"
                title={t('workOrders.emailTitle', undefined, 'Email work order (requires Gmail integration)')}
                onClick={() => {
                  const subject = t('workOrders.emailSubject', {
                    equipmentName: equipment?.name || t('workOrders.equipmentFallback', undefined, 'Equipment'),
                    pmType: t(PM_TYPE_KEY[workOrder.pmType]),
                    id: workOrder.id,
                  })
                  const body = t('workOrders.emailBody', {
                    id: workOrder.id,
                    equipmentName: equipment?.name || t('workOrders.unknownFallback', undefined, 'Unknown'),
                    pmType: t(PM_TYPE_KEY[workOrder.pmType]),
                    dueDate: workOrder.dueDate ? formatDate(workOrder.dueDate) : t('workOrders.notSetFallback', undefined, 'Not set'),
                    tasks: tasks.map(task => `• ${task}`).join('\n'),
                  })
                  window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
                }}
              >
                <Mail className="w-3 h-3" />
                {t('workOrders.email', undefined, 'Email')}
              </button>

              {/* Delete — admin only */}
              {canDelete && (
                <button
                  onClick={handleDelete}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5
                             rounded-lg transition-colors ml-auto min-h-[44px] ${
                               confirmDelete
                                 ? 'bg-danger/20 text-danger border border-danger/50'
                                 : 'text-fg-4 hover:text-danger'
                             }`}
                >
                  <Trash2 className="w-3 h-3" />
                  {confirmDelete ? t('workOrders.confirmDelete', undefined, 'Confirm Delete') : t('common.delete', undefined, 'Delete')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {copyMsg && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-mytra-card border border-mytra-border
                        rounded-lg px-3 py-2 text-xs text-fg-2 shadow-pop animate-fadeInUp whitespace-nowrap">
          {copyMsg}
        </div>
      )}
    </div>
  )
}
