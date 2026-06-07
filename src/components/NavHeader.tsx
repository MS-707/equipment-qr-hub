'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, ClipboardCheck, ClipboardList, QrCode, ShieldCheck, WifiOff } from 'lucide-react'
import { getOpenCount, onWorkOrderChange } from '@/lib/work-orders'
import { getOpenSafetyCount, onSafetyChange } from '@/lib/safety-records'
import UserMenu from '@/components/UserMenu'

export default function NavHeader() {
  const pathname = usePathname()
  const [openCount, setOpenCount] = useState(0)
  const [safetyCount, setSafetyCount] = useState(0)
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOpenCount(getOpenCount())
    setSafetyCount(getOpenSafetyCount())

    // Listen for same-tab CRUD via pub/sub
    const unsubscribe = onWorkOrderChange(() => setOpenCount(getOpenCount()))
    const unsubscribeSafety = onSafetyChange(() => setSafetyCount(getOpenSafetyCount()))
    // Listen for cross-tab storage changes
    function handleStorage() {
      setOpenCount(getOpenCount())
      setSafetyCount(getOpenSafetyCount())
    }
    window.addEventListener('storage', handleStorage)

    // Offline/online status
    setOnline(navigator.onLine)
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      unsubscribe()
      unsubscribeSafety()
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const navLinks = [
    { href: '/', label: 'Directory', icon: LayoutGrid, badge: 0 },
    { href: '/inspections', label: 'Pre-Trip', icon: ClipboardCheck, badge: 0 },
    { href: '/safety', label: 'Safety', icon: ShieldCheck, badge: safetyCount },
    { href: '/work-orders', label: 'Work Orders', icon: ClipboardList, badge: openCount },
    { href: '/admin/labels', label: 'QR Labels', icon: QrCode, badge: 0 },
  ]

  return (
    <header className="no-print sticky top-0 z-50 bg-mytra-bg/95 backdrop-blur-sm border-b border-mytra-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Left: Logo / Title */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold text-fg">Equipment QR Hub</span>
          <span className="text-xs bg-mytra-purple/20 text-mytra-purple rounded px-1.5 py-0.5 font-medium">
            EHS
          </span>
        </Link>

        {/* Right: Nav Links */}
        <nav className="flex items-center gap-3 sm:gap-5">
          {!online && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-warn/15 text-warn">
              <WifiOff className="w-3 h-3" />
              <span className="hidden sm:inline">Offline</span>
            </span>
          )}
          {navLinks.map(({ href, label, icon: Icon, badge }) => {
            const isActive =
              href === '/'
                ? pathname === '/'
                : pathname.startsWith(href)

            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 text-sm transition rounded
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple
                  ${
                    isActive
                      ? 'text-fg'
                      : 'text-fg-2 hover:text-fg'
                  }`}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{label}</span>
                {badge > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px]
                                   px-1 text-[10px] font-bold rounded-full
                                   bg-mytra-purple text-white">
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
          <UserMenu />
        </nav>
      </div>
    </header>
  )
}
