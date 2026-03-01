'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, QrCode } from 'lucide-react'

export default function NavHeader() {
  const pathname = usePathname()

  const navLinks = [
    { href: '/', label: 'Directory', icon: LayoutGrid },
    { href: '/admin/labels', label: 'QR Labels', icon: QrCode },
  ]

  return (
    <header className="no-print sticky top-0 z-50 bg-mytra-bg/95 backdrop-blur-sm border-b border-mytra-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Left: Logo / Title */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">Equipment QR Hub</span>
          <span className="text-xs bg-mytra-purple/20 text-mytra-purple rounded px-1.5 py-0.5 font-medium">
            EHS
          </span>
        </Link>

        {/* Right: Nav Links */}
        <nav className="flex items-center gap-5">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === '/'
                ? pathname === '/'
                : pathname.startsWith(href)

            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 text-sm transition ${
                  isActive
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
