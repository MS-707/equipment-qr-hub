'use client'

import { Users } from 'lucide-react'
import { useT } from '@/lib/i18n'

export default function TrainingInfo() {
  const t = useT()
  return (
    <div className="space-y-6">
      {/* EHS Support */}
      <div>
        <h3 className="text-sm font-semibold text-fg mb-3">
          {t('training.ehsSupport', undefined, 'EHS Support')}
        </h3>
        <div className="bg-mytra-card border border-mytra-border rounded-card p-4
                        flex items-start gap-3">
          <Users className="w-5 h-5 text-fg-3 mt-0.5 shrink-0" />
          <div>
            <p className="text-fg-2 text-sm">
              {t('training.supportQuestion', undefined, 'Have questions about this equipment or need training?')}
            </p>
            <p className="text-fg-3 text-xs mt-1">
              {t('training.supportBody', undefined, "Reach out to your EHS coordinator — we're here to help.")}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
