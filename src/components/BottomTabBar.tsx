'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, ClipboardCheck, ShieldCheck, ClipboardList, QrCode } from 'lucide-react'
import { getOpenCount, onWorkOrderChange } from '@/lib/work-orders'
import { getOpenSafetyCount, onSafetyChange } from '@/lib/safety-records'

const TABS = [
  { href: '/', label: 'Directory', icon: LayoutGrid },
  { href: '/inspections', label: 'Pre-Trip', icon: ClipboardCheck },
  { href: '/safety', label: 'Safety', icon: ShieldCheck },
  { href: '/work-orders', label: 'Orders', icon: ClipboardList },
  { href: '/admin/labels', label: 'QR', icon: QrCode },
]

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

  const badges: Record<string, number> = {
    '/work-orders': openCount,
    '/safety': safetyCount,
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-mytra-bg/95 backdrop-blur-sm border-t border-mytra-border no-print"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Main navigation"
    >
      <div className="flex items-stretch">
        {TABS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href)
          const badge = badges[href] || 0

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
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-[16px] h-[16px]
                                   px-1 text-[10px] font-bold rounded-full bg-mytra-purple text-white">
                    {badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium leading-tight">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
