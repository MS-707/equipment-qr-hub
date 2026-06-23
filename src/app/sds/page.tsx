import type { Metadata } from 'next'
import AuthGate from '@/components/AuthGate'
import SdsLibrary from '@/components/sds/SdsLibrary'

export const metadata: Metadata = {
  title: 'Safety Data Sheets | Sage',
  description: 'Browse and search chemical safety data sheets with GHS classifications',
}

export default function SdsPage() {
  return (
    <AuthGate>
      <SdsLibrary />
    </AuthGate>
  )
}
