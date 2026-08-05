import { useSyncExternalStore } from 'react'
import { currentPath, subscribe } from './navigation'
import InspectRoute from './screens/InspectRoute'
import NotFound from './screens/NotFound'
import NotPortedYet from './screens/NotPortedYet'
import SliceHome from './screens/SliceHome'

/**
 * Minimal history router for the pre-trip slice. Three routes, no route
 * objects, no lazy boundaries — the full 23-route table with its layouts and
 * guards is KIN-M2's job, and building that machinery now would be scaffolding
 * with nothing to hold up.
 *
 *   /              index of the units that require a pre-trip
 *   /inspect/:id   InspectLanding for that unit
 *   *              not-found with a way home
 */

const INSPECT_ROUTE = /^\/inspect\/([^/?#]+)\/?$/

// The unchanged components link to these two, so the slice answers them with an
// explanation rather than the generic not-found. KIN-M2 replaces both with the
// real screens. See NotPortedYet.
const EQUIPMENT_ROUTE = /^\/equipment\/([^/?#]+)\/?$/
const RECORD_ROUTE = /^\/inspections\/record\/([^/?#]+)\/?$/

// Stable identity: useSyncExternalStore compares snapshots by reference, so a
// fresh closure here would loop.
const serverSnapshot = () => '/'

export default function Router() {
  const path = useSyncExternalStore(subscribe, currentPath, serverSnapshot)
  const pathname = path.split(/[?#]/)[0] || '/'

  if (pathname === '/') return <SliceHome />

  const inspect = INSPECT_ROUTE.exec(pathname)
  if (inspect) return <InspectRoute id={decodeURIComponent(inspect[1])} />

  if (EQUIPMENT_ROUTE.test(pathname)) return <NotPortedYet what="The equipment profile" path={pathname} />
  if (RECORD_ROUTE.test(pathname)) return <NotPortedYet what="The printable record" path={pathname} />

  return <NotFound path={pathname} />
}
