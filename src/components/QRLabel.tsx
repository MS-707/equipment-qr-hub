'use client'

import { QRCodeSVG } from 'qrcode.react'
import { EquipmentItem, CATEGORY_COLORS } from '@/lib/types'

interface QRLabelProps {
  equipment: EquipmentItem
  baseUrl: string
  printMode?: boolean
}

export default function QRLabel({ equipment, baseUrl, printMode = false }: QRLabelProps) {
  const categoryColor = CATEGORY_COLORS[equipment.category]
  const qrValue = `${baseUrl}/equipment/${equipment.itemNumber}`

  if (printMode) {
    return (
      <div className="print-label" style={{ textAlign: 'center' }}>
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
          Item #{equipment.itemNumber}
        </p>
        <p style={{
          fontSize: '9px',
          color: '#777777',
          marginTop: '2px',
        }}>
          {equipment.category}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 flex flex-col items-center text-center">
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
        Item #{equipment.itemNumber}
      </p>
      <span
        className="inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-2"
        style={{
          backgroundColor: `${categoryColor}18`,
          color: categoryColor,
        }}
      >
        {equipment.category}
      </span>
    </div>
  )
}
