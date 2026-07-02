'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { LogOut, ChevronDown, Sun, Moon, Monitor, Trash2 } from 'lucide-react'
import { clearCurrentIdentity } from '@/lib/identity'
import { useTheme, type ThemePreference } from '@/lib/theme'
import { clearAllLocalData } from '@/lib/safety-records'
import ConfirmDialog from '@/components/ConfirmDialog'

export default function UserMenu() {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { theme, setTheme } = useTheme()

  // Roving-focus keyboard navigation for the menu: ArrowUp/Down wrap,
  // Home/End jump, Escape closes and returns focus to the trigger.
  function onMenuKeyDown(e: React.KeyboardEvent) {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    )
    if (items.length === 0) return
    const idx = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[(idx + 1) % items.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[(idx - 1 + items.length) % items.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      items[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      items[items.length - 1]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }
  }

  const cycleTheme = () => {
    const order: ThemePreference[] = ['dark', 'light', 'auto']
    const next = order[(order.indexOf(theme) + 1) % order.length]
    setTheme(next)
  }

  const themeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  const themeLabel = theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'Auto'
  const ThemeIcon = themeIcon

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onTouch(e: TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onTouch)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onTouch)
    }
  }, [])

  if (status !== 'authenticated' || !session?.user) return null

  const name = session.user.name || session.user.email || 'User'
  const initials = name
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg transition rounded min-h-[44px]
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="" className="w-8 h-8 rounded-full" />
        ) : (
          <span className="w-8 h-8 rounded-full bg-mytra-purple/20 text-mytra-purple text-xs font-bold flex items-center justify-center">
            {initials}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete all local data?"
        message="This permanently removes all safety records, signatures, photos, and drafts from this device. Synced records in Notion are not affected. This cannot be undone."
        confirmLabel="Delete everything"
        variant="danger"
        onConfirm={async () => {
          await clearAllLocalData()
          clearCurrentIdentity()
          setShowDeleteConfirm(false)
          signOut({ callbackUrl: '/safety' })
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {open && (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 mt-2 w-56 bg-mytra-card shadow-card border border-mytra-border rounded-lg
                     shadow-pop p-2 animate-slideDown z-50"
        >
          <div className="px-2 py-1.5">
            <p className="text-sm text-fg truncate">{name}</p>
            {session.user.email && (
              <p className="text-xs text-fg-3 truncate">{session.user.email}</p>
            )}
          </div>
          <div className="h-px bg-mytra-border my-1" />
          <button
            type="button"
            role="menuitem"
            onClick={cycleTheme}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-fg-2 hover:text-fg
                       hover:bg-mytra-card-hover rounded transition-colors min-h-[44px]"
          >
            <ThemeIcon className="w-4 h-4" /> Theme: {themeLabel}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              clearCurrentIdentity()
              signOut({ callbackUrl: '/safety' })
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-fg-2 hover:text-fg
                       hover:bg-mytra-card-hover rounded transition-colors min-h-[44px]"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
          <div className="h-px bg-mytra-border my-1" />
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); setShowDeleteConfirm(true) }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-danger/80 hover:text-danger
                       hover:bg-danger/5 rounded transition-colors min-h-[44px]"
          >
            <Trash2 className="w-4 h-4" /> Delete my data
          </button>
        </div>
      )}
    </div>
  )
}
