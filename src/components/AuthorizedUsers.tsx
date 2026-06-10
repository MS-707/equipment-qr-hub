'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { ShieldAlert, ShieldCheck, UserPlus, X, Lock, Unlock } from 'lucide-react'
import {
  getAuthorization,
  setRestricted,
  addAuthorizedUser,
  removeAuthorizedUser,
  isUserAuthorized,
  onShopMgmtChange,
  EMAIL_RE,
} from '@/lib/shop-management'
import { getCurrentIdentity } from '@/lib/identity'
import ConfirmDialog from '@/components/ConfirmDialog'

interface AuthorizedUsersProps {
  itemNumber: number
}

export default function AuthorizedUsers({ itemNumber }: AuthorizedUsersProps) {
  const [auth, setAuth] = useState(() => getAuthorization(itemNumber))
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    return onShopMgmtChange(() => setAuth(getAuthorization(itemNumber)))
  }, [itemNumber])

  const { data: session } = useSession()
  const identity = getCurrentIdentity()
  const currentUserAuthorized = isUserAuthorized(itemNumber, identity?.email ?? null)
  const canManage = session?.user?.isAdmin === true

  function handleToggleRestricted() {
    if (!canManage) return
    setRestricted(itemNumber, !auth.restricted)
  }

  const validEmail = EMAIL_RE.test(email.trim())

  function handleAdd() {
    if (!name.trim() || !validEmail) return
    addAuthorizedUser(itemNumber, { name: name.trim(), email: email.trim() }, identity?.name ?? 'Unknown')
    setName('')
    setEmail('')
    setAdding(false)
  }

  const [removeTarget, setRemoveTarget] = useState<{ email: string; name: string } | null>(null)
  function handleRemove(userEmail: string, userName: string) {
    setRemoveTarget({ email: userEmail, name: userName })
  }
  function confirmRemove() {
    if (removeTarget) removeAuthorizedUser(itemNumber, removeTarget.email)
    setRemoveTarget(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg flex items-center gap-1.5">
          {auth.restricted ? <ShieldAlert className="w-4 h-4 text-warn" /> : <ShieldCheck className="w-4 h-4 text-ok" />}
          Authorization
        </h3>
        {canManage && (
          <button
            onClick={handleToggleRestricted}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg
                       border border-mytra-border bg-mytra-card hover:bg-mytra-card-hover transition-colors text-fg-2"
          >
            {auth.restricted ? <><Unlock className="w-3 h-3" /> Unrestrict</> : <><Lock className="w-3 h-3" /> Restrict</>}
          </button>
        )}
      </div>

      {auth.restricted && (
        <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-3">
          {!currentUserAuthorized && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 flex items-start gap-2">
              <ShieldAlert className="w-5 h-5 text-danger mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-danger">Not Authorized</p>
                <p className="text-xs text-fg-2 mt-0.5">
                  {identity
                    ? `You (${identity.email}) are not on the authorized user list for this equipment.`
                    : 'You are not on the authorized user list. Sign in to verify your status.'}
                </p>
              </div>
            </div>
          )}

          {auth.authorizedUsers.length === 0 ? (
            <p className="text-xs text-fg-3 italic py-1">
              No authorized users yet — add users to allow access.
            </p>
          ) : (
            <div className="space-y-1.5">
              {auth.authorizedUsers.map((u) => (
                <div
                  key={u.email}
                  className="flex items-center justify-between bg-mytra-bg border border-mytra-border rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-fg truncate">{u.name}</p>
                    <p className="text-xs text-fg-3 truncate">{u.email}</p>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => handleRemove(u.email, u.name)}
                      className="text-fg-4 hover:text-danger transition-colors p-2.5 -mr-1.5 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label={`Remove ${u.name}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {canManage && (
            adding ? (
              <div className="space-y-2 border-t border-mytra-border pt-3">
                <div>
                  <label htmlFor="auth-user-name" className="sr-only">Name</label>
                  <input
                    id="auth-user-name"
                    type="text"
                    placeholder="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    className="w-full bg-mytra-bg border border-mytra-border rounded-lg px-3 py-2 text-sm text-fg
                               placeholder:text-fg-4 focus-visible:ring-2 focus-visible:ring-mytra-purple outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="auth-user-email" className="sr-only">Email</label>
                  <input
                    id="auth-user-email"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    className="w-full bg-mytra-bg border border-mytra-border rounded-lg px-3 py-2 text-sm text-fg
                               placeholder:text-fg-4 focus-visible:ring-2 focus-visible:ring-mytra-purple outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAdd}
                    disabled={!name.trim() || !validEmail}
                    className="flex-1 bg-mytra-purple text-white text-xs font-medium py-2 rounded-lg
                               hover:bg-mytra-purple-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setAdding(false); setName(''); setEmail('') }}
                    className="px-4 py-2 text-xs font-medium text-fg-2 bg-mytra-bg border border-mytra-border
                               rounded-lg hover:text-fg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-mytra-purple
                           hover:text-mytra-purple-hover transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" /> Add authorized user
              </button>
            )
          )}
        </div>
      )}

      {!auth.restricted && (
        <p className="text-xs text-fg-3">
          This equipment is unrestricted — any employee may operate it.{canManage ? ' Click "Restrict" to require authorization.' : ''}
        </p>
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        title="Remove User"
        message={`${removeTarget?.name ?? 'This user'} will no longer have access to this equipment.`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  )
}
