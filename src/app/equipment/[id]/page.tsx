import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getAllEquipment, getEquipmentById } from '@/lib/equipment'
import EquipmentProfile from '@/components/EquipmentProfile'

interface EquipmentPageProps {
  params: { id: string }
}

export function generateStaticParams() {
  return getAllEquipment().map((e) => ({ id: String(e.itemNumber) }))
}

export function generateMetadata({ params }: EquipmentPageProps) {
  const itemNumber = parseInt(params.id, 10)
  const equipment = getEquipmentById(itemNumber)

  if (!equipment) {
    return { title: 'Equipment Not Found | Sage' }
  }

  return {
    title: `${equipment.name} | Sage`,
    description: `PM schedule, training, and compliance info for ${equipment.name}`,
  }
}

export default function EquipmentPage({ params }: EquipmentPageProps) {
  const itemNumber = parseInt(params.id, 10)
  const equipment = getEquipmentById(itemNumber)

  if (!equipment) {
    notFound()
  }

  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-4 py-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-mytra-card rounded w-1/3" /><div className="h-64 bg-mytra-card rounded-lg" /></div></div>}>
      <EquipmentProfile equipment={equipment} />
    </Suspense>
  )
}
