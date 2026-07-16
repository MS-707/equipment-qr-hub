'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { NAV_ITEMS, isNavItemActive, type BadgeKey } from '@/lib/nav'
import { haptic } from '@/lib/haptic'
import { useLiveCounts } from '@/hooks/useLiveCounts'
import { usePendingSyncCount } from '@/hooks/usePendingSyncCount'
import { btnPrimaryCls } from '@/lib/form-styles'
import { useT } from '@/lib/i18n'

export default function BottomTabBar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { openOrders, openSafety } = useLiveCounts()
  const pendingSyncCount = usePendingSyncCount()
  const t = useT()
  if (pathname.startsWith('/beta')) return null

  const badgeCounts: Record<BadgeKey, number> = {
    safety: openSafety,
    orders: openOrders,
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-mytra-card border-t border-mytra-border no-print"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label={t('nav.tabBarAria', undefined, 'Tab bar')}
    >
      <div className="flex items-stretch">
        {NAV_ITEMS.filter(item => !item.adminOnly || session?.user?.isAdmin).map(({ href, label, labelKey, icon: Icon, badge, external }) => {
          const isActive = !external && isNavItemActive(href, pathname)
          const badgeCount = badge ? badgeCounts[badge] : 0

          const cls = `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[var(--tab-bar-h)]
                         transition-colors duration-200 press-scale ${
                isActive ? 'text-mytra-purple' : 'text-fg-3 active:text-fg-2'
              }`
          const inner = (
            <>
              <span className="relative">
                <Icon className="w-7 h-7" />
                {badgeCount > 0 && (
                  <span className={`${btnPrimaryCls} absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold rounded-full tabular-nums`}>
                    {badgeCount}
                  </span>
                )}
                {href === '/' && pendingSyncCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-danger rounded-full">
                    <span className="sr-only">
                      {t('nav.waitingToSync', { count: pendingSyncCount })}
                    </span>
                  </span>
                )}
              </span>
              <span className="text-[13px] font-medium leading-tight">{t(labelKey, undefined, label)}</span>
              {isActive && <span className="w-8 h-[3px] rounded-full bg-mytra-purple" />}
            </>
          )

          if (external) {
            return (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => haptic('tap')}
                data-tour-tab={href}
                className={cls}
              >
                {inner}
              </a>
            )
          }

          return (
            <Link
              key={href}
              href={href}
              onClick={() => haptic('tap')}
              data-tour-tab={href}
              className={cls}
              aria-current={isActive ? 'page' : undefined}
            >
              {inner}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
