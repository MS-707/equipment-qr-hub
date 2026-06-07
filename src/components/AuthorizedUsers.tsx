'use client'

import { useState, useEffect } from 'react'
import { ShieldAlert, ShieldCheck, UserPlus, X, Lock, Unlock } from 'lucide-react'
import {
  getAuthorization,
  setRestricted,
  addAuthorizedUser,
  removeAuthorizedUser,
  isUserAuthorized,
  onShopMgmtChange,
} from '@/lib/shop-management'
import { getCurrentIdentity } from '@/lib/identity'

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

  const identity = getCurrentIdentity()
  const currentUserAuthorized = isUserAuthorized(itemNumber, identity?.email ?? null)

  function handleToggleRestricted() {
    setRestricted(itemNumber, !auth.restricted)
  }

  function handleAdd() {
    if (!name.trim() || !email.trim()) return
    addAuthorizedUser(itemNumber, { name: name.trim(), email: email.trim() }, identity?.name ?? 'Unknown')
    setName('')
    setEmail('')
    setAdding(false)
  }

  function handleRemove(userEmail: string) {
    removeAuthorizedUser(itemNumber, userEmail)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg flex items-center gap-1.5">
          {auth.restricted ? <ShieldAlert className="w-4 h-4 text-warn" /> : <ShieldCheck className="w-4 h-4 text-ok" />}
          Authorization
        </h3>
        <button
          onClick={handleToggleRestricted}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg
                     border border-mytra-border bg-mytra-card hover:bg-mytra-card-hover transition-colors text-fg-2"
        >
          {auth.restricted ? <><Unlock className="w-3 h-3" /> Unrestrict</> : <><Lock className="w-3 h-3" /> Restrict</>}
        </button>
      </div>

      {auth.restricted && (
        <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-3">
          {!currentUserAuthorized && identity && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-danger mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-danger">Not Authorized</p>
                <p className="text-xs text-fg-2 mt-0.5">
                  You ({identity.email}) are not on the authorized user list for this equipment.
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
                  <button
                    onClick={() => handleRemove(u.email)}
                    className="text-fg-4 hover:text-danger transition-colors p-1 shrink-0"
                    aria-label={`Remove ${u.name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {adding ? (
            <div className="space-y-2 border-t border-mytra-border pt-3">
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-mytra-bg border border-mytra-border rounded-lg px-3 py-2 text-sm text-fg
                           placeholder:text-fg-4 focus-visible:ring-2 focus-visible:ring-mytra-purple outline-none"
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-mytra-bg border border-mytra-border rounded-lg px-3 py-2 text-sm text-fg
                           placeholder:text-fg-4 focus-visible:ring-2 focus-visible:ring-mytra-purple outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={!name.trim() || !email.trim()}
                  className="flex-1 bg-mytra-purple text-white text-xs font-medium py-2 rounded-lg
                             hover:bg-mytra-purple-hover transition-colors disabled:opacity-40"
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
          )}
        </div>
      )}

      {!auth.restricted && (
        <p className="text-xs text-fg-3">
          This equipment is unrestricted — any employee may operate it. Click &quot;Restrict&quot; to require authorization.
        </p>
      )}
    </div>
  )
}
