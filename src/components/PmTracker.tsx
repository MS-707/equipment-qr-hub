'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { User, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'
import { EquipmentItem } from '@/lib/types'
import {
  getPmAssignment,
  setPmAssignment,
  getLatestPmCompletion,
  recordPmCompletion,
  isPmOverdue,
  onShopMgmtChange,
} from '@/lib/shop-management'
import { getCurrentIdentity } from '@/lib/identity'
import { formatDate } from '@/lib/datetime'
import { btnPrimaryCls } from '@/lib/form-styles'

const PM_FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual'] as const
const FREQ_KEYS: Record<string, keyof EquipmentItem> = {
  Daily: 'pmDaily',
  Weekly: 'pmWeekly',
  Monthly: 'pmMonthly',
  Quarterly: 'pmQuarterly',
  'Semi-Annual': 'pmSemiAnnual',
  Annual: 'pmAnnual',
}

interface PmTrackerProps {
  equipment: EquipmentItem
}

export default function PmTracker({ equipment }: PmTrackerProps) {
  const [assignment, setAssignment] = useState(() => getPmAssignment(equipment.itemNumber))
  const [, setTick] = useState(0)
  const [assigning, setAssigning] = useState(false)
  const [driName, setDriName] = useState('')
  const [driEmail, setDriEmail] = useState('')
  const [logFreq, setLogFreq] = useState<string | null>(null)
  const [logNotes, setLogNotes] = useState('')

  useEffect(() => {
    return onShopMgmtChange(() => {
      setAssignment(getPmAssignment(equipment.itemNumber))
      setTick((t) => t + 1)
    })
  }, [equipment.itemNumber])

  const { data: session } = useSession()
  const identity = getCurrentIdentity()
  const canManageDri = session?.user?.isAdmin === true

  const activeFreqs = PM_FREQUENCIES.filter(
    (f) => ((equipment[FREQ_KEYS[f]] as string) ?? '').trim() !== ''
  )

  function handleAssign() {
    if (!driName.trim()) return
    setPmAssignment(equipment.itemNumber, { name: driName.trim(), email: driEmail.trim() || null })
    setDriName('')
    setDriEmail('')
    setAssigning(false)
  }

  function handleAssignSelf() {
    if (!identity) return
    setPmAssignment(equipment.itemNumber, { name: identity.name, email: identity.email })
    setAssigning(false)
  }

  function handleLogCompletion() {
    if (!logFreq) return
    recordPmCompletion({
      itemNumber: equipment.itemNumber,
      frequency: logFreq,
      completedBy: identity?.name ?? 'Unknown',
      completedByEmail: identity?.email ?? null,
      notes: logNotes.trim(),
    })
    setLogFreq(null)
    setLogNotes('')
  }

  return (
    <div className="space-y-4">
      {/* DRI Assignment */}
      <div className="bg-mytra-card border border-mytra-border rounded-card p-4">
        <h3 className="text-sm font-semibold text-fg flex items-center gap-1.5 mb-2">
          <User className="w-4 h-4 text-fg-3" />
          PM Responsible Individual (DRI)
        </h3>

        {assignment ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-fg">{assignment.driName}</p>
              {assignment.driEmail && <p className="text-xs text-fg-3">{assignment.driEmail}</p>}
              <p className="text-xs text-fg-4 mt-0.5">Assigned {formatDate(assignment.assignedAt)}</p>
            </div>
            {canManageDri && (
              <button
                onClick={() => setAssigning(true)}
                className="text-xs text-mytra-purple hover:text-mytra-purple-hover transition-colors"
              >
                Reassign
              </button>
            )}
          </div>
        ) : (
          <div>
            {assigning ? null : (
              <div className="flex items-center gap-2">
                <p className="text-xs text-fg-3 italic flex-1">No DRI assigned</p>
                {canManageDri && (
                  <button
                    onClick={() => setAssigning(true)}
                    className="text-xs font-medium text-mytra-purple hover:text-mytra-purple-hover transition-colors"
                  >
                    Assign DRI
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {assigning && (
          <div className="mt-3 space-y-2 border-t border-mytra-border pt-3">
            {identity && (
              <button
                onClick={handleAssignSelf}
                className="w-full text-left text-xs text-fg-2 bg-mytra-bg border border-mytra-border
                           rounded-lg px-3 py-2 hover:bg-mytra-card-hover transition-colors"
              >
                Assign myself ({identity.name})
              </button>
            )}
            <div>
              <label htmlFor="dri-name" className="sr-only">DRI name</label>
              <input
                id="dri-name"
                type="text"
                autoCapitalize="words"
                placeholder="DRI name"
                value={driName}
                onChange={(e) => setDriName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAssign()}
                className="w-full bg-mytra-bg border border-mytra-border rounded-lg px-3 py-2 text-sm text-fg
                           placeholder:text-fg-4 focus-visible:ring-2 focus-visible:ring-mytra-purple outline-none"
              />
            </div>
            <div>
              <label htmlFor="dri-email" className="sr-only">DRI email (optional)</label>
              <input
                id="dri-email"
                type="email"
                placeholder="DRI email (optional)"
                value={driEmail}
                onChange={(e) => setDriEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAssign()}
                className="w-full bg-mytra-bg border border-mytra-border rounded-lg px-3 py-2 text-sm text-fg
                           placeholder:text-fg-4 focus-visible:ring-2 focus-visible:ring-mytra-purple outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAssign}
                disabled={!driName.trim()}
                className={`${btnPrimaryCls} flex-1 text-xs font-medium py-2`}
              >
                Assign
              </button>
              <button
                onClick={() => { setAssigning(false); setDriName(''); setDriEmail('') }}
                className="px-4 py-2 text-xs font-medium text-fg-2 bg-mytra-bg border border-mytra-border
                           rounded-lg hover:text-fg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PM Status Grid */}
      <div className="bg-mytra-card border border-mytra-border rounded-card p-4">
        <h3 className="text-sm font-semibold text-fg mb-3">PM Completion Status</h3>
        <div className="space-y-2">
          {activeFreqs.map((freq) => {
            const latest = getLatestPmCompletion(equipment.itemNumber, freq)
            const overdue = isPmOverdue(equipment.itemNumber, freq)

            return (
              <div
                key={freq}
                className="flex items-center justify-between bg-mytra-bg border border-mytra-border rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {overdue ? (
                    <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-fg">{freq}</p>
                    {latest ? (
                      <p className="text-xs text-fg-3 truncate">
                        Last: {formatDate(latest.completedAt)} by {latest.completedBy}
                      </p>
                    ) : (
                      <p className="text-xs text-fg-4 italic">Never completed</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setLogFreq(freq)}
                  className="text-xs font-medium text-mytra-purple hover:text-mytra-purple-hover
                             hover:bg-mytra-purple/10 rounded transition-colors shrink-0 px-2 py-1"
                >
                  Log
                </button>
              </div>
            )
          })}
        </div>

        {activeFreqs.length === 0 && (
          <p className="text-xs text-fg-3 italic">No PM schedule defined for this equipment.</p>
        )}
      </div>

      {/* Log Completion Modal */}
      {logFreq && (
        <div className="bg-mytra-card border border-mytra-purple/30 rounded-card p-4 shadow-card">
          <h4 className="text-sm font-medium text-fg mb-2 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-mytra-purple" />
            Log {logFreq} PM — {equipment.name}
          </h4>
          <textarea
            placeholder="Notes (optional)"
            value={logNotes}
            onChange={(e) => setLogNotes(e.target.value)}
            rows={2}
            className="w-full bg-mytra-bg border border-mytra-border rounded-lg px-3 py-2 text-sm text-fg
                       placeholder:text-fg-4 focus-visible:ring-2 focus-visible:ring-mytra-purple outline-none resize-none"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleLogCompletion}
              className={`${btnPrimaryCls} flex-1 text-xs font-medium py-2`}
            >
              Mark Complete
            </button>
            <button
              onClick={() => { setLogFreq(null); setLogNotes('') }}
              className="px-4 py-2 text-xs font-medium text-fg-2 bg-mytra-bg border border-mytra-border
                         rounded-lg hover:text-fg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
