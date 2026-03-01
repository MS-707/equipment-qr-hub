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
    return { title: 'Equipment Not Found | Mytra EHS' }
  }

  return {
    title: `${equipment.name} | Mytra EHS`,
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
    <Suspense>
      <EquipmentProfile equipment={equipment} />
    </Suspense>
  )
}
