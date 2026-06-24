import {
  ShieldCheck,
  ClipboardCheck,
  LayoutGrid,
  FlaskConical,
  ClipboardList,
  QrCode,
  type LucideIcon,
} from 'lucide-react'

export type BadgeKey = 'safety' | 'orders'

/**
 * The SDS library is a standalone app. Nav links point there and open in a new
 * tab so the field worker keeps Sage open behind it.
 */
export const SDS_EXTERNAL_URL = 'https://sds-five-beta.vercel.app/'

export interface NavItem {
  href: string
  /** Short label for the mobile bottom tab bar. */
  label: string
  /** Longer label for the desktop header nav. */
  longLabel: string
  icon: LucideIcon
  badge?: BadgeKey
  adminOnly?: boolean
  /** Hidden from the desktop top bar but kept on the mobile bottom tab bar. */
  hideOnDesktop?: boolean
  /** Links to an external app — render as <a target="_blank"> instead of <Link>. */
  external?: boolean
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
  // SDS is module-tier, not a primary desktop tab — reached via the dashboard
  // "SDS Library" tile on desktop, but kept on the mobile tab bar so field
  // workers retain one-tap chemical-safety access. Links out to the standalone
  // SDS app (no badge — there's no in-app SDS store to count new arrivals from).
  { href: SDS_EXTERNAL_URL, label: 'SDS', longLabel: 'Safety Data Sheets', icon: FlaskConical, hideOnDesktop: true, external: true },
  { href: '/work-orders', label: 'Orders', longLabel: 'Work Orders', icon: ClipboardList, badge: 'orders' },
  { href: '/admin/labels', label: 'QR', longLabel: 'QR Labels', icon: QrCode, adminOnly: true },
]

/** Home owns the whole /safety workflow; everything else matches by prefix. */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/' || pathname.startsWith('/safety')
  return pathname.startsWith(href)
}
