'use client'

import ModuleTourButton from '@/components/onboarding/ModuleTourButton'
import { useT } from '@/lib/i18n'

/**
 * Client header for /work-orders — the page itself is a server component
 * (it exports `metadata`, which stays English server-side per UX-7/DM-3:
 * no locale on the server), so the visible header copy is translated here.
 */
export default function WorkOrdersHeader() {
  const t = useT()
  return (
    <header className="mb-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl sm:text-xl font-bold text-fg">
          {t('nav.workOrders.long', undefined, 'Work Orders')}
        </h1>
        <ModuleTourButton tourId="work-orders" />
      </div>
      <p className="text-fg-4 text-sm mt-1">
        {t('workOrders.pageSubtitle', undefined, 'PM work orders created from equipment profiles')}
      </p>
    </header>
  )
}
