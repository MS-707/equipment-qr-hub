'use client'

import AuthGate from '@/components/AuthGate'
import SafetyHistory from '@/components/safety/SafetyHistory'

export default function SafetyHistoryPage() {
  return (
    <AuthGate>
      <main id="main" className="contents">
        <SafetyHistory />
      </main>
    </AuthGate>
  )
}
