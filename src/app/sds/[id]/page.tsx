import AuthGate from '@/components/AuthGate'
import SdsDetail from '@/components/sds/SdsDetail'

export default function SdsDetailPage({ params }: { params: { id: string } }) {
  return (
    <AuthGate>
      <SdsDetail id={params.id} />
    </AuthGate>
  )
}
