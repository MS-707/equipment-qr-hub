'use client'

import AuthGate from '@/components/AuthGate'
import RecordView from '@/components/safety/RecordView'

export default function RecordPage({ params }: { params: { id: string } }) {
  return (
    <AuthGate>
      <main id="main" className="contents">
        <RecordView id={params.id} />
      </main>
    </AuthGate>
  )
}
