'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getOpenCount, onWorkOrderChange } from '@/lib/work-orders'
import { getOpenSafetyCount, onSafetyChange } from '@/lib/safety-records'
import { NAV_ITEMS, isNavItemActive, type BadgeKey } from '@/lib/nav'

export default function BottomTabBar() {
  const pathname = usePathname()
  const [openCount, setOpenCount] = useState(0)
  const [safetyCount, setSafetyCount] = useState(0)

  useEffect(() => {
    setOpenCount(getOpenCount())
    setSafetyCount(getOpenSafetyCount())

    const unsubWo = onWorkOrderChange(() => setOpenCount(getOpenCount()))
    const unsubSafety = onSafetyChange(() => setSafetyCount(getOpenSafetyCount()))

    function handleStorage() {
      setOpenCount(getOpenCount())
      setSafetyCount(getOpenSafetyCount())
    }
    window.addEventListener('storage', handleStorage)

    return () => {
      unsubWo()
      unsubSafety()
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const badgeCounts: Record<BadgeKey, number> = {
    safety: safetyCount,
    orders: openCount,
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-mytra-bg/95 backdrop-blur-sm border-t border-mytra-border no-print"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Main navigation"
    >
      <div className="flex items-stretch">
        {NAV_ITEMS.map(({ href, label, icon: Icon, badge }) => {
          const isActive = isNavItemActive(href, pathname)
          const badgeCount = badge ? badgeCounts[badge] : 0

          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[49px]
                         transition-colors duration-200 ${
                isActive ? 'text-mytra-purple' : 'text-fg-3'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="relative">
                <Icon className="w-6 h-6" />
                {badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-[18px] h-[18px]
                                   px-1 text-[11px] font-bold rounded-full bg-mytra-purple text-white">
                    {badgeCount}
                  </span>
                )}
              </span>
              <span className="text-xs font-medium leading-tight">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
