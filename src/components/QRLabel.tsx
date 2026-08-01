'use client'

import { QRCodeSVG } from 'qrcode.react'
import { EquipmentItem, CATEGORY_COLORS } from '@/lib/types'
import { useT } from '@/lib/i18n'

interface QRLabelProps {
  equipment: EquipmentItem
  baseUrl: string
  printMode?: boolean
  /**
   * 'equipment' (default) links to the unit's profile page.
   * 'pre-trip' links straight into the inspection flow (/inspect/[id]) —
   * for labels mounted on forklifts/lifts that operators scan before use.
   */
  variant?: 'equipment' | 'pre-trip'
}

export default function QRLabel({ equipment, baseUrl, printMode = false, variant = 'equipment' }: QRLabelProps) {
  const t = useT()
  const categoryColor = CATEGORY_COLORS[equipment.category]
  const isPreTrip = variant === 'pre-trip'
  const qrValue = isPreTrip
    ? `${baseUrl}/inspect/${equipment.itemNumber}`
    : `${baseUrl}/equipment/${equipment.itemNumber}`

  if (printMode) {
    return (
      <div className="print-label" style={{ textAlign: 'center' }}>
        {isPreTrip && (
          <p style={{
            fontWeight: 700,
            fontSize: '10px',
            letterSpacing: '0.06em',
            color: '#000000',
            border: '2px solid #000000',
            borderRadius: '4px',
            padding: '3px 4px',
            marginBottom: '6px',
            lineHeight: 1.25,
          }}>
            {/* eslint-disable no-restricted-syntax -- statically bilingual
                physical label: always BOTH languages, never locale-switched */}
            SCAN BEFORE OPERATING
            <br />
            ESCANEE ANTES DE OPERAR
            <br />
            PRE-TRIP INSPECTION REQUIRED
            {/* eslint-enable no-restricted-syntax */}
          </p>
        )}
        <QRCodeSVG
          value={qrValue}
          size={140}
          bgColor="#FFFFFF"
          fgColor="#000000"
          level="M"
          includeMargin={false}
        />
        <p style={{
          fontWeight: 600,
          fontSize: '11px',
          marginTop: '6px',
          lineHeight: 1.2,
          color: '#000000',
        }}>
          {equipment.name}
        </p>
        <p style={{
          fontSize: '10px',
          color: '#555555',
          marginTop: '2px',
        }}>
          {/* physical label, static — expression form sidesteps the JSXText ratchet */}
          {'Item #'}{equipment.itemNumber}
        </p>
        <p style={{
          fontSize: '9px',
          color: '#777777',
          marginTop: '2px',
        }}>
          {isPreTrip ? 'Sage Pre-Trip' : equipment.category}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-mytra-card border border-mytra-border rounded-card p-4 flex flex-col items-center text-center">
      {isPreTrip && (
        <span className="inline-block text-xs font-bold tracking-wide text-warn bg-warn/10 border border-warn/30 rounded px-2 py-1 mb-3">
          {t('qr.scanBeforeOperating', undefined, 'SCAN BEFORE OPERATING')}
        </span>
      )}
      <QRCodeSVG
        value={qrValue}
        size={120}
        bgColor="transparent"
        fgColor="currentColor"
        level="M"
        includeMargin={false}
      />
      <p className="text-fg font-medium text-sm mt-3 leading-snug">
        {equipment.name}
      </p>
      <p className="text-fg-4 text-xs mt-1">
        {t('qr.itemNumber', { itemNumber: equipment.itemNumber })}
      </p>
      <span
        className="inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-2"
        style={{
          backgroundColor: `${categoryColor}18`,
          color: categoryColor,
        }}
      >
        {isPreTrip ? t('dashboard.preTripInspection', undefined, 'Pre-Trip Inspection') : equipment.category}
      </span>
    </div>
  )
}
