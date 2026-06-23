import AuthGate from '@/components/AuthGate'
import SdsLibrary from '@/components/sds/SdsLibrary'

export default function SdsPage() {
  return (
    <AuthGate>
      <SdsLibrary />
    </AuthGate>
  )
}
