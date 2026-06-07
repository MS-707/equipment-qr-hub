'use client'

import { useState, useEffect } from 'react'
import { GraduationCap, Plus, CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { EquipmentItem } from '@/lib/types'
import {
  getTrainingForTopic,
  addTrainingRecord,
  isTrainingCurrent,
  onShopMgmtChange,
} from '@/lib/shop-management'
import { getCurrentIdentity } from '@/lib/identity'
import { formatDate } from '@/lib/datetime'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface TrainingTrackerProps {
  equipment: EquipmentItem
}

function parseTrainingTopics(raw: string): string[] {
  return raw
    .split(';')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

export default function TrainingTracker({ equipment }: TrainingTrackerProps) {
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
      <div className="bg-mytra-card border border-mytra-border rounded-lg p-4">
        <p className="text-xs text-fg-3 italic">No training requirements defined for this equipment.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-fg flex items-center gap-1.5">
        <GraduationCap className="w-4 h-4 text-fg-3" />
        Required Training
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
              className="bg-mytra-card border border-mytra-border rounded-lg overflow-hidden"
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
                <span className="text-sm text-fg flex-1 min-w-0">{topic}</span>
                <span className="text-[10px] text-fg-4 shrink-0">
                  {records.length} {records.length === 1 ? 'record' : 'records'}
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
                            <p className="text-[10px] text-fg-4 truncate">{r.employeeEmail}</p>
                          </div>
                          <p className="text-[10px] text-fg-3 shrink-0">{formatDate(r.completedAt)}</p>
                        </div>
                      ))}
                      {records.length > 10 && (
                        <p className="text-[10px] text-fg-4 italic pt-1">
                          Showing 10 of {records.length} records
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-fg-4 italic">No training records yet.</p>
                  )}

                  {addingTopic === topic ? (
                    <div className="space-y-2 pt-2 border-t border-mytra-border">
                      <div>
                        <label htmlFor="train-emp-name" className="sr-only">Employee name</label>
                        <input
                          id="train-emp-name"
                          type="text"
                          placeholder="Employee name"
                          value={empName}
                          onChange={(e) => setEmpName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                          className="w-full bg-mytra-bg border border-mytra-border rounded-lg px-3 py-2 text-sm text-fg
                                     placeholder:text-fg-4 focus-visible:ring-2 focus-visible:ring-mytra-purple outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="train-emp-email" className="sr-only">Employee email</label>
                        <input
                          id="train-emp-email"
                          type="email"
                          placeholder="Employee email"
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
                          className="flex-1 bg-mytra-purple text-white text-xs font-medium py-2 rounded-lg
                                     hover:bg-mytra-purple-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Record Training
                        </button>
                        <button
                          onClick={() => { setAddingTopic(null); setEmpName(''); setEmpEmail('') }}
                          className="p-2 text-fg-3 hover:text-fg transition-colors"
                          aria-label="Cancel"
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
                          className="text-[10px] font-medium text-ok hover:text-ok/80 transition-colors"
                        >
                          Mark myself trained
                        </button>
                      )}
                      <button
                        onClick={() => setAddingTopic(topic)}
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-mytra-purple
                                   hover:text-mytra-purple-hover transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Add employee
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
