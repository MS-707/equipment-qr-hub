'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Printer, ArrowLeft, ShieldAlert, ClipboardCheck, QrCode } from 'lucide-react'
import { getAllEquipment, getCategories } from '@/lib/equipment'
import { CATEGORY_COLORS, EquipmentCategory, requiresPreTrip } from '@/lib/types'
import QRLabel from '@/components/QRLabel'
import { btnPrimaryCls, btnSelectedCls } from '@/lib/form-styles'
import { useT } from '@/lib/i18n'

export default function LabelsPage() {
  const t = useT()
  const { data: session } = useSession()
  const canAccess = session?.user?.isAdmin === true
  const [baseUrl, setBaseUrl] = useState('')
  // 'equipment' = profile-link labels for every asset;
  // 'pre-trip' = SCAN BEFORE OPERATING labels that deep-link into /inspect/[id]
  const [labelSet, setLabelSet] = useState<'equipment' | 'pre-trip'>('equipment')
  const categories = useMemo(() => getCategories(), [])
  const allEquipment = useMemo(() => getAllEquipment(), [])
  const preTripEquipment = useMemo(() => allEquipment.filter(requiresPreTrip), [allEquipment])

  useEffect(() => {
    setBaseUrl(window.location.origin)
  }, [])

  const equipmentByCategory = categories.reduce((acc, category) => {
    acc[category] = allEquipment.filter(e => e.category === category)
    return acc
  }, {} as Record<EquipmentCategory, typeof allEquipment>)

  if (!canAccess) {
    return (
      <main id="main" className="min-h-screen bg-mytra-bg flex items-center justify-center p-4">
        <div className="bg-mytra-card border border-mytra-border rounded-card p-6 text-center max-w-sm">
          <ShieldAlert className="w-8 h-8 text-warn mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-fg">{t('qr.adminAccessRequired', undefined, 'Admin Access Required')}</h2>
          <p className="text-sm text-fg-3 mt-2">
            {t('qr.adminAccessBody')}
          </p>
          <Link href="/equipment" className="inline-block mt-4 text-sm text-mytra-purple hover:text-mytra-purple-hover">
            {t('qr.backToEquipment', undefined, 'Back to Equipment')}
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
          {(labelSet === 'pre-trip' ? preTripEquipment : allEquipment).map(item => (
            <QRLabel
              key={`print-${item.itemNumber}`}
              equipment={item}
              baseUrl={baseUrl}
              printMode
              variant={labelSet}
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
              {t('qr.backToEquipment', undefined, 'Back to Equipment')}
            </Link>
            <h1 className="text-xl font-bold text-fg">
              {t('qr.title', undefined, 'QR Label Generator')}
            </h1>
            <p className="text-fg-3 mt-1">
              {t('qr.subtitle', undefined, 'Generate and print QR code labels for equipment')}
            </p>
          </div>

          {/* Controls bar */}
          <div className="bg-mytra-card border border-mytra-border rounded-card p-4 mb-8 flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="flex-1 w-full sm:w-auto">
              <label
                htmlFor="base-url"
                className="block text-sm font-medium text-fg-3 mb-1.5"
              >
                {t('qr.baseUrl', undefined, 'Base URL')}
              </label>
              <input
                id="base-url"
                type="text"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder={t('qr.baseUrlPlaceholder', undefined, 'https://your-domain.com')}
                className="w-full bg-mytra-input border border-mytra-border rounded-lg px-3 py-2 text-sm text-fg placeholder:text-fg-4 focus:outline-none focus:ring-2 focus:ring-mytra-purple focus:border-transparent"
              />
            </div>
            <div className="shrink-0">
              <span className="block text-sm font-medium text-fg-3 mb-1.5">{t('qr.labelType', undefined, 'Label type')}</span>
              <div className="inline-flex rounded-lg border border-mytra-border overflow-hidden" role="radiogroup" aria-label={t('qr.labelType', undefined, 'Label type')}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={labelSet === 'equipment'}
                  onClick={() => setLabelSet('equipment')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] text-sm font-medium transition-colors ${
                    labelSet === 'equipment' ? `${btnSelectedCls}` : 'bg-mytra-bg text-fg-3 hover:text-fg'
                  }`}
                >
                  <QrCode size={15} /> {t('nav.equipment.long', undefined, 'Equipment')}
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={labelSet === 'pre-trip'}
                  onClick={() => setLabelSet('pre-trip')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] text-sm font-medium transition-colors ${
                    labelSet === 'pre-trip' ? `${btnSelectedCls}` : 'bg-mytra-bg text-fg-3 hover:text-fg'
                  }`}
                >
                  <ClipboardCheck size={15} /> {t('nav.preTrip.label', undefined, 'Pre-Trip')}
                </button>
              </div>
            </div>
            <button
              onClick={() => window.print()}
              className={`${btnPrimaryCls} inline-flex items-center gap-2 font-medium text-sm px-5 py-2 min-h-[44px] shrink-0`}
            >
              <Printer size={16} />
              {labelSet === 'pre-trip'
                ? t('qr.printPreTripLabels', undefined, 'Print Pre-Trip Labels')
                : t('qr.printAllLabels', undefined, 'Print All Labels')}
            </button>
          </div>

          {/* Pre-trip labels: only units that require an inspection */}
          {labelSet === 'pre-trip' && (
            <section>
              <div className="flex items-center gap-3 mb-1 pl-3" style={{ borderLeft: '3px solid var(--hue-amber)' }}>
                <h2 className="text-lg font-semibold text-fg">{t('qr.preTripSectionTitle', undefined, 'Pre-Trip Inspection Labels')}</h2>
                <span className="text-xs text-fg-4">
                  {t('qr.unitCount', { count: preTripEquipment.length })}
                </span>
              </div>
              <p className="text-sm text-fg-3 mb-4 pl-3">
                {t('qr.preTripSectionBody')}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {preTripEquipment.map(item => (
                  <QRLabel
                    key={`pretrip-${item.itemNumber}`}
                    equipment={item}
                    baseUrl={baseUrl}
                    variant="pre-trip"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Equipment list grouped by category */}
          {labelSet === 'equipment' && (
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
                      {t('qr.itemCount', { count: items.length })}
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
          )}
        </div>
      </div>
    </>
  )
}
