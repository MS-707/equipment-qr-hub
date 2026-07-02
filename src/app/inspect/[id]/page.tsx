import { notFound, redirect } from 'next/navigation'
import { getAllEquipment, getEquipmentById } from '@/lib/equipment'
import { requiresPreTrip } from '@/lib/types'
import InspectLanding from '@/components/InspectLanding'

/**
 * QR-code landing for equipment-mounted pre-trip labels.
 *
 * Scanning the label on a forklift lands the operator directly in that
 * unit's inspection flow — no tab navigation, no equipment directory. Units
 * that don't require a pre-trip redirect to their normal profile page.
 */

interface InspectPageProps {
  params: { id: string }
}

export function generateStaticParams() {
  return getAllEquipment()
    .filter(requiresPreTrip)
    .map((e) => ({ id: String(e.itemNumber) }))
}

export function generateMetadata({ params }: InspectPageProps) {
  const equipment = getEquipmentById(parseInt(params.id, 10))
  if (!equipment) return { title: 'Equipment Not Found | Sage' }
  return {
    title: `Pre-Trip: ${equipment.name} | Sage`,
    description: `Pre-trip inspection for ${equipment.name}`,
  }
}

export default function InspectPage({ params }: InspectPageProps) {
  const itemNumber = parseInt(params.id, 10)
  const equipment = getEquipmentById(itemNumber)

  if (!equipment) notFound()
  if (!requiresPreTrip(equipment)) redirect(`/equipment/${itemNumber}`)

  return <InspectLanding equipment={equipment} />
}
