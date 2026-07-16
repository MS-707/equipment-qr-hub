'use client'

import Link from 'next/link'
import { WifiOff } from 'lucide-react'
import { btnPrimaryCls } from '@/lib/form-styles'
import { useT } from '@/lib/i18n'

export default function OfflinePage() {
  const t = useT()
  return (
    <main id="main" className="min-h-screen bg-mytra-bg flex items-center justify-center px-4">
      <div className="text-center">
        <WifiOff className="w-12 h-12 text-fg-4 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-fg mb-2">{t('offline.title', undefined, 'You are offline')}</h1>
        <p className="text-fg-3 text-sm mb-6">
          {t('offline.body', undefined, "This page hasn't been cached yet. Connect to the network and try again.")}
        </p>
        <button
          onClick={() => window.location.reload()}
          className={`${btnPrimaryCls} inline-flex items-center justify-center gap-2 hover:bg-mytra-purple/80 text-sm font-medium px-5 py-2.5 mb-3 w-full sm:w-auto`}
        >
          {t('offline.tryAgain', undefined, 'Try again')}
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 border border-mytra-border bg-mytra-card hover:bg-mytra-card-hover
                     text-fg-2 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          {t('common.backHome', undefined, 'Back to Home')}
        </Link>
      </div>
    </main>
  )
}
