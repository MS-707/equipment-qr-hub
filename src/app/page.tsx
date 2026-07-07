'use client'

import AuthGate from '@/components/AuthGate'
import SafetyDashboard from '@/components/safety/SafetyDashboard'

export default function Home() {
  return (
    <AuthGate>
      <main id="main" className="contents">
        <SafetyDashboard />
      </main>
    </AuthGate>
  )
}
