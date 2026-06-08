'use client'

import { useState } from 'react'
import { Plus, X, Star } from 'lucide-react'
import SignaturePad from '@/components/SignaturePad'
import type { CrewSignature } from '@/lib/safety-types'
import { newSignature } from '@/lib/safety-records'
import { crewRoster, crewRoles } from '@/data/crew'

export interface SignatureData {
  signatures: CrewSignature[]
  blobs: Record<string, string>
}

interface CrewSignatureBlockProps {
  value: SignatureData
  onChange: (v: SignatureData) => void
  roleOptions?: string[]
  /** When provided, each row shows a "supervisor/issuer" selector. */
  supervisorId?: string | null
  onSupervisorChange?: (id: string | null) => void
  supervisorLabel?: string
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function CrewSignatureBlock({
  value,
  onChange,
  roleOptions = crewRoles,
  supervisorId,
  onSupervisorChange,
  supervisorLabel = 'Supervisor',
}: CrewSignatureBlockProps) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  function reset() {
    setName('')
    setRole('')
    setDataUrl(null)
    setAdding(false)
  }

  function save() {
    if (!name.trim() || !dataUrl) return
    const sig = newSignature({ name: name.trim(), role: role || null, hasSignature: true })
    onChange({
      signatures: [...value.signatures, sig],
      blobs: { ...value.blobs, [sig.id]: dataUrl },
    })
    reset()
  }

  function remove(id: string) {
    const restBlobs = { ...value.blobs }
    delete restBlobs[id]
    onChange({ signatures: value.signatures.filter((s) => s.id !== id), blobs: restBlobs })
    if (supervisorId === id) onSupervisorChange?.(null)
  }

  return (
    <div className="space-y-2">
      {value.signatures.length > 0 && (
        <div className="space-y-2">
          {value.signatures.map((s) => (
            <div key={s.id} className="flex items-center gap-3 bg-mytra-card shadow-card border border-mytra-border rounded-lg p-2.5">
              {value.blobs[s.id] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={value.blobs[s.id]}
                  alt={`${s.name} signature`}
                  className="w-16 h-10 object-contain bg-mytra-input rounded border border-mytra-border shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-fg truncate">{s.name}</p>
                <p className="text-xs text-fg-3">
                  {s.role ? `${s.role} · ` : ''}signed {formatTime(s.signedAt)}
                </p>
              </div>
              {onSupervisorChange && (
                <button
                  type="button"
                  onClick={() => onSupervisorChange(supervisorId === s.id ? null : s.id)}
                  title={`Mark as ${supervisorLabel.toLowerCase()}`}
                  className={`shrink-0 inline-flex items-center gap-1 text-xs px-3 py-2 rounded border transition-colors min-h-[44px] ${
                    supervisorId === s.id
                      ? 'bg-mytra-purple/20 text-mytra-purple border-mytra-purple/40'
                      : 'bg-mytra-bg text-fg-3 border-mytra-border hover:text-fg'
                  }`}
                >
                  <Star className="w-3 h-3" />
                  {supervisorLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(s.id)}
                aria-label="Remove signature"
                className="shrink-0 w-11 h-11 flex items-center justify-center rounded-lg bg-mytra-bg border border-mytra-border text-fg-3 hover:text-danger transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="bg-mytra-card shadow-card border border-mytra-border rounded-lg p-3 space-y-3 animate-fadeIn">
          <div>
            <label className="block text-xs text-fg-2 mb-1">Name</label>
            <input
              type="text"
              list="crew-roster"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Crew member name"
              className="w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3
                         text-sm text-fg placeholder:text-fg-4
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple"
            />
            <datalist id="crew-roster">
              {crewRoster.map((c) => (
                <option key={c.name} value={c.name} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-xs text-fg-2 mb-1">Role (optional)</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3
                         text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple"
            >
              <option value="">—</option>
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-fg-2 mb-1">Signature</label>
            <SignaturePad onChange={(url) => setDataUrl(url)} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!name.trim() || !dataUrl}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-mytra-purple text-white
                         hover:bg-mytra-purple-hover transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save signature
            </button>
            <button
              type="button"
              onClick={reset}
              className="px-4 py-2.5 rounded-lg text-sm font-medium bg-mytra-bg border border-mytra-border
                         text-fg-2 hover:text-fg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium
                     bg-mytra-bg border border-dashed border-mytra-border text-fg-2
                     hover:text-fg hover:border-mytra-purple/50 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add signature
        </button>
      )}
    </div>
  )
}
