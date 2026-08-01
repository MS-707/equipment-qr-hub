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
import { useT } from '@/lib/i18n'
import type { MessageKey } from '@/lib/i18n-keys'

const PM_FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual'] as const
const FREQ_KEYS: Record<string, keyof EquipmentItem> = {
  Daily: 'pmDaily',
  Weekly: 'pmWeekly',
  Monthly: 'pmMonthly',
  Quarterly: 'pmQuarterly',
  'Semi-Annual': 'pmSemiAnnual',
  Annual: 'pmAnnual',
}
// Display-only mapping — the English frequency strings stay the stored/lookup
// values (FREQ_KEYS map keys and the recordPmCompletion payload).
const FREQ_LABEL_KEYS: Record<string, MessageKey> = {
  Daily: 'equipment.freqDaily',
  Weekly: 'equipment.freqWeekly',
  Monthly: 'equipment.freqMonthly',
  Quarterly: 'equipment.freqQuarterly',
  'Semi-Annual': 'equipment.freqSemiAnnual',
  Annual: 'equipment.freqAnnual',
}

interface PmTrackerProps {
  equipment: EquipmentItem
}

export default function PmTracker({ equipment }: PmTrackerProps) {
  const t = useT()
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
          {t('equipment.pmDriHeading', undefined, 'PM Responsible Individual (DRI)')}
        </h3>

        {assignment ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-fg">{assignment.driName}</p>
              {assignment.driEmail && <p className="text-xs text-fg-3">{assignment.driEmail}</p>}
              <p className="text-xs text-fg-4 mt-0.5">{t('equipment.assignedDate', { date: formatDate(assignment.assignedAt) }, 'Assigned {date}')}</p>
            </div>
            {canManageDri && (
              <button
                onClick={() => setAssigning(true)}
                className="text-xs text-mytra-purple hover:text-mytra-purple-hover transition-colors"
              >
                {t('equipment.reassign', undefined, 'Reassign')}
              </button>
            )}
          </div>
        ) : (
          <div>
            {assigning ? null : (
              <div className="flex items-center gap-2">
                <p className="text-xs text-fg-3 italic flex-1">{t('equipment.noDriAssigned', undefined, 'No DRI assigned')}</p>
                {canManageDri && (
                  <button
                    onClick={() => setAssigning(true)}
                    className="text-xs font-medium text-mytra-purple hover:text-mytra-purple-hover transition-colors"
                  >
                    {t('equipment.assignDri', undefined, 'Assign DRI')}
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
                {t('equipment.assignMyself', { name: identity.name }, 'Assign myself ({name})')}
              </button>
            )}
            <div>
              <label htmlFor="dri-name" className="sr-only">{t('equipment.driNameLabel', undefined, 'DRI name')}</label>
              <input
                id="dri-name"
                type="text"
                autoCapitalize="words"
                placeholder={t('equipment.driNamePlaceholder', undefined, 'DRI name')}
                value={driName}
                onChange={(e) => setDriName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAssign()}
                className="w-full bg-mytra-bg border border-mytra-border rounded-lg px-3 py-2 text-sm text-fg
                           placeholder:text-fg-4 focus-visible:ring-2 focus-visible:ring-mytra-purple outline-none"
              />
            </div>
            <div>
              <label htmlFor="dri-email" className="sr-only">{t('equipment.driEmailLabel', undefined, 'DRI email (optional)')}</label>
              <input
                id="dri-email"
                type="email"
                placeholder={t('equipment.driEmailPlaceholder', undefined, 'DRI email (optional)')}
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
                {t('equipment.assign', undefined, 'Assign')}
              </button>
              <button
                onClick={() => { setAssigning(false); setDriName(''); setDriEmail('') }}
                className="px-4 py-2 text-xs font-medium text-fg-2 bg-mytra-bg border border-mytra-border
                           rounded-lg hover:text-fg transition-colors"
              >
                {t('common.cancel', undefined, 'Cancel')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PM Status Grid */}
      <div className="bg-mytra-card border border-mytra-border rounded-card p-4">
        <h3 className="text-sm font-semibold text-fg mb-3">{t('equipment.pmCompletionStatus', undefined, 'PM Completion Status')}</h3>
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
                    <p className="text-sm text-fg">{t(FREQ_LABEL_KEYS[freq], undefined, freq)}</p>
                    {latest ? (
                      <p className="text-xs text-fg-3 truncate">
                        {t('equipment.lastCompletedBy', {
                          date: formatDate(latest.completedAt),
                          // 'Unknown' is stored English on the record — localize at render only
                          name: latest.completedBy === 'Unknown' ? t('equipment.unknownUser', undefined, 'Unknown') : latest.completedBy,
                        }, 'Last: {date} by {name}')}
                      </p>
                    ) : (
                      <p className="text-xs text-fg-4 italic">{t('equipment.neverCompleted', undefined, 'Never completed')}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setLogFreq(freq)}
                  className="text-xs font-medium text-mytra-purple hover:text-mytra-purple-hover
                             hover:bg-mytra-purple/10 rounded transition-colors shrink-0 px-2 py-1"
                >
                  {t('equipment.log', undefined, 'Log')}
                </button>
              </div>
            )
          })}
        </div>

        {activeFreqs.length === 0 && (
          <p className="text-xs text-fg-3 italic">{t('equipment.noPmScheduleDefined', undefined, 'No PM schedule defined for this equipment.')}</p>
        )}
      </div>

      {/* Log Completion Modal */}
      {logFreq && (
        <div className="bg-mytra-card border border-mytra-purple/30 rounded-card p-4 shadow-card">
          <h4 className="text-sm font-medium text-fg mb-2 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-mytra-purple" />
            {t('equipment.logPmHeading', {
              frequency: t(FREQ_LABEL_KEYS[logFreq], undefined, logFreq),
              name: equipment.name,
            }, 'Log {frequency} PM — {name}')}
          </h4>
          <textarea
            placeholder={t('equipment.notesPlaceholder', undefined, 'Notes (optional)')}
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
              {t('equipment.markComplete', undefined, 'Mark Complete')}
            </button>
            <button
              onClick={() => { setLogFreq(null); setLogNotes('') }}
              className="px-4 py-2 text-xs font-medium text-fg-2 bg-mytra-bg border border-mytra-border
                         rounded-lg hover:text-fg transition-colors"
            >
              {t('common.cancel', undefined, 'Cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
