'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { WifiOff } from 'lucide-react'
import { NAV_ITEMS, isNavItemActive, type BadgeKey } from '@/lib/nav'
import { useLiveCounts } from '@/hooks/useLiveCounts'
import UserMenu from '@/components/UserMenu'
import HelpButton from '@/components/onboarding/HelpButton'

export default function NavHeader() {
  const pathname = usePathname()
  if (pathname.startsWith('/beta')) return null
  const { openOrders, openSafety } = useLiveCounts()
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(navigator.onLine)
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const badgeCounts: Record<BadgeKey, number> = {
    safety: openSafety,
    orders: openOrders,
  }

  return (
    <header className="no-print sticky top-0 z-50 bg-mytra-bg/95 backdrop-blur-sm border-b border-mytra-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Left: Logo / Title */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold text-fg">Sage</span>
          <span className="text-xs bg-mytra-purple/20 text-mytra-purple rounded px-1.5 py-0.5 font-medium">
            EHS
          </span>
        </Link>

        {/* Right: Nav Links */}
        <nav className="flex items-center gap-3 sm:gap-5">
          {!online && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-warn/15 text-warn">
              <WifiOff className="w-3 h-3" />
              <span className="hidden sm:inline">Offline</span>
            </span>
          )}
          {NAV_ITEMS.map(({ href, longLabel, icon: Icon, badge }) => {
            /* Nav links are hidden on mobile — BottomTabBar handles them */
            const isActive = isNavItemActive(href, pathname)
            const badgeCount = badge ? badgeCounts[badge] : 0

            return (
              <Link
                key={href}
                href={href}
                data-tour-tab={href}
                className={`relative hidden md:inline-flex items-center gap-1.5 text-sm transition-colors duration-200 rounded px-2 min-h-[44px]
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-mytra-purple
                  ${
                    isActive
                      ? 'text-fg'
                      : 'text-fg-2 hover:text-fg'
                  }`}
              >
                <Icon size={16} />
                <span className="hidden md:inline">{longLabel}</span>
                {badgeCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px]
                                   px-1 text-xs font-bold rounded-full
                                   bg-mytra-purple text-white">
                    {badgeCount}
                  </span>
                )}
                {isActive && (
                  <span className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-mytra-purple" />
                )}
              </Link>
            )
          })}
          <HelpButton />
          <UserMenu />
        </nav>
      </div>
    </header>
  )
}
