import type { Metadata } from 'next'
import WorkOrderBoard from '@/components/WorkOrderBoard'

export const metadata: Metadata = {
  title: 'Work Orders | Sage',
  description: 'PM work order tracking for shop floor equipment',
}

export default function WorkOrdersPage() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-fg">
          Work Orders
        </h1>
        <p className="text-fg-4 text-sm mt-1">
          PM work orders created from equipment profiles
        </p>
      </header>

      <WorkOrderBoard />
    </main>
  )
}
