'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import AuthGate from '@/components/AuthGate'
import HotWorkPermitForm from '@/components/safety/HotWorkPermitForm'

export default function HotWorkPermitPage() {
  return (
    <AuthGate>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/safety" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-4">
          <ArrowLeft className="w-4 h-4" /> Safety Hub
        </Link>
        <HotWorkPermitForm />
      </div>
    </AuthGate>
  )
}
