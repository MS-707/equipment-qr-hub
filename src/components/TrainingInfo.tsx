'use client'

import { Users } from 'lucide-react'

export default function TrainingInfo() {
  return (
    <div className="space-y-6">
      {/* EHS Support */}
      <div>
        <h3 className="text-sm font-semibold text-fg mb-3">
          EHS Support
        </h3>
        <div className="bg-mytra-card border border-mytra-border rounded-lg p-4
                        flex items-start gap-3">
          <Users className="w-5 h-5 text-fg-3 mt-0.5 shrink-0" />
          <div>
            <p className="text-fg-2 text-sm">
              Have questions about this equipment or need training?
            </p>
            <p className="text-fg-3 text-xs mt-1">
              Reach out to your EHS coordinator — we&apos;re here to help.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
