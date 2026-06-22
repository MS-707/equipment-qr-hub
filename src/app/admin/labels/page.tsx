'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Printer, ArrowLeft, ShieldAlert } from 'lucide-react'
import { getAllEquipment, getCategories } from '@/lib/equipment'
import { CATEGORY_COLORS, EquipmentCategory } from '@/lib/types'
import QRLabel from '@/components/QRLabel'

export default function LabelsPage() {
  const { data: session } = useSession()
  const canAccess = session?.user?.isAdmin === true
  const [baseUrl, setBaseUrl] = useState('')
  const categories = useMemo(() => getCategories(), [])
  const allEquipment = useMemo(() => getAllEquipment(), [])

  useEffect(() => {
    setBaseUrl(window.location.origin)
  }, [])

  const equipmentByCategory = categories.reduce((acc, category) => {
    acc[category] = allEquipment.filter(e => e.category === category)
    return acc
  }, {} as Record<EquipmentCategory, typeof allEquipment>)

  if (!canAccess) {
    return (
      <main className="min-h-screen bg-mytra-bg flex items-center justify-center p-4">
        <div className="bg-mytra-card border border-mytra-border rounded-card p-6 text-center max-w-sm">
          <ShieldAlert className="w-8 h-8 text-warn mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-fg">Admin Access Required</h2>
          <p className="text-sm text-fg-3 mt-2">
            QR label management is restricted to administrators. Contact your safety officer for access.
          </p>
          <Link href="/equipment" className="inline-block mt-4 text-sm text-mytra-purple hover:text-mytra-purple-hover">
            Back to Equipment
          </Link>
        </div>
      </main>
    )
  }

  return (
    <>
      {/* Print-only: render all labels in a flat grid for clean printing */}
      <div className="hidden print:block">
        <div className="print-grid">
          {allEquipment.map(item => (
            <QRLabel
              key={`print-${item.itemNumber}`}
              equipment={item}
              baseUrl={baseUrl}
              printMode
            />
          ))}
        </div>
      </div>

      {/* Screen view: full admin page */}
      <div className="no-print min-h-screen bg-mytra-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="mb-8">
            <Link
              href="/equipment"
              className="inline-flex items-center gap-1.5 text-sm text-fg-3 hover:text-fg transition-colors mb-4"
            >
              <ArrowLeft size={16} />
              Back to Equipment
            </Link>
            <h1 className="text-2xl font-bold text-fg">
              QR Label Generator
            </h1>
            <p className="text-fg-3 mt-1">
              Generate and print QR code labels for equipment
            </p>
          </div>

          {/* Controls bar */}
          <div className="bg-mytra-card border border-mytra-border rounded-card p-4 mb-8 flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="flex-1 w-full sm:w-auto">
              <label
                htmlFor="base-url"
                className="block text-sm font-medium text-fg-3 mb-1.5"
              >
                Base URL
              </label>
              <input
                id="base-url"
                type="text"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://your-domain.com"
                className="w-full bg-mytra-input border border-mytra-border rounded-lg px-3 py-2 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:ring-2 focus:ring-mytra-purple focus:border-transparent"
              />
            </div>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 bg-mytra-purple hover:bg-mytra-purple-hover text-white font-medium text-sm px-5 py-2 rounded-lg transition-colors shrink-0"
            >
              <Printer size={16} />
              Print All Labels
            </button>
          </div>

          {/* Equipment list grouped by category */}
          <div className="space-y-10">
            {categories.map(category => {
              const items = equipmentByCategory[category]
              if (!items || items.length === 0) return null
              const categoryColor = CATEGORY_COLORS[category]

              return (
                <section key={category}>
                  <div
                    className="flex items-center gap-3 mb-4 pl-3"
                    style={{ borderLeft: `3px solid ${categoryColor}` }}
                  >
                    <h2 className="text-lg font-semibold text-fg">
                      {category}
                    </h2>
                    <span className="text-xs text-fg-4">
                      {items.length} item{items.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {items.map(item => (
                      <QRLabel
                        key={item.itemNumber}
                        equipment={item}
                        baseUrl={baseUrl}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
