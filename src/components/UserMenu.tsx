'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { LogOut, ChevronDown } from 'lucide-react'
import { clearCurrentIdentity } from '@/lib/identity'

export default function UserMenu() {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  if (status !== 'authenticated' || !session?.user) return null

  const name = session.user.name || session.user.email || 'User'
  const firstName = name.split(' ')[0]
  const initials = name
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition rounded
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="" className="w-6 h-6 rounded-full" />
        ) : (
          <span className="w-6 h-6 rounded-full bg-mytra-purple/20 text-mytra-purple text-[10px] font-bold flex items-center justify-center">
            {initials}
          </span>
        )}
        <span className="hidden sm:inline">{firstName}</span>
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 bg-mytra-card border border-mytra-border rounded-lg
                     shadow-lg p-2 animate-slideDown z-50"
        >
          <div className="px-2 py-1.5">
            <p className="text-sm text-white truncate">{name}</p>
            {session.user.email && (
              <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
            )}
          </div>
          <div className="h-px bg-mytra-border my-1" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              clearCurrentIdentity()
              signOut({ callbackUrl: '/safety' })
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-300 hover:text-white
                       hover:bg-mytra-card-hover rounded transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
