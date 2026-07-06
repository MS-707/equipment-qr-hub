'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import AuthGate from '@/components/AuthGate'
import HeightPermitForm from '@/components/safety/HeightPermitForm'

export default function HeightPermitPage() {
  return (
    <AuthGate>
      <main id="main" className="contents">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/safety" aria-label="Back to safety dashboard" className="inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg mb-4 min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> Safety
        </Link>
        <HeightPermitForm />
      </div>
      </main>
    </AuthGate>
  )
}
