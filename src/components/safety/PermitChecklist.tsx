'use client'

import { useState } from 'react'
import { Check, AlertTriangle, MessageSquarePlus } from 'lucide-react'
import type { PermitCheckItem } from '@/lib/safety-types'

interface PermitChecklistProps {
  items: PermitCheckItem[]
  onChange: (items: PermitCheckItem[]) => void
}

/** Count of critical items still unchecked — used by forms to gate "Issue permit". */
export function criticalRemaining(items: PermitCheckItem[]): number {
  return items.filter((i) => i.critical && !i.checked).length
}

export default function PermitChecklist({ items, onChange }: PermitChecklistProps) {
  const [openNotes, setOpenNotes] = useState<Set<string>>(
    () => new Set(items.filter((i) => i.notes).map((i) => i.id))
  )

  function set(id: string, patch: Partial<PermitCheckItem>) {
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  function toggleNotes(id: string) {
    setOpenNotes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Preserve definition order while grouping by category.
  const categories: string[] = []
  for (const i of items) if (!categories.includes(i.category)) categories.push(i.category)

  return (
    <div className="space-y-4">
      {categories.map((category) => (
        <div key={category}>
          <h4 className="text-xs uppercase tracking-wider text-fg-3 font-semibold mb-2 px-1">{category}</h4>
          <div className="space-y-2">
            {items
              .filter((i) => i.category === category)
              .map((item) => {
                const notesOpen = openNotes.has(item.id)
                return (
                  <div key={item.id} className="bg-mytra-card shadow-card border border-mytra-border rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => set(item.id, { checked: !item.checked })}
                        aria-pressed={item.checked}
                        aria-label={item.checked ? 'Checked' : 'Not checked'}
                        className={`shrink-0 mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          item.checked
                            ? 'bg-mytra-purple border-mytra-purple text-white'
                            : 'bg-mytra-bg border-mytra-border text-transparent hover:border-mytra-purple/50'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => set(item.id, { checked: !item.checked })}
                        className="flex-1 text-left min-w-0"
                      >
                        <span className="text-sm text-fg leading-snug">{item.label}</span>
                        {item.critical && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-medium text-warn bg-warn/10 px-1.5 py-0.5 rounded align-middle">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Required
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleNotes(item.id)}
                        aria-label="Add note"
                        className={`shrink-0 w-11 h-11 flex items-center justify-center rounded-lg border transition-colors ${
                          notesOpen || item.notes
                            ? 'bg-mytra-purple/10 border-mytra-purple/40 text-mytra-purple'
                            : 'bg-mytra-bg border-mytra-border text-fg-3 hover:text-fg'
                        }`}
                      >
                        <MessageSquarePlus className="w-4 h-4" />
                      </button>
                    </div>

                    {notesOpen && (
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => set(item.id, { notes: e.target.value })}
                        placeholder="Note (optional)"
                        className="mt-2 w-full bg-mytra-input border border-mytra-border rounded-lg py-2 px-3
                                   text-sm text-fg placeholder:text-fg-4
                                   focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple animate-fadeIn"
                      />
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}
