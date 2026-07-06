'use client'

import AuthGate from '@/components/AuthGate'
import SafetyDashboard from '@/components/safety/SafetyDashboard'

export default function SafetyPage() {
  return (
    <AuthGate>
      <main id="main" className="contents">
        <SafetyDashboard />
      </main>
    </AuthGate>
  )
}
