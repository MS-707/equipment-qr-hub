'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import AuthGate from '@/components/AuthGate'
import IncidentReportForm from '@/components/safety/IncidentReportForm'

export default function IncidentPage() {
  return (
    <AuthGate>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/safety" className="inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg mb-4">
          <ArrowLeft className="w-4 h-4" /> Home
        </Link>
        <IncidentReportForm />
      </div>
    </AuthGate>
  )
}
