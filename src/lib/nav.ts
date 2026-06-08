import {
  ShieldCheck,
  ClipboardCheck,
  LayoutGrid,
  ClipboardList,
  QrCode,
  type LucideIcon,
} from 'lucide-react'

export type BadgeKey = 'safety' | 'orders'

export interface NavItem {
  href: string
  /** Short label for the mobile bottom tab bar. */
  label: string
  /** Longer label for the desktop header nav. */
  longLabel: string
  icon: LucideIcon
  badge?: BadgeKey
}

/**
 * Single source of truth for primary navigation, shared by BottomTabBar (mobile)
 * and NavHeader (desktop). Home is the Safety Dashboard — the app's daily entry
 * point. Equipment moved to /equipment; QR codes still target /equipment/[id].
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', longLabel: 'Home', icon: ShieldCheck, badge: 'safety' },
  { href: '/inspections', label: 'Pre-Trip', longLabel: 'Pre-Trip', icon: ClipboardCheck },
  { href: '/equipment', label: 'Assets', longLabel: 'Equipment', icon: LayoutGrid },
  { href: '/work-orders', label: 'Orders', longLabel: 'Work Orders', icon: ClipboardList, badge: 'orders' },
  { href: '/admin/labels', label: 'QR', longLabel: 'QR Labels', icon: QrCode },
]

/** Home owns the whole /safety workflow; everything else matches by prefix. */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/' || pathname.startsWith('/safety')
  return pathname.startsWith(href)
}
