'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import AuthGate from '@/components/AuthGate'
import JhaForm from '@/components/safety/JhaForm'
import ModuleTourButton from '@/components/onboarding/ModuleTourButton'

export default function JhaPage() {
  return (
    <AuthGate>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <Link href="/safety" className="inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg">
            <ArrowLeft className="w-4 h-4" /> Safety Hub
          </Link>
          <ModuleTourButton tourId="jha" />
        </div>
        <JhaForm />
      </div>
    </AuthGate>
  )
}
