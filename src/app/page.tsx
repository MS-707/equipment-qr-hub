'use client'

import AuthGate from '@/components/AuthGate'
import SafetyDashboard from '@/components/safety/SafetyDashboard'

export default function Home() {
  return (
    <AuthGate>
      <SafetyDashboard />
    </AuthGate>
  )
}
