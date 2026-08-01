import type { Metadata } from 'next'
import WorkOrderBoard from '@/components/WorkOrderBoard'
import WorkOrdersHeader from '@/components/WorkOrdersHeader'

// Server component — metadata strings stay English literals (UX-7/DM-3:
// zero client fetch, no locale on the server). Visible copy is translated
// in the client children (WorkOrdersHeader, WorkOrderBoard).
export const metadata: Metadata = {
  title: 'Work Orders | Sage',
  description: 'PM work order tracking for shop floor equipment',
}

export default function WorkOrdersPage() {
  return (
    <main id="main" className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <WorkOrdersHeader />

      <WorkOrderBoard />
    </main>
  )
}
