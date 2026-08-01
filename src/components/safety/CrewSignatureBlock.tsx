'use client'

import { useState } from 'react'
import { Plus, X, Star } from 'lucide-react'
import SignaturePad from '@/components/SignaturePad'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { CrewSignature } from '@/lib/safety-types'
import { newSignature } from '@/lib/safety-records'
import { getCrewRoster, crewRoles, rememberCrewMember } from '@/data/crew'
import { haptic } from '@/lib/haptic'
import { btnPrimaryCls } from '@/lib/form-styles'
import { useT } from '@/lib/i18n'
import { formatTime } from '@/lib/datetime'

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


export default function CrewSignatureBlock({
  value,
  onChange,
  roleOptions = crewRoles,
  supervisorId,
  onSupervisorChange,
  supervisorLabel,
}: CrewSignatureBlockProps) {
  const t = useT()
  const supervisorText = supervisorLabel ?? t('signature.supervisor', undefined, 'Supervisor')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<CrewSignature | null>(null)
  const [roster] = useState(() => getCrewRoster())

  function reset() {
    setName('')
    setRole('')
    setDataUrl(null)
    setAdding(false)
  }

  function save() {
    if (!name.trim() || !dataUrl) return
    haptic('tap')
    const sig = newSignature({ name: name.trim(), role: role || null, hasSignature: true })
    onChange({
      signatures: [...value.signatures, sig],
      blobs: { ...value.blobs, [sig.id]: dataUrl },
    })
    rememberCrewMember(name.trim(), role || null)
    reset()
  }

  function handleNameChange(v: string) {
    setName(v)
    const match = roster.find((c) => c.name.toLowerCase() === v.toLowerCase())
    if (match?.role && !role) setRole(match.role)
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
            <div key={s.id} className="flex items-center gap-3 bg-mytra-card shadow-card border border-mytra-border rounded-card p-2.5">
              {value.blobs[s.id] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={value.blobs[s.id]}
                  alt={t('signature.sigAlt', { name: s.name })}
                  className="w-16 h-10 object-contain bg-mytra-input rounded border border-mytra-border shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-fg truncate">{s.name}</p>
                <p className="text-xs text-fg-3">
                  {s.role ? `${s.role} · ` : ''}{t('signature.signedAt', { time: formatTime(s.signedAt) })}
                </p>
              </div>
              {onSupervisorChange && (
                <button
                  type="button"
                  onClick={() => onSupervisorChange(supervisorId === s.id ? null : s.id)}
                  title={t('signature.markAs', { role: supervisorText.toLowerCase() })}
                  aria-pressed={supervisorId === s.id}
                  className={`shrink-0 inline-flex items-center gap-1 text-xs px-3 py-2 rounded border transition-colors min-h-[44px] min-w-[44px] ${
                    supervisorId === s.id
                      ? 'bg-mytra-purple/20 text-mytra-purple border-mytra-purple/40'
                      : 'bg-mytra-bg text-fg-3 border-mytra-border hover:text-fg'
                  }`}
                >
                  <Star className="w-3 h-3" />
                  {supervisorText}
                </button>
              )}
              <button
                type="button"
                onClick={() => setPendingRemove(s)}
                aria-label={t('signature.removeAria', undefined, 'Remove signature')}
                className="shrink-0 w-11 h-11 flex items-center justify-center rounded-lg bg-mytra-bg border border-mytra-border text-fg-3 hover:text-danger transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="bg-mytra-card shadow-card border border-mytra-border rounded-card p-3 space-y-3 animate-fadeIn">
          {/* LG-6: the defaultEn literal below is legally load-bearing — the
              sw-i18n-invariants vitest greps this exact English text. */}
          <p className="text-xs text-fg-3 leading-relaxed">
            {t('signature.consent', undefined, 'By signing below, you acknowledge this safety plan and consent to your digital signature being stored on this device for recordkeeping purposes.')}
          </p>
          <div>
            <label className="block text-xs text-fg-2 mb-1">{t('signature.name', undefined, 'Name')}</label>
            <input
              type="text"
              list="crew-roster"
              autoComplete="off"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              autoCapitalize="words"
              enterKeyHint="next"
              placeholder={t('signature.namePlaceholder', undefined, 'Crew member name')}
              className="w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 px-3
                         text-sm text-fg placeholder:text-fg-4
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple"
            />
            <datalist id="crew-roster">
              {roster.map((c) => (
                <option key={c.name} value={c.name} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-xs text-fg-2 mb-1">{t('signature.roleOptional', undefined, 'Role (optional)')}</label>
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
            <label className="block text-xs text-fg-2 mb-1">{t('signature.signatureLabel', undefined, 'Signature')}</label>
            <SignaturePad onChange={(url) => setDataUrl(url)} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!name.trim() || !dataUrl}
              className={`${btnPrimaryCls} flex-1 py-2.5 min-h-[44px] text-sm font-semibold`}
            >
              {t('signature.saveSignature', undefined, 'Save signature')}
            </button>
            <button
              type="button"
              onClick={reset}
              className="px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium bg-mytra-bg border border-mytra-border
                         text-fg-2 hover:text-fg transition-colors"
            >
              {t('common.cancel', undefined, 'Cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] rounded-lg text-sm font-medium
                     bg-mytra-bg border border-dashed border-mytra-border text-fg-2
                     hover:text-fg hover:border-mytra-purple/50 transition-colors"
        >
          <Plus className="w-4 h-4" /> {t('signature.addSignature', undefined, 'Add signature')}
        </button>
      )}

      <ConfirmDialog
        open={pendingRemove !== null}
        title={t('signature.removeTitle', undefined, 'Remove signature?')}
        message={
          pendingRemove
            ? t('signature.removeBody', { name: pendingRemove.name })
            : ''
        }
        confirmLabel={t('signature.remove', undefined, 'Remove')}
        variant="danger"
        onConfirm={() => {
          if (pendingRemove) remove(pendingRemove.id)
          setPendingRemove(null)
        }}
        onCancel={() => setPendingRemove(null)}
      />
    </div>
  )
}
