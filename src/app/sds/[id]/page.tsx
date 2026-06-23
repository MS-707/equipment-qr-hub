import type { Metadata } from 'next'
import AuthGate from '@/components/AuthGate'
import SdsDetail from '@/components/sds/SdsDetail'

export const metadata: Metadata = {
  title: 'Chemical Detail | Sage',
  description: 'View full Safety Data Sheet details and emergency information',
}

export default function SdsDetailPage({ params }: { params: { id: string } }) {
  return (
    <AuthGate>
      <SdsDetail id={params.id} />
    </AuthGate>
  )
}
