'use client'

import { useState, useEffect } from 'react'
import { GraduationCap, Plus, CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { EquipmentItem } from '@/lib/types'
import {
  getTrainingForTopic,
  addTrainingRecord,
  isTrainingCurrent,
  onShopMgmtChange,
  EMAIL_RE,
} from '@/lib/shop-management'
import { getCurrentIdentity } from '@/lib/identity'
import { formatDate } from '@/lib/datetime'
import { btnPrimaryCls } from '@/lib/form-styles'
import { useT, type TFunction } from '@/lib/i18n'

interface TrainingTrackerProps {
  equipment: EquipmentItem
}

function parseTrainingTopics(raw: string): string[] {
  return raw
    .split(';')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

/**
 * Map a raw training requirement to a clean, worker-friendly EHS program title.
 * Workers see the program name, not regulatory citations ("per 3314", "29 CFR…").
 * Display-only — the raw `topic` string stays the key for training records.
 */
const PROGRAM_LABELS: { match: RegExp; key: Parameters<TFunction>[0]; title: string }[] = [
  { match: /loto|lockout/i, key: 'training.programLoto', title: 'Lockout/Tagout (LOTO)' },
  { match: /abrasive|grinder|ring test/i, key: 'training.programAbrasiveWheel', title: 'Abrasive Wheel & Grinder Safety' },
  { match: /crane/i, key: 'training.programCrane', title: 'Overhead Crane Operation' },
  { match: /scissor|aerial|mewp/i, key: 'training.programScissorLift', title: 'Scissor Lift / Aerial Platform' },
  { match: /weld|hot ?work/i, key: 'training.programWelding', title: 'Welding & Hot Work Safety' },
  { match: /ladder/i, key: 'training.programLadder', title: 'Ladder Safety' },
  { match: /extinguisher/i, key: 'training.programExtinguisher', title: 'Fire Extinguisher Use' },
  { match: /electrical/i, key: 'training.programElectrical', title: 'Electrical Safety Awareness' },
  { match: /fume|solder|3d ?print/i, key: 'training.programSoldering', title: 'Soldering & Fume Awareness' },
  { match: /machine guard/i, key: 'training.programMachineGuarding', title: 'Machine Guarding Awareness' },
  { match: /\bppe\b/i, key: 'training.programPpe', title: 'PPE Use & Care' },
  { match: /iipp|injury.*illness/i, key: 'training.programIipp', title: 'Injury & Illness Prevention' },
]

function friendlyTrainingLabel(topic: string, t: TFunction): string {
  for (const p of PROGRAM_LABELS) if (p.match.test(topic)) return t(p.key, undefined, p.title)
  // Fallback: strip regulatory citations and tidy whatever remains.
  const cleaned = topic
    .replace(/\bper\b[^;,]*$/i, '')
    .replace(/\b(29\s*CFR|T8\s*CCR|CCR|CFR|NFPA|ANSI|ASME|OSHA)\b[\s\d.§/\-]*/gi, '')
    .replace(/§\s*\d[\d.\-]*/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s,;.\-]+$/, '')
    .trim()
  if (!cleaned) return topic
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

export default function TrainingTracker({ equipment }: TrainingTrackerProps) {
  const t = useT()
  const [, setTick] = useState(0)
  const [addingTopic, setAddingTopic] = useState<string | null>(null)
  const [empName, setEmpName] = useState('')
  const [empEmail, setEmpEmail] = useState('')
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null)

  useEffect(() => {
    return onShopMgmtChange(() => setTick((t) => t + 1))
  }, [])

  const identity = getCurrentIdentity()
  const topics = parseTrainingTopics(equipment.calOshaTrainingReq)

  const validEmail = EMAIL_RE.test(empEmail.trim())

  function handleAdd() {
    if (!addingTopic || !empName.trim() || !validEmail) return
    addTrainingRecord({
      employeeEmail: empEmail.trim(),
      employeeName: empName.trim(),
      topic: addingTopic,
      verifiedBy: identity?.name ?? null,
    })
    setEmpName('')
    setEmpEmail('')
    setAddingTopic(null)
  }

  function handleAddSelf(topic: string) {
    if (!identity?.email) return
    addTrainingRecord({
      employeeEmail: identity.email,
      employeeName: identity.name,
      topic,
      verifiedBy: identity.name,
    })
  }

  if (topics.length === 0) {
    return (
      <div className="bg-mytra-card border border-mytra-border rounded-card p-4">
        <p className="text-xs text-fg-3 italic">{t('training.noRequirements', undefined, 'No training requirements defined for this equipment.')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-fg flex items-center gap-1.5">
        <GraduationCap className="w-4 h-4 text-fg-3" />
        {t('training.requiredTraining', undefined, 'Required Training')}
      </h3>

      <div className="space-y-2">
        {topics.map((topic) => {
          const records = getTrainingForTopic(topic)
          const currentUserTrained = identity?.email
            ? isTrainingCurrent(identity.email, topic)
            : false
          const isExpanded = expandedTopic === topic

          return (
            <div
              key={topic}
              className="bg-mytra-card border border-mytra-border rounded-card overflow-hidden"
            >
              <button
                onClick={() => setExpandedTopic(isExpanded ? null : topic)}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-mytra-card-hover transition-colors text-left"
              >
                {currentUserTrained ? (
                  <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-warn shrink-0" />
                )}
                <span className="text-sm text-fg flex-1 min-w-0">{friendlyTrainingLabel(topic, t)}</span>
                <span className="text-xs text-fg-4 shrink-0">
                  {t('training.recordCount', { count: records.length })}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-mytra-border px-3 py-3 space-y-2">
                  {records.length > 0 ? (
                    <div className="space-y-1">
                      {records.slice(0, 10).map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between bg-mytra-bg border border-mytra-border rounded px-2.5 py-1.5"
                        >
                          <div className="min-w-0">
                            <p className="text-xs text-fg truncate">{r.employeeName}</p>
                            <p className="text-xs text-fg-4 truncate">{r.employeeEmail}</p>
                          </div>
                          <p className="text-xs text-fg-3 shrink-0">{formatDate(r.completedAt)}</p>
                        </div>
                      ))}
                      {records.length > 10 && (
                        <p className="text-xs text-fg-4 italic pt-1">
                          {t('training.showingRecords', { count: records.length })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-fg-4 italic">{t('training.noRecordsYet', undefined, 'No training records yet.')}</p>
                  )}

                  {addingTopic === topic ? (
                    <div className="space-y-2 pt-2 border-t border-mytra-border">
                      <div>
                        <label htmlFor="train-emp-name" className="sr-only">{t('training.employeeName', undefined, 'Employee name')}</label>
                        <input
                          id="train-emp-name"
                          type="text"
                          placeholder={t('training.employeeNamePlaceholder', undefined, 'Employee name')}
                          value={empName}
                          onChange={(e) => setEmpName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                          className="w-full bg-mytra-bg border border-mytra-border rounded-lg px-3 py-2 text-sm text-fg
                                     placeholder:text-fg-4 focus-visible:ring-2 focus-visible:ring-mytra-purple outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="train-emp-email" className="sr-only">{t('training.employeeEmail', undefined, 'Employee email')}</label>
                        <input
                          id="train-emp-email"
                          type="email"
                          placeholder={t('training.employeeEmailPlaceholder', undefined, 'Employee email')}
                          value={empEmail}
                          onChange={(e) => setEmpEmail(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                          className="w-full bg-mytra-bg border border-mytra-border rounded-lg px-3 py-2 text-sm text-fg
                                     placeholder:text-fg-4 focus-visible:ring-2 focus-visible:ring-mytra-purple outline-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleAdd}
                          disabled={!empName.trim() || !validEmail}
                          className={`${btnPrimaryCls} flex-1 text-xs font-medium py-2`}
                        >
                          {t('training.recordTraining', undefined, 'Record Training')}
                        </button>
                        <button
                          onClick={() => { setAddingTopic(null); setEmpName(''); setEmpEmail('') }}
                          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-fg-3 hover:text-fg transition-colors"
                          aria-label={t('common.cancel', undefined, 'Cancel')}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-1">
                      {identity?.email && !currentUserTrained && (
                        <button
                          onClick={() => handleAddSelf(topic)}
                          className="text-xs font-medium text-ok hover:text-ok/80 transition-colors"
                        >
                          {t('training.markMyselfTrained', undefined, 'Mark myself trained')}
                        </button>
                      )}
                      <button
                        onClick={() => setAddingTopic(topic)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-mytra-purple
                                   hover:text-mytra-purple-hover transition-colors"
                      >
                        <Plus className="w-3 h-3" /> {t('training.addEmployee', undefined, 'Add employee')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
