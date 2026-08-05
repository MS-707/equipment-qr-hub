import InspectLanding from '@/components/InspectLanding'
import { getEquipmentById } from '@/lib/equipment'
import { requiresPreTrip } from '@/lib/types'
import NotFound from './NotFound'

/**
 * /inspect/:id — the QR landing. Resolves the record exactly the way
 * src/app/inspect/[id]/page.tsx does (getEquipmentById on the parsed item
 * number) and hands it to the unmodified InspectLanding.
 *
 * The Next page redirects a non-pre-trip unit to /equipment/:id. That profile
 * route is KIN-M2's, so redirecting there today would land on a 404 instead of
 * a page; until it exists the slice says so plainly.
 */
export default function InspectRoute({ id }: { id: string }) {
  const path = `/inspect/${id}`
  const itemNumber = Number.parseInt(id, 10)
  const equipment = Number.isNaN(itemNumber) ? undefined : getEquipmentById(itemNumber)

  if (!equipment) {
    return <NotFound path={path} message="No equipment matches this item number." />
  }

  if (!requiresPreTrip(equipment)) {
    return (
      <NotFound
        path={path}
        message={`${equipment.name} does not require a pre-trip inspection. Its equipment profile lands with the full route table.`}
      />
    )
  }

  return <InspectLanding equipment={equipment} />
}
