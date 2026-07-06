'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import AuthGate from '@/components/AuthGate'
import JhaForm from '@/components/safety/JhaForm'
import ModuleTourButton from '@/components/onboarding/ModuleTourButton'

export default function JhaPage() {
  return (
    <AuthGate>
      <main id="main" className="contents">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <Link href="/safety" aria-label="Back to safety dashboard" className="inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg min-h-[44px]">
            <ArrowLeft className="w-4 h-4" /> Safety
          </Link>
          <ModuleTourButton tourId="jha" />
        </div>
        <JhaForm />
      </div>
      </main>
    </AuthGate>
  )
}
